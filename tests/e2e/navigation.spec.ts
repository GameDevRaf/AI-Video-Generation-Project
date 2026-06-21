import { test, expect } from '@playwright/test'

test.describe('Public pages and navigation', () => {
  test('home page loads without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    expect(errors).toHaveLength(0)
  })

  test('login page loads in under 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/auth/login')
    expect(Date.now() - start).toBeLessThan(5000)
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('signup page loads in under 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/auth/signup')
    expect(Date.now() - start).toBeLessThan(5000)
    await expect(page).toHaveURL(/\/auth\/signup/)
  })

  test('unknown route does not crash — redirects or 404', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist-abc')
    // Should either return 404 or redirect to login (auth middleware)
    expect([404, 200, 302]).toContain(response?.status())
  })

  test('page titles are set', async ({ page }) => {
    await page.goto('/auth/login')
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
  })

  test('no console errors on login page load', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    await page.goto('/auth/login')
    // Filter out known browser noise (extensions, etc.)
    const appErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('extension')
    )
    expect(appErrors).toHaveLength(0)
  })

  test('login form is keyboard-navigable', async ({ page }) => {
    await page.goto('/auth/login')
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
  })
})
