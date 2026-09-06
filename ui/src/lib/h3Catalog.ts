/** Observations from the paired 2026-09-06 benchmark, not hardware minima.
 * Source: docs/development/H3_BENCHMARK_2026-09-06.md.
 * GPU includes allocator reservations; PSS includes server children.
 */
export interface H3CatalogEntry {
  variant: 'pruned' | 'full' | 'fast' | 'legacy'
  workflow: 'frames' | 'references'
  measured?: { ram: number; vram: number; profile: number; warmOnly?: boolean }
}

const entries: Record<string, H3CatalogEntry> = {
  minimax_h3: { variant: 'pruned', workflow: 'frames', measured: { ram: 34.4, vram: 21.5, profile: 3 } },
  minimax_h3_full: { variant: 'full', workflow: 'frames', measured: { ram: 37.1, vram: 21.2, profile: 3 } },
  minimax_h3_ref2va: { variant: 'pruned', workflow: 'references', measured: { ram: 38.3, vram: 21.6, profile: 3 } },
  minimax_h3_ref2va_full: { variant: 'full', workflow: 'references', measured: { ram: 42.1, vram: 21.3, profile: 3.5 } },
  // Cold process RAM sample was inconsistent and is excluded, not silently repaired.
  minimax_h3_fused_turbo: { variant: 'fast', workflow: 'frames', measured: { ram: 40.6, vram: 21.1, profile: 3, warmOnly: true } },
  minimax_h3_ref2va_fused_turbo: { variant: 'fast', workflow: 'references', measured: { ram: 39.9, vram: 21.4, profile: 3 } },
  minimax_h3_legacy: { variant: 'legacy', workflow: 'frames' },
}

export function h3CatalogEntry(modelType: string): H3CatalogEntry | undefined {
  return Object.hasOwn(entries, modelType) ? entries[modelType] : undefined
}
