import { expect, test } from '@playwright/test'
import { closeApp, gotoApp } from '../helpers/gotoApp'

test('Story Lab full-story shell exposes the L9 destinations', async ({ page }) => {
  const session = await gotoApp(page)
  await page.getByRole('tab', { name: 'Story Lab' }).click()
  const navigation = page.getByRole('navigation', { name: 'Story Lab sections' })
  await expect(navigation).toBeVisible()
  for (const name of ['Story', 'Universe', 'Script', 'Audio', 'Generate', 'Results']) {
    await expect(navigation.getByRole('button', { name })).toBeVisible()
  }
  await navigation.getByRole('button', { name: 'Universe' }).click()
  await expect(page.getByRole('heading', { name: 'Universe' })).toBeVisible()
  await closeApp(page, session)
})

test('Story Lab empty-to-loaded chrome survives a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const session = await gotoApp(page)
  await page.getByRole('tab', { name: 'Story Lab' }).click()
  const navigation = page.getByRole('navigation', { name: 'Story Lab sections' })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Generate' })).toBeVisible()
  await closeApp(page, session)
})
