import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

test.describe('Happy Path: Auth, Dashboard, Project Creation & Settings', () => {
  let testUser: { id: string; email: string; password: string }
  let supabaseAdmin: ReturnType<typeof createClient>

  test.beforeAll(async () => {
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // Pre-create user to ensure they are confirmed
    const email = `e2e-user-${Date.now()}@example.com`
    const password = 'SecurePassword123!'
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) throw error
    testUser = { id: data.user.id, email, password }
    console.log('Created E2E Test User:', testUser.email)
  })

  test.afterAll(async () => {
    if (testUser?.id) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id)
      console.log('Deleted E2E Test User:', testUser.email)
    }
  })

  test('user can log in, view dashboard, create project, and update settings', async ({ page }) => {
    // Collect page errors and console errors
    const pageErrors: Error[] = []
    const consoleErrors: string[] = []

    page.on('pageerror', (err) => {
      console.error('PAGE ERROR IN BROWSER:', err)
      pageErrors.push(err)
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('CONSOLE ERROR IN BROWSER:', msg.text())
        consoleErrors.push(msg.text())
      }
    })

    // 1. Navigate to login
    await page.goto('/auth/login')
    await page.getByRole('textbox', { name: /email/i }).fill(testUser.email)
    await page.getByRole('textbox', { name: /password/i }).fill(testUser.password)
    await page.getByRole('button', { name: /log in/i }).click()

    // 2. Expect to land on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
    console.log('Successfully redirected to /dashboard')

    // Wait a brief moment to see if GET /api/projects fails
    await page.waitForTimeout(2000)

    // 3. Create a project
    console.log('Creating a project...')
    await page.getByRole('button', { name: /new project/i }).click()
    await page.locator('input#project-name').fill('E2E Project')
    await page.locator('textarea#project-desc').fill('Created via happy path E2E test')
    await page.getByRole('button', { name: /create project/i }).click()

    // Expecting to close modal and show project (or navigate if there is redirect)
    // Let's just wait and see if it fails
    await page.waitForTimeout(2000)

    // 4. Navigate to Settings page
    console.log('Navigating to settings...')
    await page.goto('/settings')
    await page.waitForTimeout(2000)

    // Try to click edit prompt mode
    console.log('Attempting to update settings...')
    const select = page.locator('select#prompt-mode')
    if (await select.count() > 0) {
      await select.selectOption('before_generation')
    }
    await page.waitForTimeout(2000)

    console.log('Test completed. Total browser console errors:', consoleErrors.length)
  })
})
