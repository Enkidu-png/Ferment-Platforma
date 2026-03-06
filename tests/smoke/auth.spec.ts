// tests/smoke/auth.spec.ts
// Auth route smoke tests — verifies the Phase 2 rewired sign-in/sign-up/confirm/pending pages
import { test, expect } from '@playwright/test'

// Each test starts with a fresh browser context (no shared session state)

test('sign-in page renders with email and password fields', async ({ page }) => {
  await page.goto('/sign-in')
  await page.waitForLoadState('domcontentloaded')
  // shadcn FormLabel + FormControl associate labels via context-generated IDs
  // Use role-based selectors as a reliable alternative
  await expect(page.locator('input').first()).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  // Button label is "Log in" (not "Sign in")
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
})

test('admin can sign in and is redirected away from /sign-in', async ({ page }) => {
  await page.goto('/sign-in')
  await page.waitForLoadState('domcontentloaded')
  await page.locator('input').first().fill(process.env.SEED_ADMIN_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.SEED_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /log in/i }).click()
  // After successful login, should not stay on /sign-in
  await page.waitForURL(url => !url.pathname.includes('/sign-in'), { timeout: 10_000 })
  await expect(page).not.toHaveURL(/\/sign-in/)
})

test('sign-up page renders with shopName field', async ({ page }) => {
  await page.goto('/sign-up')
  await page.waitForLoadState('domcontentloaded')
  // Three inputs: shopName (first), email (second), password (third)
  const inputs = page.locator('input')
  await expect(inputs.nth(0)).toBeVisible() // shopName
  await expect(inputs.nth(1)).toBeVisible() // email
  await expect(page.locator('input[type="password"]')).toBeVisible()
  // Verify the "Shop name" label is present
  await expect(page.getByText(/shop name/i)).toBeVisible()
})

test('/pending page renders without 404', async ({ page }) => {
  const response = await page.goto('/pending')
  expect(response?.status()).not.toBe(404)
  await expect(page.locator('body')).not.toBeEmpty()
})

test('/auth/confirm route responds without 404', async ({ page }) => {
  // Navigate with no token — will redirect or show error, but must not 404
  const response = await page.goto('/auth/confirm')
  expect(response?.status()).not.toBe(404)
})
