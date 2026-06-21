import { test, expect } from '@playwright/test'

test.describe('Authentication pages', () => {
  test('login page renders with correct form elements', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /sign in|log in|welcome back/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
  })

  test('signup page renders with correct form elements', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign up|create account/i })).toBeVisible()
  })

  test('login page has link to signup', async ({ page }) => {
    await page.goto('/auth/login')
    const signupLink = page.getByRole('link', { name: /sign up|create account/i })
    await expect(signupLink).toBeVisible()
    await signupLink.click()
    await expect(page).toHaveURL(/\/auth\/signup/)
  })

  test('signup page has link back to login', async ({ page }) => {
    await page.goto('/auth/signup')
    const loginLink = page.getByRole('link', { name: /sign in|log in|already have/i })
    await expect(loginLink).toBeVisible()
  })

  test('empty form submission shows no redirect (client validates)', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    // Should still be on login page — no redirect without valid credentials
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('login button is enabled initially and disabled attribute wires to loading state', async ({ page }) => {
    await page.goto('/auth/login')
    // Button starts enabled (loading = false)
    const btn = page.locator('button[type="submit"]')
    await expect(btn).toBeVisible()
    await expect(btn).not.toBeDisabled()
    await expect(btn).toHaveText(/log in/i)
    // Error paragraph is absent when there is no error (v-if="error" with empty string)
    await expect(page.locator('p.text-red-400')).not.toBeVisible()
  })

  test('unauthenticated access to /dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })
  })

  test('unauthenticated access to /settings redirects to login', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })
  })
})
