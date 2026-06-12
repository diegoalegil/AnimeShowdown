import { expect, test } from '@playwright/test'

// El combate guiado (FirstDuelTour): el único spec donde el gate
// 'onboarding.v1' queda ABIERTO a propósito — el resto de specs lo cierran
// en sus helpers para que el tour no secuestre sus flujos.
//
// Cobertura deliberadamente determinista y sin backend: la guía aparece para
// el candidato (autenticado + gate ausente + /votar) AUNQUE las APIs de la
// arena fallen (el telón queda sin hueco y la guía sigue operativa — es un
// requisito del spec del tour, no un accidente). El avance por voto real se
// cubre en el harness visual de la pieza.

const CATALOG_STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'

const CATALOG = [
  {
    slug: 'goku',
    nombre: 'Goku',
    anime: 'Dragon Ball',
    imagenUrl: '/img/DragonBall/goku.webp',
    imagenColorDominante: '#e0a13c',
  },
  {
    slug: 'naruto',
    nombre: 'Naruto Uzumaki',
    anime: 'Naruto',
    imagenUrl: '/img/Naruto/naruto.webp',
    imagenColorDominante: '#e0a13c',
  },
]

const MOCK_USER = {
  id: 9401,
  username: 'onboarding_e2e_user',
  email: 'onboarding-e2e@example.com',
  avatarUrl: null,
  rol: 'USER',
  estadoVerificacion: 'VERIFICADO',
  totpHabilitado: false,
}

async function prepareCandidatePage(page) {
  await page.addInitScript((catalog) => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('i18nextLng', 'es')
    localStorage.setItem(catalog.key, JSON.stringify(catalog.data))
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
    // OJO: aquí NO se cierra 'onboarding.v1' — este spec ES el del tour.
  }, { key: CATALOG_STORAGE_KEY, data: CATALOG })
  await page.addInitScript((user) => {
    localStorage.setItem('animeshowdown.user', JSON.stringify(user))
  }, MOCK_USER)
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'onboarding-e2e-token', usuario: MOCK_USER }),
    })
  })
  await page.route('**/api/personajes/catalogo**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG),
    })
  })
}

const guia = (page) => page.getByRole('dialog', { name: /Combate guiado/ })

test('el candidato ve el combate guiado al pisar /votar', async ({ page }) => {
  await prepareCandidatePage(page)
  await page.goto('/votar')

  await expect(guia(page)).toBeVisible({ timeout: 15_000 })
  await expect(guia(page)).toContainText('Tu primer duelo decide.')
  // Skip siempre visible (regla dura del spec del tour).
  await expect(guia(page).getByRole('button', { name: 'Saltar el tour' })).toBeVisible()
})

test('Escape salta el tour, fija el gate y no reaparece al recargar', async ({ page }) => {
  await prepareCandidatePage(page)
  await page.goto('/votar')
  await expect(guia(page)).toBeVisible({ timeout: 15_000 })

  await page.keyboard.press('Escape')
  await expect(guia(page)).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('onboarding.v1')))
    .toBe('skipped')

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(guia(page)).toHaveCount(0)
})

test('con el gate cerrado el tour no existe', async ({ page }) => {
  await prepareCandidatePage(page)
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.v1', 'done')
  })
  await page.goto('/votar')
  await page.waitForLoadState('networkidle')
  await expect(guia(page)).toHaveCount(0)
})
