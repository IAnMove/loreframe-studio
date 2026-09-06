import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { closeApp } from '../helpers/gotoApp'
import { installApiRoutes, type ApiRouteSession } from '../helpers/apiRoutes'

const PENDING_SCENE_KEY = 'maestro_scene_animator_pending_scene'
const REVIEW_STORAGE_KEY = 'hocuspocus.scene-template-review.v1'
const CATALOG_VERSION = '2026-09-review-1'
const SAVED_OUTPUT = {
  name: 'review.scene.json',
  type: 'scene',
  mode: 'scene',
  favorite: false,
  size: 2_048,
  created_at: 1_700_000_000,
  completed_at: 1_700_000_001,
  completion_time_source: 'metadata',
  url: '/api/v1/file/review.scene.json?workspace=default',
  thumbnail_url: null,
} as const

type SceneLike = Record<string, unknown>

type ReviewRouteState = {
  postedPayloads: Array<Record<string, unknown>>
  savedScene: SceneLike | null
  outputRequests: string[]
  fileRequests: string[]
  recordingRequests: string[]
}

function reviewRouteState(): ReviewRouteState {
  return {
    postedPayloads: [],
    savedScene: null,
    outputRequests: [],
    fileRequests: [],
    recordingRequests: [],
  }
}

async function prepareReviewPage(page: Page): Promise<ApiRouteSession> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const session = await installApiRoutes(page)
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (this === window.sessionStorage && key === 'maestro_scene_animator_pending_scene') {
        originalSetItem.call(this, '__scene_template_test_handoff', value)
      }
      return originalSetItem.call(this, key, value)
    }
  })
  return session
}

async function installReviewRoutes(page: Page, state: ReviewRouteState): Promise<void> {
  await page.route('**/api/v1/character-kits/library**', async route => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 1, revision: 0, activeId: '', kits: {} }),
    })
  })

  await page.route('**/api/v1/scenes', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    const payload = route.request().postDataJSON() as Record<string, unknown>
    state.postedPayloads.push(payload)
    state.savedScene = payload.scene as SceneLike
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SAVED_OUTPUT),
    })
  })

  await page.route('**/api/v1/outputs**', async route => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    const url = new URL(route.request().url())
    state.outputRequests.push(url.href)
    if (url.searchParams.get('media_type') !== 'scene') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ outputs: state.savedScene ? [SAVED_OUTPUT] : [], total: state.savedScene ? 1 : 0 }),
    })
  })

  await page.route('**/api/v1/file/review.scene.json**', async route => {
    state.fileRequests.push(route.request().url())
    if (!state.savedScene) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'scene not saved' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.savedScene),
    })
  })

  await page.route('**/api/v1/scenes/recordings**', async route => {
    state.recordingRequests.push(route.request().url())
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'MP4 export is not part of this E2E test.' }) })
  })
}

async function openGallery(page: Page): Promise<void> {
  await page.goto('/scene-template-review')
  await expect(page.locator('section[aria-label="Galería de plantillas candidatas de Video3D"]')).toBeVisible()
  await expect(page.locator('[data-template-id]')).toHaveCount(24)
}

async function readAutosave(page: Page): Promise<SceneLike | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('maestro-scene-animator-autosave-v1')
    return raw ? JSON.parse(raw) as SceneLike : null
  })
}

