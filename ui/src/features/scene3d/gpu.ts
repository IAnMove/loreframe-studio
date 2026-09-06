import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { scene3dSlotColor } from './document.ts'
import type { Scene3DClipCatalogEntry, Scene3DLight, Scene3DSlot } from './types.ts'

export const MAX_VIEW_WIDTH = 1280
export const MAX_VIEW_HEIGHT = 720
export const MAX_PIXEL_RATIO = 1.25

export type SlotGpu = {
  sourceUrl: string
  clipKey: string
  root: Object3D
  baseScale: number
  animations: GLTF['animations']
  mixer: AnimationMixer | null
}

export type GpuWorld = {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  dir: DirectionalLight
  slots: Map<string, SlotGpu>
}

export function clipKeyOf(clip: Scene3DSlot['clip']): string {
  return clip ? `${clip.index}\0${clip.name}` : ''
}

export function catalogFromClips(animations: GLTF['animations']): Scene3DClipCatalogEntry[] {
  return animations.map((clip, index) => ({
    index,
    name: clip.name,
    durationSeconds: Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : null,
  }))
}

function isTexture(value: unknown): value is Texture {
  return Boolean(value && typeof value === 'object' && 'isTexture' in value)
}

export function disposeMaterial(material: Material) {
  material.dispose()
  for (const value of Object.values(material)) {
    if (isTexture(value)) value.dispose()
  }
}

export function disposeObject(object: Object3D) {
  object.traverse(child => {
    if (!(child instanceof Mesh)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) disposeMaterial(material)
  })
}

export function viewSize(host: HTMLElement) {
  const width = host.clientWidth || 640
  const height = host.clientHeight || 360
  const scale = Math.min(1, MAX_VIEW_WIDTH / width, MAX_VIEW_HEIGHT / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function applyLight(dir: DirectionalLight, light: Scene3DLight) {
  dir.color = new Color(light.color)
  dir.intensity = light.intensity
  dir.position
    .set(-light.direction[0], -light.direction[1], -light.direction[2])
    .normalize()
    .multiplyScalar(6)
}

export function placeholderMesh(slot: Scene3DSlot) {
  const color = scene3dSlotColor(slot.slot)
  const mesh = new Mesh(
    new BoxGeometry(0.6, 1.6, 0.6),
    new MeshStandardMaterial({ color: new Color(color[0] / 255, color[1] / 255, color[2] / 255) }),
  )
  mesh.position.set(slot.position[0], 0.8, slot.position[2])
  mesh.rotation.y = slot.rotationY
  return mesh
}

export function fitGltf(root: Object3D, slot: Scene3DSlot) {
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const baseScale = 1.7 / Math.max(size.y, 0.001)
  root.scale.setScalar(baseScale * slot.scale)
  root.position.set(slot.position[0], slot.position[1], slot.position[2])
  root.rotation.y = slot.rotationY
  return baseScale
}

export function bindMixer(root: Object3D, animations: GLTF['animations'], slot: Scene3DSlot) {
  if (!slot.clip) return null
  const clip = animations[slot.clip.index]
  if (!clip || clip.name !== slot.clip.name) return null
  const mixer = new AnimationMixer(root)
  mixer.clipAction(clip).play()
  return mixer
}

export function dropSlot(world: GpuWorld, slotId: string) {
  const current = world.slots.get(slotId)
  if (!current) return
  current.mixer?.stopAllAction()
  world.scene.remove(current.root)
  disposeObject(current.root)
  world.slots.delete(slotId)
}

export function placeSlot(
  world: GpuWorld,
  slot: Scene3DSlot,
  root: Object3D,
  animations: GLTF['animations'],
  baseScale = 1,
) {
  dropSlot(world, slot.id)
  world.scene.add(root)
  world.slots.set(slot.id, {
    sourceUrl: slot.sourceUrl,
    clipKey: clipKeyOf(slot.clip),
    root,
    baseScale,
    animations,
    mixer: bindMixer(root, animations, slot),
  })
}

export function syncSlotClip(world: GpuWorld, slot: Scene3DSlot) {
  const current = world.slots.get(slot.id)
  if (!current) return
  const nextKey = clipKeyOf(slot.clip)
  if (current.clipKey === nextKey) return
  current.mixer?.stopAllAction()
  current.mixer = bindMixer(current.root, current.animations, slot)
  current.clipKey = nextKey
}

export function pruneSlots(world: GpuWorld, slots: readonly Scene3DSlot[]) {
  const wanted = new Set(slots.map(slot => slot.id))
  for (const id of [...world.slots.keys()]) {
    if (!wanted.has(id)) dropSlot(world, id)
  }
}

export function createWorld(host: HTMLDivElement, light: Scene3DLight, fov: number): GpuWorld {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
  renderer.shadowMap.enabled = false
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  host.append(renderer.domElement)
  const scene = new Scene()
  scene.background = new Color(0x10141c)
  const camera = new PerspectiveCamera(fov, 16 / 9, 0.05, 80)
  scene.add(new HemisphereLight(0xc8d8ff, 0x2a2118, 0.55))
  const dir = new DirectionalLight(light.color, light.intensity)
  applyLight(dir, light)
  scene.add(dir)
  const floor = new Mesh(
    new CircleGeometry(8, 48),
    new MeshStandardMaterial({ color: 0x1c222c, roughness: 0.92 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  return { renderer, scene, camera, dir, slots: new Map() }
}

export function disposeWorld(world: GpuWorld) {
  for (const id of [...world.slots.keys()]) dropSlot(world, id)
  disposeObject(world.scene)
  world.renderer.dispose()
  world.renderer.forceContextLoss()
  world.renderer.domElement.remove()
}

export function resizeWorld(world: GpuWorld, host: HTMLDivElement) {
  const size = viewSize(host)
  world.renderer.setSize(size.width, size.height, false)
  world.camera.aspect = size.width / size.height
  world.camera.updateProjectionMatrix()
}

export function poseLoadedSlot(current: SlotGpu, slot: Scene3DSlot) {
  current.root.position.set(slot.position[0], slot.position[1], slot.position[2])
  current.root.rotation.y = slot.rotationY
  current.root.scale.setScalar(current.baseScale * slot.scale)
}
