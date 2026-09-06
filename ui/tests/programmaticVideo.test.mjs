import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { reconcileProgrammaticVideoRequest, requestedProgrammaticPolicy } from '../src/features/agent/programmaticVideo.ts'

const dom = new JSDOM('<!doctype html><html><body /></html>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  Event: dom.window.Event,
  CustomEvent: dom.window.CustomEvent,
})
window.matchMedia = () => ({ matches: false })

const blankTurn = { reply: 'La propuesta del modelo.', actions: [] }

test('programmatic generation policy is conservative in Spanish and English', () => {
  const cases = [
    ['Monta un vídeo 3D sólo con mis assets.', 'provided_only'],
    ['Build a programmatic Video3D scene; you may generate images for missing backgrounds.', 'no_video_generation'],
    ['Monta un Video3D sólo con mis assets; puedes generar imágenes si falta algo.', 'provided_only'],
    ['Construye una escena Video3D con tus recursos, sin vídeo generativo.', 'provided_only'],
  ]
  for (const [request, expected] of cases) assert.equal(requestedProgrammaticPolicy(request), expected, request)
})

test('reconciliation preserves literal intent and quoted dialogue while replacing generic generation', async () => {
  const requests = [
    'Crea un vídeo 3D programático con mis recursos y conserva literalmente «No mires atrás» en español.',
    'Build a programmatic Video3D scene using my assets and preserve the literal dialogue "Stay with me" in English.',
  ]
  const { reconcileAgentTurnWithRequest } = await import('../src/features/agent/agentActions.ts')
  for (const request of requests) {
    const turn = await reconcileAgentTurnWithRequest(request, {
      reply: 'Voy a preparar un vídeo generativo.',
      actions: [
        { type: 'prepare_video', prompt: 'A generic generated clip.' },
        { type: 'start_generation', confirm: true },
      ],
    })
    assert.deepEqual(turn.actions.map(action => action.type), ['prepare_programmatic_video'])
    assert.equal(turn.actions[0].intent, request)
    assert.equal(turn.actions[0].generationPolicy, 'provided_only')
    assert.match(turn.actions[0].intent, /(?:No mires atrás|Stay with me)/)
    assert.equal(turn.actions.some(action => action.type === 'prepare_video'), false)
    assert.equal(turn.actions.some(action => action.type === 'start_generation'), false)
  }
})

test('reconciliation answers explanatory questions without actions', () => {
  const questions = [
    '¿Cómo funciona Video3D sin vídeo generativo?',
    'How does the programmatic Video3D compositor work?',
  ]
  for (const request of questions) {
    const result = reconcileProgrammaticVideoRequest(request, blankTurn)
    assert.ok(result)
    assert.deepEqual(result.actions, [])
    assert.match(result.reply, /Video3D/i)
  }
})

test('negated Video3D and ordinary video requests are not intercepted', () => {
  assert.equal(
    reconcileProgrammaticVideoRequest('No quiero Video3D, usa MiniMax para el vídeo.', blankTurn),
    null,
  )
  assert.equal(
    reconcileProgrammaticVideoRequest('Crea un vídeo cinematográfico de una nave.', blankTurn),
    null,
  )
})

test('registered programmatic capability parses an object and never accepts model-granted policy', async () => {
  const { getCapability, parseRegisteredCapability } = await import('../src/features/agent/capabilityRegistry.ts')
  const capability = getCapability('prepare_programmatic_video')
  assert.ok(capability)
  assert.equal(capability.name, 'prepare_programmatic_video')
  const action = parseRegisteredCapability('prepare_programmatic_video', {
    type: 'prepare_programmatic_video',
    intent: 'Monta Video3D con mis assets.',
    generation_policy: 'no_video_generation',
    output_names: ['subject.svg', 'subject.svg', 'background.svg'],
  })
  assert.deepEqual(action, {
    type: 'prepare_programmatic_video',
    intent: 'Monta Video3D con mis assets.',
    generationPolicy: 'provided_only',
    outputNames: ['subject.svg', 'background.svg'],
  })
  assert.equal(parseRegisteredCapability('prepare_programmatic_video', {
    type: 'prepare_programmatic_video', intent: '', output_names: [],
  }), null)
})
