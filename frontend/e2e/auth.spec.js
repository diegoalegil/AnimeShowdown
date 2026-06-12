import { expect, test } from '@playwright/test'

const MOCK_USER = {
  id: 9001,
  username: 'auth_e2e_user',
  email: 'auth-e2e@example.com',
  avatarUrl: null,
  rol: 'USER',
  estadoVerificacion: 'VERIFICADO',
  totpHabilitado: false,
}

async function prepareAuthPage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('i18nextLng', 'es')
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
  })
}

async function mockRefresh(page, status = 204) {
  await page.route('**/api/auth/refresh', async (route) => {
    if (status === 200) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'oauth-e2e-token', usuario: MOCK_USER }),
      })
      return
    }
    await route.fulfill({ status })
  })
}

test('login con credenciales aplica sesion y respeta next seguro', async ({ page }) => {
  await prepareAuthPage(page)
  await mockRefresh(page)

  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON()
    expect(body).toEqual({
      username: MOCK_USER.username,
      password: 'E2ePass123',
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'login-e2e-token', usuario: MOCK_USER }),
    })
  })

  await page.goto('/login?next=/ranking')
  await page.getByLabel('Usuario o email').fill(MOCK_USER.username)
  await page.getByLabel('Contraseña', { exact: true }).fill('E2ePass123')
  await page.getByRole('button', { name: 'Entrar al dojo', exact: true }).click()

  await page.waitForURL('**/ranking')
  await expect(page.getByRole('link', { name: /perfil|profile/i }).first()).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('animeshowdown.user') || '{}').username))
    .toBe(MOCK_USER.username)
})

test('callback OAuth refresca sesion y consume next guardado', async ({ page }) => {
  await prepareAuthPage(page)
  await mockRefresh(page, 200)
  await page.addInitScript(() => {
    sessionStorage.setItem('animeshowdown.oauth.next', '/ranking')
  })

  await page.goto('/auth/callback')

  await page.waitForURL('**/ranking')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('animeshowdown.oauth.next')))
    .toBeNull()
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('animeshowdown.user') || '{}').username))
    .toBe(MOCK_USER.username)
})

test('callback OAuth fallido vuelve a login con estado de error', async ({ page }) => {
  await prepareAuthPage(page)
  await mockRefresh(page)

  await page.goto('/auth/callback?oauth=error')

  await page.waitForURL('**/login?oauth=error')
  await expect(page.getByRole('heading', { name: 'Entra al dojo' })).toBeVisible()
})
