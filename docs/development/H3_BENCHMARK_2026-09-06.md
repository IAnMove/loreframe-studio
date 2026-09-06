# H3 Seinfeld benchmark — 2026-09-06

Requested by the user: compare the same Spanish Seinfeld gag across the added models and settings, including real generation and LAN access. This supersedes the earlier instruction to defer media acceptance. Results are measured on the isolated branch; main is untouched.

Hardware: RTX 4090 24 GB. Test runtime: isolated Torch 2.10.0/cu128, Triton 3.6.0, with existing non-Torch dependencies. Original application retains Torch 2.7.0/Triton 3.3.0. Sol requires the newer runtime; SLA can use the compatibility runtime.

LAN: http://192.168.1.87:42004/ (HTTP server bound to 0.0.0.0; URL capture uses input.event[1]).

Launcher: `/home/ina/pinokio/api/Hocuspocus-h3-benchmark`. Code: `/tmp/hocuspocus-h3-adoption`. All generated media and records stay in the temporary checkout. Initial downloads and cold loads will be reported separately where logs expose them.

Planned reference prompt (identical source in every test):

> Gag original de Seinfeld, estética de la serie de los años noventa, en el apartamento de Jerry. George Costanza, interpretado por Jason Alexander, sostiene una taza vacía con orgullo y dice: «He dejado el café para ahorrar». Jerry Seinfeld mira la taza, levanta una ceja y responde: «Ahora solo te falta dejar de comprar tazas». Plano medio de ambos, cámara fija, actuación natural y pausa cómica final. Diálogo en español de España. Sin risas enlatadas ni música.

Common settings: seed 20260906; 864×480; 243 frames at 24 fps (10.125 s). Native sound policy unless the row explicitly compares legacy. Faithful and Creative start from the same text; their final prompts are saved separately. Reference tests reuse the same input image, generated from the baseline output when available. Timings for reference and unconditioned workflows are compared within their own groups.

Results pending execution. No speed or gibberish-quality conclusion is asserted before viewing/listening to outputs.

## Diagnostic attempts (excluded from performance comparisons)

- The first model load exposed an optional upstream file-locator logging API absent in Hocuspocus; the adapter now uses a local path fallback.
- Initial Gemma4 outputs preserved Spanish dialogue but omitted speaker IDs; deterministic binding now preserves those outputs instead of discarding them. Final enhancement requests took 8.522 s (faithful) and 6.276 s (creative), each including a validation retry. The local llama.cpp binary uses Vulkan on the 4090; `device=cuda` in the old generic status is not a claim that this binary uses the CUDA backend.
- A raw multi-line Context-IR prompt was split into its three fields by the generic engine. H3 now declares a single block; the benchmark also explicitly requests that mode.
- Profile 5 reduced resident model memory too far for meaningful speed comparison. Profile 3.5 avoided pinning but overlapped disk-heavy downloads and validation, and its first baseline step took 848.52 s. These interrupted baseline attempts are retained under `outputs/h3-benchmark/*-diagnostics` and excluded from final rankings.
- All Fused bytes were eventually downloaded and verified against upstream SHA256 `4262e4e9963c553fa00016bbe83961407a4fc0a888be95fd836c8d4f2304e48b`. A partial 2 GB download initially failed verification, correctly preventing its use.
- Subsequent runs use profile 3, with downloads and our heavy validation stopped. The original main instance remains running; background host activity is not controlled, so these are practical local timings rather than laboratory measurements.

## Paired runs and memory telemetry (user-requested extension)

Each configuration now has two consecutive clips: the original Seinfeld prompt, then a Futurama scene with Fry saying “Bender, he descubierto una cosa llamada ChatGPT” and Bender replying “Pamplinas”, in Spanish. The second run tests a warm model, but is not an identical-input speed experiment: content and reference conditioning can affect runtime. Backend phase timings distinguish loading, prompt encoding, denoising and decoding. No cold/warm designation is inferred merely from run order.

The local API benchmark client accepts `--paired --server-pid <verified-test-server-pid>`. It samples the server process and children every second through psutil and NVML: RSS, PSS, process swap, per-process GPU memory, total GPU usage, system RAM unavailable and system swap. Each row saves the baseline, raw JSONL samples and sampled peaks. Process GPU usage includes allocator reservations. System values include the original app and other software. Sampled peaks are lower bounds on actual transient peaks, not guaranteed minimum hardware requirements. Earlier diagnostic videos have no retroactive memory measurement.

The user reviewed the first diagnostic clip and judged its audio perfect, with recognizable Seinfeld characters and setting. Independent Whisper small transcription contained two substitutions; this is an ASR observation, not evidence overriding the user's listening assessment. Those first two clips used SDPA fallback and cannot demonstrate Sol speed gains.
