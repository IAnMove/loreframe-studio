import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraEyeAtTime, orbitEye } from '../src/features/scene3d/camera.ts'
import { clipBindingError, resolveScene3DClip } from '../src/features/scene3d/clips.ts'
import { scene3dClipLocalTime, scene3dFrameCount, scene3dFrameTime } from '../src/features/scene3d/clock.ts'
import { cloneScene3DDocument, createDefaultScene3DDocument, parseScene3DDocument } from '../src/features/scene3d/document.ts'
import { applyScene3DTemplate, patchScene3DSlot } from '../src/features/scene3d/templates.ts'
import { documentFromWorld3DRequest } from '../src/features/scene3d/world3dAgent.ts'
import { hashSoftwareFrame, renderScene3DSoftware } from '../src/features/scene3d/softwareRender.ts'

test('frame clock matches compositor export indexing', () => {
  assert.equal(scene3dFrameCount(2, 30), 60)
  assert.equal(scene3dFrameTime(0, 2, 30), 0)
  assert.equal(scene3dFrameTime(59, 2, 30), 59 / 30)
  assert.ok(scene3dFrameTime(59, 2, 30) < 2)
})

test('unknown clip duration is not treated as zero playback', () => {
  assert.equal(scene3dClipLocalTime(1.2, null), null)
  assert.equal(scene3dClipLocalTime(1.2, 0), null)
  assert.equal(scene3dClipLocalTime(0.5, 1, { loop: true }), 0.5)
})

test('clip identity is index plus exact name', () => {
  const catalog = [
    { index: 0, name: 'Armature|clip0|baselayer', durationSeconds: 0.033 },
    { index: 1, name: 'Running', durationSeconds: 0.667 },
  ]
  const running = resolveScene3DClip(catalog, { index: 1, name: 'Running' })
  assert.equal(running && 'name' in running && running.name, 'Running')
  const missing = clipBindingError(resolveScene3DClip(catalog, { index: 9, name: 'Running' }))
  assert.equal(missing?.code, 'clip_missing')
  const mismatch = clipBindingError(resolveScene3DClip(catalog, { index: 1, name: 'run' }))
  assert.equal(mismatch?.code, 'clip_name_mismatch')
})

test('clip catalogs are per slot, not a shared name list', () => {
  const subject = [
    { index: 0, name: 'Armature|clip0|baselayer', durationSeconds: 0.033 },
    { index: 1, name: 'Running', durationSeconds: 0.667 },
  ]
  const prop = [{ index: 0, name: 'Spin', durationSeconds: 2 }]
  assert.equal(clipBindingError(resolveScene3DClip(subject, { index: 1, name: 'Running' })), null)
  assert.equal(clipBindingError(resolveScene3DClip(prop, { index: 1, name: 'Running' }))?.code, 'clip_missing')
})

test('save and reopen keeps camera, light, slots and clip refs', () => {
  const original = createDefaultScene3DDocument()
  original.slots[0].clip = { index: 1, name: 'Running' }
  original.camera.family = 'orbit'
  const restored = parseScene3DDocument(JSON.parse(JSON.stringify(cloneScene3DDocument(original))))
  assert.ok(restored)
  assert.equal(restored.camera.family, 'orbit')
  assert.deepEqual(restored.slots[0].clip, { index: 1, name: 'Running' })
  assert.equal(restored.light.kind, 'directional')
  assert.equal(restored.slots.length, 2)
})

test('software frames differ when subjects move or the camera orbits', () => {
  const document = createDefaultScene3DDocument()
  const first = hashSoftwareFrame(renderScene3DSoftware(document, 0))
  document.slots[0].position = [1.4, 0, 0]
  const moved = hashSoftwareFrame(renderScene3DSoftware(document, 0))
  assert.notEqual(first, moved)
  const orbitDoc = createDefaultScene3DDocument()
  orbitDoc.camera.family = 'orbit'
  const a = hashSoftwareFrame(renderScene3DSoftware(orbitDoc, 0))
  const b = hashSoftwareFrame(renderScene3DSoftware(orbitDoc, 2))
  assert.notEqual(a, b)
  const eye0 = cameraEyeAtTime(orbitDoc.camera, 0, 4)
  const eyeHalf = orbitEye(orbitDoc.camera.look, 4.2, 1.6, Math.PI)
  assert.notEqual(eye0[0], eyeHalf[0])
})

test('cinematic templates bind slots and a camera family', () => {
  const two = applyScene3DTemplate('two-shot')
  assert.equal(two.templateId, 'two-shot')
  assert.equal(two.camera.family, 'establishment')
  assert.deepEqual(two.slots.map(slot => slot.slot), ['subject_1', 'subject_2', 'background'])
  const product = applyScene3DTemplate('product-orbit')
  assert.equal(product.camera.family, 'product')
  const moved = patchScene3DSlot(two, 'subject_1', { position: [2, 0, 0], scale: 1.4 })
  assert.equal(moved.slots[0].position[0], 2)
  assert.equal(moved.slots[0].scale, 1.4)
})

test('wizard mount request uses the same template ids as the editor', () => {
  const document = documentFromWorld3DRequest({
    type: 'mount_world3d_template',
    templateId: 'over-shoulder',
    bindings: { subject_1: { url: '/api/v1/file/hero.glb', media: 'model3d' } },
  })
  assert.equal(document.templateId, 'over-shoulder')
  assert.equal(document.camera.family, 'encounter')
  assert.equal(document.slots[0].sourceUrl, '/api/v1/file/hero.glb')
})

test('establishment camera eases in rather than sitting still', () => {
  const document = applyScene3DTemplate('hero-push')
  const a = cameraEyeAtTime(document.camera, 0, document.duration, document.slots)
  const b = cameraEyeAtTime(document.camera, document.duration, document.duration, document.slots)
  assert.notEqual(a[2], b[2])
})
