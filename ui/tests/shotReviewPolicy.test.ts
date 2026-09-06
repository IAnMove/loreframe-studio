import assert from 'node:assert/strict'
import test from 'node:test'

import { bulkApproveSelections } from '../src/features/series/shotReviewPolicy.ts'

const assets = new Set(['ok-a', 'ok-b', 'ok-new'])
const hasAsset = (id: string) => assets.has(id)

test('bulk approve fills pending shots and keeps an existing final', () => {
  const shots = [
    {
      id: 'shot-1',
      approvedAttemptId: 'chosen',
      attempts: [
        { id: 'chosen', status: 'completed', outputAssetIds: ['ok-a'] },
        { id: 'newer', status: 'completed', outputAssetIds: ['ok-new'] },
      ],
    },
    {
      id: 'shot-2',
      attempts: [
        { id: 'latest', status: 'completed', outputAssetIds: ['ok-b'] },
      ],
    },
    {
      id: 'shot-3',
      attempts: [
        { id: 'failed', status: 'failed', outputAssetIds: [] },
      ],
    },
  ]
  const pending = bulkApproveSelections(shots, hasAsset, { replaceFinals: false })
  assert.deepEqual(pending.selections, [{ shotId: 'shot-2', attemptId: 'latest' }])
  assert.equal(pending.kept, 1)
  assert.equal(pending.omitted, 1)
  assert.equal(pending.replaced, 0)

  const replace = bulkApproveSelections(shots, hasAsset, { replaceFinals: true })
  assert.deepEqual(replace.selections, [
    { shotId: 'shot-1', attemptId: 'newer' },
    { shotId: 'shot-2', attemptId: 'latest' },
  ])
  assert.equal(replace.replaced, 1)
})

test('explicit later attempt can still replace a final when replaceFinals is set', () => {
  const shots = [{
    id: 'shot-1',
    approvedAttemptId: 'chosen',
    attempts: [
      { id: 'chosen', status: 'completed', outputAssetIds: ['ok-a'] },
      { id: 'newer', status: 'completed', outputAssetIds: ['ok-new'] },
    ],
  }]
  const result = bulkApproveSelections(shots, hasAsset, { replaceFinals: true })
  assert.deepEqual(result.selections, [{ shotId: 'shot-1', attemptId: 'newer' }])
})