test('opens cinema-establishing in the real editor, saves exact scene JSON, and reopens the saved scene', async ({ page }) => {
  const session = await prepareReviewPage(page)
  const state = reviewRouteState()
  await installReviewRoutes(page, state)

  try {
    await openGallery(page)
    const handoffCard = page.locator('[data-template-id="cinema-establishing"]')
    await handoffCard.getByTestId('open-scene-cinema-establishing').click()
    await expect(page).toHaveURL(/\/scene-template-review\?editor=1$/)

    const sceneName = page.getByLabel('Scene name', { exact: true })
    await expect(sceneName).toBeVisible()
    await expect(sceneName).toHaveValue('Plano de establecimiento · candidata')
    await expect(page.locator('model-viewer')).toHaveCount(0)

    const handoff = await page.evaluate(() => sessionStorage.getItem('__scene_template_test_handoff'))
    expect(handoff).toBeTruthy()
    const handedScene = JSON.parse(handoff!) as SceneLike
    expect(handedScene.narrative).toMatchObject({ templateId: 'cinema-establishing' })
    expect(handedScene.generationPolicy).toBe('provided_only')
    await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), PENDING_SCENE_KEY)).toBeNull()

    await sceneName.fill('Ajuste prueba')
    await page.getByRole('button', { name: 'Save scene', exact: true }).first().click()
    await expect.poll(() => state.postedPayloads.length).toBe(1)
    const postedPayload = state.postedPayloads[0]
    const postedScene = postedPayload.scene as SceneLike
    expect(postedPayload.workspace).toBe('default')
    expect(postedScene.name).toBe('Ajuste prueba')
    expect(postedScene.generationPolicy).toBe('provided_only')
    expect(postedScene.narrative).toMatchObject({
      templateId: 'cinema-establishing',
      controls: expect.objectContaining({
        catalogVersion: CATALOG_VERSION,
        templateVersion: 1,
        reviewStatus: 'candidate',
      }),
    })
    expect(SAVED_OUTPUT).toMatchObject({ name: 'review.scene.json', type: 'scene', url: expect.stringContaining('/api/v1/file/review.scene.json') })
    expect(state.recordingRequests).toHaveLength(0)

    // A later unsaved edit must not replace the persisted scene when reopening.
    await sceneName.fill('Nombre temporal no guardado')
    await page.getByRole('button', { name: 'Open scene', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Open 3D Video scene' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('review', { exact: true }).first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Open in 3D Video', exact: true }).click()

    await expect(sceneName).toHaveValue('Ajuste prueba')
    await expect.poll(() => state.fileRequests.length).toBeGreaterThan(0)
    expect(state.outputRequests.some(url => new URL(url).searchParams.get('media_type') === 'scene')).toBe(true)
    const recovered = await expect.poll(() => readAutosave(page)).toEqual(expect.objectContaining({
      name: 'Ajuste prueba',
      generationPolicy: 'provided_only',
    }))
    void recovered
    const recoveredScene = await readAutosave(page)
    expect(recoveredScene?.narrative).toMatchObject({
      templateId: 'cinema-establishing',
      controls: expect.objectContaining({ catalogVersion: CATALOG_VERSION, templateVersion: 1, reviewStatus: 'candidate' }),
    })
    expect(recoveredScene).toEqual(postedScene)
  } finally {
    await closeApp(page, session)
  }
})

test('keeps review decisions across reload and exports catalog/template versions', async ({ page }) => {
  const session = await prepareReviewPage(page)
  try {
    await openGallery(page)
    const card = page.locator('[data-template-id="cinema-establishing"]')
    const keep = card.getByRole('button', { name: 'Conservar', exact: true })
    await keep.click()
    await expect(keep).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.evaluate(key => {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : null
    }, REVIEW_STORAGE_KEY)).toMatchObject({
      catalogVersion: CATALOG_VERSION,
      choices: { 'cinema-establishing': { decision: 'keep', templateVersion: 1 } },
    })

    await page.reload()
    const reloadedKeep = page.locator('[data-template-id="cinema-establishing"]').getByRole('button', { name: 'Conservar', exact: true })
    await expect(reloadedKeep).toHaveAttribute('aria-pressed', 'true')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar revisión JSON', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(`scene-template-review-${CATALOG_VERSION}.json`)
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()
    const exported = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
      catalogVersion: string
      templates: Array<{ id: string; templateVersion: number; decision: string }>
    }
    expect(exported.catalogVersion).toBe(CATALOG_VERSION)
    expect(exported.templates).toHaveLength(24)
    expect(exported.templates.find(template => template.id === 'cinema-establishing')).toMatchObject({
      templateVersion: 1,
      decision: 'keep',
    })
  } finally {
    await closeApp(page, session)
  }
})

test('keeps one active preview player when switching candidate previews', async ({ page }) => {
  const session = await prepareReviewPage(page)
  await page.route('**/scene-template-previews/*.mp4', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'preview stub' }))
  await page.route('**/scene-template-previews/*.png', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'poster stub' }))

  try {
    await openGallery(page)
    const first = page.locator('[data-template-id="cinema-establishing"]')
    const second = page.locator('[data-template-id="music-pulse"]')
    await first.getByRole('button', { name: /Ver escena/ }).click()
    await expect(page.locator('video')).toHaveCount(1)
    await expect(first.locator('video')).toHaveCount(1)
    await second.getByRole('button', { name: /Ver escena/ }).click()
    await expect(page.locator('video')).toHaveCount(1)
    await expect(first.locator('video')).toHaveCount(0)
    await expect(second.locator('video')).toHaveCount(1)
  } finally {
    await closeApp(page, session)
  }
})
