import type { ApiOutput } from '../../api/outputs'

export function formatAssetDate(item: ApiOutput, locale?: string) {
  const stamp = item.completed_at || item.created_at
  if (!Number.isFinite(stamp) || stamp <= 0) return ''
  return new Date(stamp * 1000).toLocaleString(locale)
}

export function assetPreviewUrl(item: ApiOutput) {
  if (item.thumbnail_url) return item.thumbnail_url
  if (item.type === 'image') return item.url
  return ''
}
