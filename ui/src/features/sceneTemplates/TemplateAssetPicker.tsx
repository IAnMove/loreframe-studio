import { useEffect, useMemo, useState } from 'react'
import { fetchAssets, type AssetCatalogItem } from '../../api/assets'

const PAGE_SIZE = 12
const TABS = [
  { id: 'image', label: 'Imágenes' },
  { id: 'model3d', label: 'GLB / 3D' },
] as const
type PickerKind = (typeof TABS)[number]['id']

export interface TemplateAssetPickerProps {
  workspace: string
  kinds: readonly PickerKind[]
  selectedId?: string
  onPick: (asset: AssetCatalogItem) => void
  disabledReason?: (asset: AssetCatalogItem) => string | undefined
}

function previewUrlFor(asset: AssetCatalogItem, workspace: string): string | null {
  if (asset.kind !== 'image') return null
  const locations = asset.locations.filter(item => item.workspace_id === workspace)
  if (locations.length !== 1) return null
  const location = locations[0]
  const raw = location?.url
  // Only an API-relative file URL from the active workspace may enter an img tag.
  // In particular, never use asset.url as a cross-workspace or remote fallback.
  if (!raw || /[\\/]/.test(location.filename)
    || raw !== `/api/v1/file/${encodeURIComponent(location.filename)}?workspace=${encodeURIComponent(workspace)}`) return null
  try {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const parsed = new URL(raw, origin)
    if (parsed.origin !== origin || !parsed.pathname.startsWith('/api/v1/file/')) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function assetStatusLabel(status: AssetCatalogItem['metadata_status']): string {
  if (status === 'canonical') return 'Metadatos canónicos'
  if (status === 'missing') return 'Metadatos ausentes'
  if (status === 'invalid') return 'Metadatos no válidos'
  if (status === 'unreadable') return 'Metadatos ilegibles'
  return 'Metadatos heredados'
}

export function TemplateAssetPicker({
  workspace,
  kinds,
  selectedId,
  onPick,
  disabledReason,
}: TemplateAssetPickerProps) {
  const allowedKinds = useMemo(() => new Set(kinds), [kinds])
  const [kind, setKind] = useState<PickerKind>(kinds[0] || 'image')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [previewErrors, setPreviewErrors] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<{ query: string; assets: AssetCatalogItem[]; total: number; error: string }>({ query: '', assets: [], total: 0, error: '' })

  const activeKind = allowedKinds.has(kind) ? kind : (kinds[0] || 'image')
  const queryKey = `${workspace}\u0000${activeKind}\u0000${search}\u0000${offset}\u0000${retry}`

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    fetchAssets({
      workspace,
      kind: activeKind,
      search: search.trim() || undefined,
      limit: PAGE_SIZE,
      offset,
      signal: controller.signal,
    }).then(result => {
      if (!active || controller.signal.aborted) return
      setResult({ query: queryKey, assets: result.assets, total: result.total, error: '' })
    }).catch(reason => {
      if (!active || controller.signal.aborted) return
      setResult({ query: queryKey, assets: [], total: 0, error: reason instanceof Error ? reason.message : 'No se pudieron cargar los assets.' })
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [activeKind, offset, queryKey, search, workspace])

  const loading = result.query !== queryKey
  const error = result.query === queryKey ? result.error : ''
  const visibleAssets = result.query === queryKey && !error ? result.assets : []
  const total = result.query === queryKey && !error ? result.total : 0
  const hasPrevious = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  const reasonFor = (asset: AssetCatalogItem): string | undefined => {
    if (asset.kind !== activeKind) return 'Tipo incompatible con este filtro.'
    return disabledReason?.(asset)
  }

  return (
    <section aria-label="Selector de assets de plantilla" className="space-y-3 rounded-xl border border-border bg-bg-secondary/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-[10px] font-medium text-text-secondary">
          Buscar en la Library
          <input
            type="search"
            value={search}
            onChange={event => { setSearch(event.target.value); setOffset(0) }}
            placeholder="Nombre o texto…"
            className="mt-1 w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue"
            aria-label="Buscar assets"
          />
        </label>
        <div role="tablist" aria-label="Tipo de asset" className="flex rounded-md border border-border bg-bg-tertiary p-0.5">
          {TABS.map(tab => {
            const enabled = allowedKinds.has(tab.id)
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeKind === tab.id}
                disabled={!enabled}
                title={enabled ? undefined : 'Este tipo no está permitido para esta plantilla.'}
                onClick={() => { setKind(tab.id); setOffset(0) }}
                className={`rounded px-2.5 py-1.5 text-[10px] ${activeKind === tab.id ? 'bg-accent-blue/15 text-accent-blue' : 'text-text-muted hover:bg-bg-hover'} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {tab.label}
                {!enabled && <span className="ml-1 text-[9px]">× no disponible</span>}
              </button>
            )
          })}
        </div>
      </div>

      {loading && <p role="status" className="py-4 text-center text-xs text-text-muted">Cargando assets…</p>}
      {error && !loading && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <span>No se pudo cargar la Library: {error}</span>
          <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded border border-red-300/40 px-2 py-1 text-[10px] hover:bg-red-400/10">Reintentar</button>
        </div>
      )}

      {!loading && !error && result.query === queryKey && visibleAssets.length === 0 && (
        <p className="py-4 text-center text-xs text-text-muted">No hay assets de este tipo en este workspace.</p>
      )}

      {visibleAssets.length > 0 && (
        <ul aria-label={`Assets ${activeKind}`} className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {visibleAssets.map(asset => {
            const disabled = reasonFor(asset)
            const previewUrl = previewUrlFor(asset, workspace)
            const previewKey = `${queryKey}|${asset.id}`
            const previewFailed = previewErrors[previewKey] === true
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  aria-label={`Seleccionar ${asset.filename}`}
                  aria-pressed={selectedId === asset.id}
                  disabled={Boolean(disabled)}
                  title={disabled}
                  onClick={() => onPick(asset)}
                  className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedId === asset.id ? 'border-accent-blue bg-accent-blue/10' : 'border-border bg-bg-tertiary hover:border-accent-blue/60'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <div className="flex h-20 items-center justify-center overflow-hidden rounded bg-black/20">
                    {asset.kind === 'model3d' ? (
                      <span className="text-[10px] text-text-muted">GLB · vista previa 3D no disponible aquí</span>
                    ) : previewFailed ? (
                      <span className="px-2 text-center text-[10px] text-amber-200">Preview no disponible</span>
                    ) : previewUrl ? (
                      <img src={previewUrl} alt={`Vista previa de ${asset.filename}`} className="h-full w-full object-contain" onError={() => setPreviewErrors(current => ({ ...current, [previewKey]: true }))} />
                    ) : (
                      <span className="px-2 text-center text-[10px] text-text-muted">Preview no disponible en este workspace</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-medium text-text-primary" title={asset.filename}>{asset.filename}</span>
                    <span className="shrink-0 text-[9px] text-text-muted">{asset.kind === 'model3d' ? 'GLB' : 'Imagen'}</span>
                  </div>
                  <span className="mt-1 block text-[9px] text-text-muted">{assetStatusLabel(asset.metadata_status)}</span>
                  {disabled && <span className="mt-1 block text-[10px] text-amber-200">{disabled}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        <span>{total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} de ${total}` : 'Sin resultados'}</span>
        <div className="flex gap-1">
          <button type="button" disabled={!hasPrevious || loading} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))} className="rounded border border-border px-2 py-1 disabled:opacity-40">Anterior</button>
          <button type="button" disabled={!hasNext || loading} onClick={() => setOffset(value => value + PAGE_SIZE)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      </div>
    </section>
  )
}
