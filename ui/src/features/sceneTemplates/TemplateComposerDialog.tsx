import { useEffect, useRef, useState } from 'react'
import { ModalShell } from '../../components/common/ModalShell'
import type { Scene } from '../../types'
import { ALL_SCENE_TEMPLATES, getCandidateSceneTemplate, type SceneTemplateDefinition, type TemplateSlotName } from './catalog'
import { catalogBindingIssue, resolveCatalogBindings, type CatalogSelections } from './catalogBindings'
import { compileCandidateScene } from './compile'
import { TemplateAssetPicker } from './TemplateAssetPicker'
import { importApprovedReference } from './referenceImport'
import { TEMPLATE_SLOT_LABELS as SLOT_LABELS } from './componentContract'
import { TemplateReferencePanel } from './TemplateReferencePanel'
import { TemplateComponentHelp } from './TemplateComponentHelp'

const PULSE_IDS = new Set(['music-pulse', 'music-duet', 'music-chorus', 'music-orbit', 'music-stage', 'music-finale'])
const inputClass = 'mt-1 w-full rounded border border-border bg-bg-primary p-2 text-xs'

interface Props {
  workspace: string
  onClose: () => void
  onApply: (scene: Scene) => boolean
}

/** Mounted only while open: changing template/workspace discards stale bindings
 * and cancels pending catalog lookups, never a background generation request. */
export function TemplateComposerDialog({ workspace, onClose, onApply }: Props) {
  const [id, setId] = useState(ALL_SCENE_TEMPLATES[0].id)
  const template = getCandidateSceneTemplate(id)
  return <ModalShell open title="Crear escena desde Library" onClose={onClose} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-[880px] max-w-full space-y-4 overflow-y-auto rounded-xl border border-border bg-bg-secondary p-4 text-text-primary">
      <header className="flex items-center justify-between gap-4"><h2 className="font-semibold">Plantillas procedurales · Library</h2><button type="button" onClick={onClose} className="rounded border border-border px-3 py-1">Cerrar</button></header>
      <p className="text-xs text-text-secondary">{ALL_SCENE_TEMPLATES.length} acciones: referencias originales y nuevo pack musical pendiente de revisión. Tus assets crean una composición nueva, todavía por revisar. No se generan imágenes, vídeo ni audio automáticamente.</p>
      <label className="block text-xs">Acción / plantilla
        <select aria-label="Acción / plantilla" value={id} onChange={event => setId(event.target.value)} className={inputClass}>
          {ALL_SCENE_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.family} · {item.title}</option>)}
        </select>
      </label>
      <TemplateComposerForm key={`${workspace}:${id}`} template={template} workspace={workspace} onClose={onClose} onApply={onApply} />
    </div>
  </ModalShell>
}

