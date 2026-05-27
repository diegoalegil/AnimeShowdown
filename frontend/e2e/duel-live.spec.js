/* global process */
import { expect, test } from '@playwright/test'

const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8080'
const PASSWORD = 'E2ePass123'

async function loginContext(context, suffix) {
  const username = `pvp_${suffix}_${Date.now()}`.slice(0, 24)
  const email = `${username}@example.com`
  await context.request.post(`${API_URL}/api/auth/registro`, {
    data: { username, email, password: PASSWORD },
  })
  const login = await context.request.post(`${API_URL}/api/auth/login`, {
    data: { username, password: PASSWORD },
  })
  expect(login.ok()).toBeTruthy()
  const payload = await login.json()
  await context.addInitScript((usuario) => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('animeshowdown.votar.fast', 'false')
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
    localStorage.setItem('animeshowdown.user', JSON.stringify(usuario))
  }, payload.usuario)
  return { username, token: payload.token }
}

async function setApiClientIp(context, ip) {
  await context.route(`${API_URL}/**`, async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'cf-connecting-ip': ip,
      },
    })
  })
}

async function voteWhenReady(page, label) {
  const button = page.getByRole('button', { name: new RegExp(`Votar ${label}`, 'i') }).first()
  await expect(button).toBeEnabled({ timeout: 20_000 })
  await button.click()
}

async function finished(page) {
  return page.getByText('Resultado final').isVisible().catch(() => false)
}

async function expectPvpEloChanged(page) {
  await expect(page.getByText('ELO PvP')).toBeVisible()
  await expect(
    page
      .locator('#main-content .tabular-nums')
      .filter({ hasText: /^(1016|984)$/ })
      .first(),
  ).toBeVisible()
}

test('duel-live empareja dos usuarios, completa duelo y refleja ELO PvP', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'El PvP multi-context se cubre una vez en desktop para no duplicar carga.')

  const contextA = await browser.newContext({
    baseURL,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1366, height: 900 },
  })
  const contextB = await browser.newContext({
    baseURL,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1366, height: 900 },
  })
  await setApiClientIp(contextA, '203.0.113.10')
  await setApiClientIp(contextB, '203.0.113.11')

  try {
    await loginContext(contextA, 'a')
    await loginContext(contextB, 'b')
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await Promise.all([pageA.goto('/duel-live'), pageB.goto('/duel-live')])
    await expect(pageA.getByRole('heading', { name: 'Duelo 1v1 en directo' })).toBeVisible()
    await expect(pageB.getByRole('heading', { name: 'Duelo 1v1 en directo' })).toBeVisible()

    await pageA.getByRole('button', { name: 'Entrar en cola PvP' }).click()
    await pageB.getByRole('button', { name: 'Entrar en cola PvP' }).click()

    await expect(pageA.getByText(/Ronda 1|Resultado final/)).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText(/Ronda 1|Resultado final/)).toBeVisible({ timeout: 20_000 })

    for (let attempt = 0; attempt < 14; attempt += 1) {
      if (await finished(pageA)) break
      await Promise.all([
        voteWhenReady(pageA, 'A'),
        voteWhenReady(pageB, 'B'),
      ])
      await pageA.waitForTimeout(1_300)
    }

    await expect(pageA.getByText('Resultado final')).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText('Resultado final')).toBeVisible({ timeout: 20_000 })
    await expect(pageA.getByText(/Victoria|Derrota/)).toBeVisible()
    await expect(pageB.getByText(/Victoria|Derrota/)).toBeVisible()

    await pageA.goto('/perfil')
    await pageB.goto('/perfil')
    await expectPvpEloChanged(pageA)
    await expectPvpEloChanged(pageB)
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
