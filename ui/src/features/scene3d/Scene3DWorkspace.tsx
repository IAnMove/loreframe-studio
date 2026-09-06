import { useEffect, useMemo, useRef, useState } from 'react'
import { useUiTranslation } from '../../i18n'
import { cameraEyeAtTime } from './camera.ts'
import { clipBindingError, resolveScene3DClip } from './clips.ts'
import { scene3dFrameCount, scene3dFrameTime } from './clock.ts'
import { createDefaultScene3DDocument, parseScene3DDocument } from './document.ts'
import { Scene3DStage } from './Scene3DStage.tsx'
import type { Scene3DClipCatalogEntry, Scene3DDocument } from './types.ts'

const FAMILIES = ['establishment', 'orbit', 'follow', 'product'] as const
type StageFamily = (typeof FAMILIES)[number]

type Props = {
  width: number
  height: number
}

function revokeIfBlob(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function Scene3DWorkspace({ width, height }: Props) {
  const { t } = useUiTranslation('scene3d')
  const [sceneDoc, setSceneDoc] = useState<Scene3DDocument>(() => createDefaultScene3DDocument())
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(0)
  const frameRef = useRef(0)
  const sceneDocRef = useRef(sceneDoc)
  const [catalogs, setCatalogs] = useState<Record<string, Scene3DClipCatalogEntry[]>>({})
  const fps = sceneDoc.fps
  const count = scene3dFrameCount(sceneDoc.duration, fps)
  const seconds = scene3dFrameTime(frame, sceneDoc.duration, fps)

  useEffect(() => {
    frameRef.current = frame
  }, [frame])

  useEffect(() => {
    sceneDocRef.current = sceneDoc
  }, [sceneDoc])

  useEffect(() => () => {
    for (const slot of sceneDocRef.current.slots) revokeIfBlob(slot.sourceUrl)
  }, [])

  const clipIssue = useMemo(() => {
    for (const slot of sceneDoc.slots) {
      const entries = catalogs[slot.id]
      if (!slot.clip || entries == null) continue
      const error = clipBindingError(resolveScene3DClip(entries, slot.clip))
      if (error) return `${slot.slot}: ${error.message}`
    }
    return null
  }, [catalogs, sceneDoc.slots])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const origin = performance.now()
    const originFrame = frameRef.current
    const tick = () => {
      const elapsed = scene3dFrameTime(originFrame, sceneDoc.duration, fps) + (performance.now() - origin) / 1000
      const wrapped = elapsed % Math.max(sceneDoc.duration, 0.001)
      const next = Math.min(count - 1, Math.round(wrapped * fps))
      setFrame(current => (current === next ? current : next))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, sceneDoc.duration, fps, count])

  const assignFile = (slotId: string, file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setSceneDoc(current => ({
      ...current,
      slots: current.slots.map(slot => {
        if (slot.id !== slotId) return slot
        revokeIfBlob(slot.sourceUrl)
        return { ...slot, sourceUrl: url, clip: null }
      }),
    }))
    setCatalogs(current => {
      const next = { ...current }
      delete next[slotId]
      return next
    })
  }

  const setFamily = (family: StageFamily) => {
    setSceneDoc(current => ({
      ...current,
      camera: { ...current.camera, family },
    }))
  }

  const bindClip = (slotId: string, index: number, name: string) => {
    setSceneDoc(current => ({
      ...current,
      slots: current.slots.map(slot => (
        slot.id === slotId
          ? { ...slot, clip: name ? { index, name } : null }
          : slot
      )),
    }))
  }

  const roundtrip = Boolean(parseScene3DDocument(JSON.parse(JSON.stringify(sceneDoc))))

  return (
    <div className="flex w-full flex-col gap-2" data-testid="scene3d-workspace">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-[#10141c]" style={{ aspectRatio: `${width} / ${height}` }}>
        <Scene3DStage
          document={sceneDoc}
          sceneSeconds={seconds}
          onSlotClips={(slotId, clips) => setCatalogs(current => ({ ...current, [slotId]: clips }))}
        />
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-1 text-[8px] text-cyan-200">
          {t('stage.badge')} · {sceneDoc.camera.family} · {seconds.toFixed(2)}s
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
        {FAMILIES.map(family => (
          <button
            key={family}
            type="button"
            onClick={() => setFamily(family)}
            className={`rounded border px-1.5 py-1 ${sceneDoc.camera.family === family ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100' : 'border-border text-text-muted'}`}
          >
            {t(`stage.family.${family}`)}
          </button>
        ))}
        <button type="button" onClick={() => setPlaying(current => !current)} className="rounded border border-border bg-bg-primary px-2 py-1">
          {playing ? t('stage.pause') : t('stage.play')}
        </button>
        <span className="text-text-muted">{t('stage.eye', { x: cameraEyeAtTime(sceneDoc.camera, seconds, sceneDoc.duration)[0].toFixed(2) })}</span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {sceneDoc.slots.map(slot => {
          const clips = catalogs[slot.id] ?? []
          return (
            <label key={slot.id} className="rounded border border-border bg-bg-primary p-1.5 text-[9px] text-text-secondary">
              <span className="block font-medium text-text-primary">{t(`stage.slot.${slot.slot}`)}</span>
              <input
                type="file"
                accept=".glb,model/gltf-binary"
                className="mt-1 w-full text-[8px]"
                onChange={event => assignFile(slot.id, event.target.files?.[0])}
              />
              {clips.length > 0 && (
                <select
                  className="mt-1 w-full rounded border border-border bg-bg-tertiary px-1 py-0.5"
                  value={slot.clip ? `${slot.clip.index}\u001f${slot.clip.name}` : ''}
                  onChange={event => {
                    const value = event.target.value
                    if (!value) {
                      bindClip(slot.id, 0, '')
                      return
                    }
                    const split = value.indexOf('\u001f')
                    bindClip(slot.id, Number(value.slice(0, split)) || 0, value.slice(split + 1))
                  }}
                >
                  <option value="">{t('stage.noClip')}</option>
                  {clips.map(clip => (
                    <option key={`${clip.index}:${clip.name}`} value={`${clip.index}\u001f${clip.name}`}>
                      {clip.index}: {clip.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="mt-1 flex items-center gap-1">
                {t('stage.clipIndex')}
                <input
                  type="number"
                  min={0}
                  value={slot.clip?.index ?? 0}
                  onChange={event => bindClip(slot.id, Number(event.target.value) || 0, slot.clip?.name ?? '')}
                  className="w-12 rounded border border-border bg-bg-tertiary px-1 py-0.5"
                />
                {t('stage.clipName')}
                <input
                  value={slot.clip?.name ?? ''}
                  onChange={event => bindClip(slot.id, slot.clip?.index ?? 0, event.target.value)}
                  placeholder={t('stage.exactName')}
                  className="min-w-0 flex-1 rounded border border-border bg-bg-tertiary px-1 py-0.5"
                />
              </span>
            </label>
          )
        })}
      </div>
      {clipIssue && <p className="text-[8px] text-red-300">{clipIssue}</p>}
      <p className="text-[8px] text-text-muted">{t('stage.help')}</p>
      <span data-testid="scene3d-roundtrip" className="hidden">{roundtrip ? 'ok' : 'bad'}</span>
    </div>
  )
}
