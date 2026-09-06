import { useUiTranslation } from '../../i18n'
import { h3CatalogEntry } from '../../lib/h3Catalog'

export function H3ModelInfo({ modelType, compact = false }: { modelType: string; compact?: boolean }) {
  const { t } = useUiTranslation('studio')
  const entry = h3CatalogEntry(modelType)
  if (!entry) return null
  return <div className={`mt-1 text-[11px] text-text-muted leading-snug ${compact ? '' : 'ml-6 mb-2'}`}>
    <p>{t(`h3Catalog.${entry.variant}Hint`)}</p>
    {!compact && <details className="mt-1">
      <summary className="cursor-pointer">{t('h3Catalog.memory')}</summary>
      {entry.measured ? <>
        <p>{t('h3Catalog.measured', entry.measured)}</p>
        <p>{t('h3Catalog.conditions', { profile: entry.measured.profile })}</p>
        {entry.measured.warmOnly && <p>{t('h3Catalog.warmOnly')}</p>}
        <p>{t('h3Catalog.memoryLimit')}</p>
      </> : <p>{t('h3Catalog.unmeasured')}</p>}
      <p>{t('h3Catalog.audioLimit')}</p>
    </details>}
  </div>
}

export function H3ModelName({ modelType, fallback }: { modelType: string; fallback: string }) {
  const { t } = useUiTranslation('studio')
  const entry = h3CatalogEntry(modelType)
  if (entry?.variant !== 'fast') return <>{fallback}</>
  return <>{t('h3Catalog.fastName', { workflow: t(`h3Catalog.${entry.workflow}`) })}</>
}