function TemplateComposerForm({ template, workspace, onClose, onApply }: Props & { template: SceneTemplateDefinition }) {
  const [selections, setSelections] = useState<CatalogSelections>({})
  const [activeSlot, setActiveSlot] = useState<TemplateSlotName>(template.slots[0].id)
  const [duration, setDuration] = useState(template.defaultDuration)
  const [bpm, setBpm] = useState(120)
  const [intensity, setIntensity] = useState(.6)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const slot = template.slots.find(item => item.id === activeSlot)!
  const rhythmic = PULSE_IDS.has(template.id)
  const missing = template.slots.some(item => item.required && !selections[item.id])

  const apply = async () => {
    if (busy || missing || !replaceConfirmed) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const bindings = await resolveCatalogBindings(template, selections, workspace, controller.signal)
      if (controller.signal.aborted) return
      const scene = compileCandidateScene(template.id, bindings, { duration, bpm, intensity })
      if (onApply(scene)) onClose()
      else setError('El editor rechazó la escena. Tu selección se conserva; revisa el aviso del editor.')
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudo crear la escena.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const openOriginal = async (file: File) => {
    if (busy || !replaceConfirmed) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const scene = await importApprovedReference(file, template)
      if (!controller.signal.aborted && onApply(scene)) onClose()
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudo abrir el original.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <div className="space-y-4">
    <p className="text-xs">{template.description}</p>
    <TemplateReferencePanel templateId={template.id} disabled={busy || !replaceConfirmed} onOpen={file => void openOriginal(file)} />
    <TemplateComponentHelp templateId={template.id} />
    <ul className="list-disc pl-5 text-xs text-text-muted">{template.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <legend className="mb-2 text-xs">Assets de {workspace}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{template.slots.map(item => <div key={item.id} className={`rounded border p-2 text-xs ${activeSlot === item.id ? 'border-cyan-400' : 'border-border'}`}>
        <button type="button" aria-pressed={activeSlot === item.id} onClick={() => setActiveSlot(item.id)} className="block w-full text-left font-medium">{SLOT_LABELS[item.id]} {item.required ? '(obligatorio)' : '(opcional)'}</button>
        <p className="mt-1 font-mono text-cyan-200">{item.id} · {item.kinds.join(', ')}</p>
        <p className="mt-1 text-text-muted">{item.description}</p>
        <p className="mt-1 break-all">{selections[item.id]?.filename || 'Sin asignar'}</p>
        {selections[item.id] && <><p className="break-all text-[10px] text-text-muted">ID: {selections[item.id]!.id}</p><button type="button" aria-label={`Quitar ${SLOT_LABELS[item.id]}`} onClick={() => setSelections(current => ({ ...current, [item.id]: undefined }))} className="mt-1 text-rose-200">Quitar</button></>}
      </div>)}</div>
      <p className="text-xs">Asignar: {SLOT_LABELS[slot.id]}. Selecciona imágenes generadas previamente en Studio y guardadas en Library. No se extrae el fondo ni se genera una pose de forma oculta.</p>
      <TemplateAssetPicker key={slot.id} workspace={workspace} kinds={slot.kinds} selectedId={selections[slot.id]?.id} disabledReason={item => catalogBindingIssue(item, workspace, slot)} onPick={item => { setSelections(current => ({ ...current, [slot.id]: item })); setError('') }} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">Duración (s)<input aria-label="Duración (s)" type="number" min={3} max={12} step={1} value={duration} onChange={event => setDuration(Number(event.target.value))} className={inputClass} /></label>
        <label className="text-xs">BPM visual {!rhythmic && '×'}<input aria-label="BPM visual" disabled={!rhythmic} type="number" min={40} max={220} value={bpm} onChange={event => setBpm(Number(event.target.value))} className={inputClass} /></label>
        <label className="text-xs">Intensidad del pulso {!rhythmic && '×'}<input aria-label="Intensidad del pulso" disabled={!rhythmic} type="number" min={0} max={1} step={.1} value={intensity} onChange={event => setIntensity(Number(event.target.value))} className={inputClass} /></label>
      </div>
      <p className="text-xs text-text-muted">{rhythmic ? 'El pulso sólo mueve capas; BPM no crea música ni sincroniza un audio.' : '× BPM e intensidad no afectan a esta plantilla: no utiliza pulsos rítmicos.'}</p>
      <p className="text-xs text-amber-100">Las imágenes no caminan ni cambian de pose. Para personajes quietos usa un recorte de cintura hacia arriba y revisa el encuadre en el editor. El ajuste automático por anclas todavía no está implementado.</p>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)} />He guardado lo que necesito: crear reemplaza la composición actual y su audio. Los archivos guardados en Library no se borran.</label>
    </fieldset>
    {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
    <button type="button" onClick={() => void apply()} disabled={busy || missing || !replaceConfirmed} className="rounded border border-cyan-300/50 bg-cyan-400/10 px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Comprobando assets…' : 'Crear y abrir en editor'}</button>
  </div>
}
