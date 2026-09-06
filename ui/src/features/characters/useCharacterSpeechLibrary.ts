import { useEffect, useRef, useState } from 'react'
import { fetchCharacterKitLibrary, saveCharacterKit, uploadImage } from '../../api/client'
import { createCharacterKit, type CharacterKit, type CharacterKitLibrary } from '../../lib/characterKit'
import { useUiTranslation } from '../../i18n'

export const speechLibraryServices = { load: fetchCharacterKitLibrary, save: saveCharacterKit, upload: uploadImage }
export type SpeechLibraryServices = typeof speechLibraryServices

/** The owner is keyed by workspace. Late completions never write into a new owner. */
export function useCharacterSpeechLibrary(workspace: string, services: SpeechLibraryServices) {
  const { t } = useUiTranslation('characters')
  const [library, setLibrary] = useState<CharacterKitLibrary | null>(null)
  const [draft, setDraft] = useState<CharacterKit | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const epoch = useRef<object | null>(null)
  const operation = useRef(false)
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(library?.kits[draft.id]))

  useEffect(() => {
    const owner = {}
    epoch.current = owner
    void services.load(workspace).then(result => {
      if (epoch.current !== owner) return
      setLibrary(result)
      setDraft(result.kits[result.activeId] ?? Object.values(result.kits)[0] ?? null)
    }).catch(cause => {
      if (epoch.current === owner) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => { if (epoch.current === owner) setBusy(false) })
    return () => { epoch.current = null }
  }, [workspace, services])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const run = async (work: (current: () => boolean) => Promise<void>) => {
    if (operation.current || !epoch.current) return
    const owner = epoch.current
    operation.current = true
    setBusy(true); setError(null); setStatus('')
    try { await work(() => epoch.current === owner) }
    catch (cause) { if (epoch.current === owner) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally {
      operation.current = false
      if (epoch.current === owner) setBusy(false)
    }
  }

  const change = (next: CharacterKit) => {
    if (operation.current || !epoch.current) return
    setDraft(current => current?.id === next.id ? next : current)
    setStatus('')
  }

  const select = (id: string) => {
    if (busy || dirty || !library) return
    setDraft(library.kits[id] ?? null); setStatus(''); setError(null)
  }

  const importBase = (name: string, file: File) => {
    if (busy || dirty || !library) return
    if (!name.trim() || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 20 * 1024 * 1024) {
      setError(t('speechWorkshop.invalidImport')); return
    }
    void run(async current => {
      const uploaded = await services.upload(file)
      if (!current()) return
      const source = uploaded.url || (uploaded.filename ? `/api/v1/uploads/${encodeURIComponent(uploaded.filename)}` : '')
      if (!source) throw new Error(t('speechWorkshop.invalidUpload'))
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
      const suffix = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
      const kit = createCharacterKit(name)
      kit.id = `speech-${suffix}`
      kit.base = { id: `${kit.id}-base`, name: name.trim(), source, kind: 'image', alphaStatus: 'unknown', reviewState: 'pending', workspace }
      kit.identityReference = { ...kit.base }
      kit.provenance = [{ method: 'character-speech-base-import', source, workspace, importedAt: new Date().toISOString() }]
      setDraft(kit); setStatus(t('speechWorkshop.imported'))
    })
  }

  const save = () => {
    if (busy || !draft || !library || !dirty) return
    const snapshot = draft
    void run(async current => {
      const result = await services.save(workspace, library, snapshot)
      if (!current()) return
      if (!result.kits[snapshot.id]) throw new Error(t('speechWorkshop.invalidSave'))
      setLibrary(result); setDraft(result.kits[snapshot.id]); setStatus(t('speechWorkshop.saved'))
    })
  }

  // Explicit discard is the only way to reload over local edits after a 409.
  const reload = () => {
    if (busy) return
    void run(async current => {
      const result = await services.load(workspace)
      if (!current()) return
      setLibrary(result)
      setDraft(result.kits[draft?.id ?? result.activeId] ?? null)
    })
  }

  return { library, draft, busy, dirty, error, status, setStatus, change, select, importBase, save, reload }
}
