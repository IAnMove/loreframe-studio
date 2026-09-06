import { getCandidateSceneTemplate } from './catalog'
import { compileCandidateScene, type TemplateBindings } from './compile'
import { demoArtwork } from './demoArtwork'
import { demoShip } from './demoShips'

export function candidateDemoBindings(id: string, variant: 'coral' | 'teal' = 'coral'): TemplateBindings {
  const template = getCandidateSceneTemplate(id)
  const art = demoArtwork(variant)
  const space = template.family === 'space'
  const bindings: TemplateBindings = {
    hero: space ? demoShip(variant) : id === 'music-product' || id === 'cinema-detail' ? art.prop : art.subject,
    plate: space ? art.space : template.family === 'music' ? art.stage : art.background,
  }
  const prop = template.slots.find(slot => slot.id === 'prop')
  if (prop?.required) {
    bindings.prop = space
      ? id === 'space-orbit' ? art.planet : demoShip(variant === 'coral' ? 'teal' : 'coral')
      : ['cinema-two-shot', 'music-duet'].includes(id) ? art.partner : art.prop
  }
  if (!space) bindings.foreground = art.foreground
  return bindings
}
export function candidateDemoScene(id: string, variant: 'coral' | 'teal' = 'coral') {
  return compileCandidateScene(id, candidateDemoBindings(id, variant))
}
