/** Shared Series take-selection policy for UI and Wizard. */

export interface ReviewableShot {
  id: string
  approvedAttemptId?: string
  attempts: Array<{
    id: string
    status?: string
    reviewDecision?: string
    outputAssetIds?: string[]
  }>
}

export interface BulkApproveOptions {
  replaceFinals?: boolean
}

export interface BulkApproveResult {
  selections: Array<{ shotId: string; attemptId: string }>
  selected: number
  kept: number
  omitted: number
  replaced: number
}

export function hasReproducibleAsset(
  attempt: { outputAssetIds?: string[] } | undefined,
  hasAsset: (assetId: string) => boolean,
): boolean {
  return Boolean(attempt?.outputAssetIds?.some(id => hasAsset(id)))
}

export function latestApprovableAttempt<T extends ReviewableShot['attempts'][number]>(
  shot: { attempts: T[] },
  hasAsset: (assetId: string) => boolean,
): T | undefined {
  return [...shot.attempts].reverse().find(item => (
    item.status === 'completed'
    && item.reviewDecision !== 'rejected'
    && hasReproducibleAsset(item, hasAsset)
  ))
}

export function bulkApproveSelections(
  shots: ReviewableShot[],
  hasAsset: (assetId: string) => boolean,
  options: BulkApproveOptions = {},
): BulkApproveResult {
  const replaceFinals = options.replaceFinals === true
  const selections: Array<{ shotId: string; attemptId: string }> = []
  let kept = 0
  let omitted = 0
  let replaced = 0
  for (const shot of shots) {
    const latest = latestApprovableAttempt(shot, hasAsset)
    if (!latest) {
      omitted += 1
      continue
    }
    const approvedId = shot.approvedAttemptId
    const approvedStillValid = Boolean(
      approvedId
      && hasReproducibleAsset(shot.attempts.find(item => item.id === approvedId), hasAsset),
    )
    if (approvedStillValid && !replaceFinals) {
      kept += 1
      continue
    }
    if (latest.id === approvedId) {
      kept += 1
      continue
    }
    selections.push({ shotId: shot.id, attemptId: latest.id })
    if (approvedStillValid) replaced += 1
  }
  return {
    selections,
    selected: selections.length,
    kept,
    omitted,
    replaced,
  }
}
