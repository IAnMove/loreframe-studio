"""Run reproducible H3 comparisons through an isolated running Hocuspocus API.

Never launches/stops the app or changes the user's main checkout. Requests,
status history and wall times are stored before moving to the next row.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import time
import urllib.request
import urllib.error

PROMPT = ('Gag original de Seinfeld, estética de la serie de los años noventa, en el apartamento de Jerry. '
          'George Costanza, interpretado por Jason Alexander, sostiene una taza vacía con orgullo y dice: '
          '«He dejado el café para ahorrar». Jerry Seinfeld mira la taza, levanta una ceja y responde: '
          '«Ahora solo te falta dejar de comprar tazas». Plano medio de ambos, cámara fija, actuación natural '
          'y pausa cómica final. Diálogo en español de España. Sin risas enlatadas ni música.')


def request(base, route, body=None, method=None, timeout=1200):
    payload = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base.rstrip('/') + route, data=payload,
        headers={'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'HTTP {error.code}: {error.read().decode()}') from error


def save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


def prepare(base, output):
    for style in ('faithful', 'creative'):
        path = output / f'prompt-{style}.json'
        if path.exists():
            continue
        started = time.monotonic()
        result = request(base, '/api/v1/llm/enhance-prompt', {
            'prompt': PROMPT, 'model_type': 'minimax_h3', 'mode': 'video',
            'planning_style': style, 'h3_audio_policy': 'native',
            'duration_seconds': 10.125, 'max_new_tokens': 1200,
        })
        result['source_prompt'] = PROMPT
        result['elapsed_seconds'] = round(time.monotonic()-started, 3)
        result['llm_status'] = request(base, '/api/v1/llm/status')
        save(path, result)
        print(f'Enhanced {style}: {result["elapsed_seconds"]}s', flush=True)
    request(base, '/api/v1/llm/unload', {})


def matrix():
    rows = []
    def row(model, preset='', attention='sdpa', steps=20, style='faithful', audio='native', frames=243):
        label = '-'.join([model, preset or 'base', attention, str(steps), style, audio, str(frames)])
        rows.append(dict(id=label, model=model, preset=preset, attention=attention, steps=steps, style=style, audio=audio, frames=frames))
    row('minimax_h3')
    for model, workflow in [('minimax_h3','fl2va'), ('minimax_h3_full','fl2va'), ('minimax_h3_ref2va','ref2va'), ('minimax_h3_ref2va_full','ref2va')]:
        if model == 'minimax_h3':
            row(model, 'v1-ckpt500', steps=6)
        row(model, 'v4-step600-ema', steps=6)
        preset = f'alibaba-pai-{workflow}-pdd-8step'
        row(model, preset, steps=8)
        row(model, preset, attention='sol', steps=8)
    for model in ['minimax_h3_fused_turbo','minimax_h3_ref2va_fused_turbo']:
        row(model, attention='sla', steps=4)
        row(model, attention='sdpa', steps=4)
        row(model, attention='sla', steps=8)
    row('minimax_h3','alibaba-pai-fl2va-pdd-8step',steps=8,style='creative')
    row('minimax_h3','alibaba-pai-fl2va-pdd-8step',steps=8,audio='legacy')
    row('minimax_h3','alibaba-pai-fl2va-pdd-8step',steps=8,frames=486)
    row('minimax_h3_ref2va','alibaba-pai-ref2va-pdd-8step',steps=8,frames=486)
    return rows


def run_row(base, output, row, reference=None):
    folder = output / row['id']
    result_file = folder/'result.json'
    if result_file.exists():
        return json.loads(result_file.read_text())
    defaults = request(base, '/api/v1/defaults/'+row['model'])
    prompt_data = json.loads((output/f'prompt-{row["style"]}.json').read_text())
    params = {**defaults, 'model_type': row['model'], 'prompt': prompt_data['enhanced'],
        'override_profile': 3.5, 'multi_prompts_gen_type': 2, 'seed': 20260906, 'resolution': '864x480', 'video_length': row['frames'],
        'num_inference_steps': row['steps'], 'guidance_scale': 1, 'batch_size': 1,
        'minimax_h3_turbo_mode': bool(row['preset']), 'minimax_h3_turbo_preset': row['preset'],
        'activated_loras': [], 'loras_multipliers': '', 'override_attention': row['attention'],
        'minimax_h3_planning_style': row['style'], 'minimax_h3_audio_policy': row['audio'],
        'minimax_h3_text_encoder': 'gguf_q4_k_m',
        'sliding_window_size': 243, 'sliding_window_overlap': 18,
        'sliding_window_memory_override': True, 'sliding_window_discard_last_frames': 0,
        'skip_steps_cache_type': '', 'workspace': 'h3_benchmark',
    }
    if row['frames'] > 243:
        params['prompt'] = PROMPT
        params['minimax_h3_reference_sequence'] = 'ref2va' in row['model']
    if 'ref2va' in row['model']:
        if not reference:
            return {'status': 'blocked', 'reason': 'reference image required'}
        params['minimax_h3_references'] = [{'type':'image', 'path':str(reference), 'role':'George Costanza and Jerry Seinfeld, the two characters in the apartment', 'image_intent':'composition'}]
    save(folder/'request.json',params)
    started = time.monotonic()
    try:
        submission = request(base, '/api/v1/generate', params)
        save(folder/'submission.json',submission)
        job_id = submission.get('job_id') or submission.get('jobId')
        if not job_id:
            raise RuntimeError(str(submission))
        save(folder/'active.json', {'job_id':job_id, 'started_at':time.time()})
        last_message = None
        while True:
            status = request(base, '/api/v1/status/'+job_id, timeout=120)
            save(folder/'status.json',status)
            message = (status.get('status'),status.get('message'),status.get('progress'))
            if message != last_message:
                print(row['id'], message, flush=True)
                last_message = message
            if status.get('status') in ('completed','complete','done','failed','error','cancelled','canceled'):
                break
            if time.monotonic()-started > 5400:
                status = {'status':'timeout','job_id':job_id, 'note':'Job left visible; inspect before submitting further rows.'}
                break
            time.sleep(15)
        result = {'row':row, 'elapsed_seconds':round(time.monotonic()-started,3), 'result':status}
    except Exception as error:
        result = {'row':row, 'elapsed_seconds':round(time.monotonic()-started,3), 'error':str(error)}
    save(result_file,result)
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',required=True)
    parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument('--prepare',action='store_true')
    parser.add_argument('--index',type=int)
    parser.add_argument('--reference',type=Path)
    args=parser.parse_args()
    save(args.output_dir/'matrix.json',matrix())
    if args.prepare: prepare(args.base_url,args.output_dir)
    if args.index is not None:
        print(json.dumps(run_row(args.base_url,args.output_dir,matrix()[args.index],args.reference),ensure_ascii=False),flush=True)

if __name__=='__main__': main()
