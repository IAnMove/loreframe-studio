import type { Scene } from '../../types'
import { templateCatalogVersion, getCandidateSceneTemplate, type SceneTemplateDefinition } from './catalog'
import { backdrop, foreground, type TemplateBindings, type TemplateControls, type TemplateAsset } from './sceneBuilders'
import { cinemaScenes } from './cinemaScenes'
import { musicScenes } from './musicScenes'
import { spaceScenes } from './spaceScenes'
import { musicMotionSolo } from './musicMotionSolo'
import { musicMotionEnsemble } from './musicMotionEnsemble'
import { musicMotionBackground } from './musicMotionBuilders'
export type { TemplateBindings, TemplateControls, TemplateAsset } from './sceneBuilders'

const builders = { ...cinemaScenes, ...musicScenes, ...spaceScenes, ...musicMotionSolo, ...musicMotionEnsemble }
function finiteRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label}: debe estar entre ${min} y ${max}.`)
  return value
}
function validateAsset(value: TemplateAsset) {
  if (typeof value.source !== 'string' || !value.source.trim() || value.source.length > 2_000_000) throw new Error('Cada slot necesita un recurso existente y durable (máximo 2 MB de referencia).')
  if (!/^(?:data:(?:image\/|model\/gltf-binary;)|\/api\/v1\/|https?:\/\/)/i.test(value.source)) throw new Error('Usa un asset de Library o una referencia de imagen/GLB durable; no blob:, scripts ni rutas del disco.')
  // HTTP/API references are checked by the media loader; only inline MIME is known here.
  if (/^data:/i.test(value.source)) {
    const matchesKind = value.type === 'image' ? /^data:image\//i : /^data:model\/gltf-binary;/i
    if (!matchesKind.test(value.source)) throw new Error('El MIME del asset inline no coincide con su tipo declarado.')
  }
}
function validateBindings(template: SceneTemplateDefinition, bindings: TemplateBindings) {
  const allowed = new Set(template.slots.map(slot => slot.id))
  if (Object.keys(bindings).some(slot => !allowed.has(slot as keyof TemplateBindings))) throw new Error('El binding contiene un slot desconocido.')
  for (const slot of template.slots) {
    const value = bindings[slot.id]
    if (!value && slot.required) throw new Error(`Falta el slot obligatorio ${slot.id}.`)
    if (!value) continue
    if (!slot.kinds.includes(value.type)) throw new Error(`El slot ${slot.id} no admite ${value.type}.`)
    validateAsset(value)
  }
  const models = Object.values(bindings).filter(value => value?.type === 'model3d').map(value => value!.source)
  if (new Set(models).size !== models.length) throw new Error('Los slots GLB no admiten fuentes repetidas en este compositor.')
}
export function compileCandidateScene(id: string, bindings: TemplateBindings, options: Partial<TemplateControls> = {}): Scene {
  const template = getCandidateSceneTemplate(id)
  const build = builders[id]
  if (!build) throw new Error(`La plantilla ${id} todavía no tiene compilador.`)
  validateBindings(template, bindings)
  const controls: TemplateControls = {
    duration: finiteRange(options.duration ?? template.defaultDuration, 3, 12, 'Duración'),
    bpm: finiteRange(options.bpm ?? 120, 40, 220, 'BPM'),
    intensity: finiteRange(options.intensity ?? .6, 0, 1, 'Intensidad'),
  }
  const ctx = { ...controls, bindings }
  const expanded = template.slots.some(slot => slot.id === 'subject_1')
  const background = expanded ? musicMotionBackground(id, ctx) : [backdrop(ctx)]
  const layers = [...background, ...build(ctx), ...foreground(ctx)]
  if (layers.length > 24 || layers.filter(item => item.type === 'model3d').length > 2) throw new Error('La escena excede el presupuesto de 24 capas / 2 GLB.')
  return {
    version: 1, name: `${template.title} · candidata`, generationPolicy: 'provided_only',
    width: 1280, height: 720, fps: 30, duration: controls.duration, layers,
    narrative: { templateId: id, category: template.family, visualIntent: template.description,
      controls: { ...controls, catalogVersion: templateCatalogVersion(template), templateVersion: template.version, reviewStatus: template.status, renderer: 'layer-compositor-v1' },
      assets: Object.entries(bindings).filter(([, value]) => value).map(([slot, value]) => ({ slot, source: value!.source, name: value!.name, type: value!.type,
        ...(value!.catalogAtAssignment ? { catalogAtAssignment: { ...value!.catalogAtAssignment } } : {}),
      })),
      prompt: template.promptExample, evaluationCues: [...template.limits],
    },
  }
}
