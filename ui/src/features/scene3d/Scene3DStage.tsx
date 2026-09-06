import { useEffect, useRef } from 'react'
import { TextureLoader } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { cameraEyeAtTime, cameraLookAtTime } from './camera.ts'
import { scene3dClipLocalTime } from './clock.ts'
import {
  applyLight,
  applyLoopOffset,
  catalogFromClips,
  createWorld,
  disposeObject,
  disposeWorld,
  fitGltf,
  imageBackdropMesh,
  type GpuWorld,
  placeSlot,
  placeholderMesh,
  poseLoadedSlot,
  prepareBackdropTexture,
  pruneSlots,
  resizeWorld,
  slotNeedsReload,
  syncSlotClip,
} from './gpu.ts'
import type { Scene3DClipCatalogEntry, Scene3DDocument, Scene3DSlot } from './types.ts'

type Props = {
  document: Scene3DDocument
  sceneSeconds: number
  onSlotClips?: (slotId: string, clips: Scene3DClipCatalogEntry[]) => void
}

function loadSlotGltf(
  world: GpuWorld,
  slot: Scene3DSlot,
  loader: GLTFLoader,
  cancelled: () => boolean,
  liveSlot: () => Scene3DSlot | undefined,
  onClips: ((slotId: string, clips: Scene3DClipCatalogEntry[]) => void) | undefined,
) {
  const url = slot.sourceUrl
  if (!url) return
  loader.load(
    url,
    (gltf: GLTF) => {
      if (cancelled()) {
        disposeObject(gltf.scene)
        return
      }
      const live = liveSlot()
      if (!live || live.sourceUrl !== url || live.media === 'image') {
        disposeObject(gltf.scene)
        return
      }
      const baseScale = fitGltf(gltf.scene, live)
      placeSlot(world, live, gltf.scene, gltf.animations, baseScale)
      onClips?.(live.id, catalogFromClips(gltf.animations))
    },
    undefined,
    () => undefined,
  )
}

function loadSlotImage(
  world: GpuWorld,
  slot: Scene3DSlot,
  cancelled: () => boolean,
  liveSlot: () => Scene3DSlot | undefined,
) {
  const url = slot.sourceUrl
  if (!url) return
  new TextureLoader().load(
    url,
    texture => {
      if (cancelled()) {
        texture.dispose()
        return
      }
      const live = liveSlot()
      if (!live || live.sourceUrl !== url || live.media !== 'image') {
        texture.dispose()
        return
      }
      prepareBackdropTexture(texture)
      placeSlot(world, live, imageBackdropMesh(live, texture), [])
    },
    undefined,
    () => undefined,
  )
}

export function Scene3DStage({ document, sceneSeconds, onSlotClips }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<GpuWorld | null>(null)
  const documentRef = useRef(document)
  const onSlotClipsRef = useRef(onSlotClips)

  useEffect(() => {
    documentRef.current = document
  }, [document])

  useEffect(() => {
    onSlotClipsRef.current = onSlotClips
  }, [onSlotClips])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const world = createWorld(host, documentRef.current.light, documentRef.current.camera.fov)
    worldRef.current = world
    const resize = () => resizeWorld(world, host)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => {
      observer.disconnect()
      disposeWorld(world)
      worldRef.current = null
    }
  }, [])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    applyLight(world.dir, document.light)
  }, [document.light])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    let cancelled = false
    const loader = new GLTFLoader()
    pruneSlots(world, document.slots)
    for (const slot of document.slots) {
      const current = world.slots.get(slot.id)
      if (!slotNeedsReload(current, slot) && current) {
        poseLoadedSlot(current, slot)
        syncSlotClip(world, slot)
        continue
      }
      placeSlot(world, slot, placeholderMesh(slot), [])
      const live = () => documentRef.current.slots.find(item => item.id === slot.id)
      const gone = () => cancelled || worldRef.current !== world
      if (slot.media === 'image') {
        loadSlotImage(world, slot, gone, live)
        continue
      }
      loadSlotGltf(world, slot, loader, gone, live, (slotId, clips) => onSlotClipsRef.current?.(slotId, clips))
    }
    return () => {
      cancelled = true
    }
  }, [document.slots])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    const eye = cameraEyeAtTime(document.camera, sceneSeconds, document.duration, document.slots)
    const look = cameraLookAtTime(document.camera, sceneSeconds, document.duration, document.slots)
    world.camera.fov = document.camera.fov
    world.camera.position.set(eye[0], eye[1], eye[2])
    world.camera.lookAt(look[0], look[1], look[2])
    world.camera.updateProjectionMatrix()
    applyLoopOffset(world, sceneSeconds)
    for (const gpu of world.slots.values()) {
      if (!gpu.mixer) continue
      const clip = gpu.animations.find((_, index) => clipMatches(gpu, index))
      const local = scene3dClipLocalTime(sceneSeconds, clip?.duration ?? null, { loop: true })
      if (local != null) gpu.mixer.setTime(local)
    }
    world.renderer.render(world.scene, world.camera)
  }, [document.camera, document.duration, document.slots, sceneSeconds])

  return <div ref={hostRef} className="absolute inset-0" data-testid="scene3d-stage" />
}

function clipMatches(gpu: { clipKey: string; animations: GLTF['animations'] }, index: number) {
  const clip = gpu.animations[index]
  return Boolean(clip && gpu.clipKey === `${index}\0${clip.name}`)
}
