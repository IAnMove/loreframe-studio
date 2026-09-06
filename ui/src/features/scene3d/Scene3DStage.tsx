import { useEffect, useRef } from 'react'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { cameraEyeAtTime } from './camera.ts'
import { scene3dClipLocalTime } from './clock.ts'
import {
  applyLight,
  catalogFromClips,
  createWorld,
  disposeObject,
  disposeWorld,
  fitGltf,
  type GpuWorld,
  placeSlot,
  placeholderMesh,
  poseLoadedSlot,
  pruneSlots,
  resizeWorld,
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
      if (!live || live.sourceUrl !== url) {
        disposeObject(gltf.scene)
        return
      }
      fitGltf(gltf.scene, live)
      placeSlot(world, live, gltf.scene, gltf.animations)
      onClips?.(live.id, catalogFromClips(gltf.animations))
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
      if (current && current.sourceUrl === slot.sourceUrl) {
        poseLoadedSlot(current, slot)
        syncSlotClip(world, slot)
        continue
      }
      placeSlot(world, slot, placeholderMesh(slot), [])
      loadSlotGltf(
        world,
        slot,
        loader,
        () => cancelled || worldRef.current !== world,
        () => documentRef.current.slots.find(item => item.id === slot.id),
        (slotId, clips) => onSlotClipsRef.current?.(slotId, clips),
      )
    }
    return () => {
      cancelled = true
    }
  }, [document.slots])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    const eye = cameraEyeAtTime(document.camera, sceneSeconds, document.duration)
    world.camera.fov = document.camera.fov
    world.camera.position.set(eye[0], eye[1], eye[2])
    world.camera.lookAt(document.camera.look[0], document.camera.look[1], document.camera.look[2])
    world.camera.updateProjectionMatrix()
    for (const gpu of world.slots.values()) {
      if (!gpu.mixer) continue
      const clip = gpu.animations.find((_, index) => clipMatches(gpu, index))
      const local = scene3dClipLocalTime(sceneSeconds, clip?.duration ?? null, { loop: true })
      if (local != null) gpu.mixer.setTime(local)
    }
    world.renderer.render(world.scene, world.camera)
  }, [document.camera, document.duration, sceneSeconds])

  return <div ref={hostRef} className="absolute inset-0" data-testid="scene3d-stage" />
}

function clipMatches(gpu: { clipKey: string; animations: GLTF['animations'] }, index: number) {
  const clip = gpu.animations[index]
  return Boolean(clip && gpu.clipKey === `${index}\0${clip.name}`)
}
