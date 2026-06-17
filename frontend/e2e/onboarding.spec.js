import { expect, test } from '@playwright/test'

// El kumite de iniciación (TrainingKumite): el único spec donde el gate
// 'onboarding.v1' queda ABIERTO a propósito — el resto de specs lo cierran
// en sus helpers para que el entrenamiento no secuestre sus flujos.
//
// Cobertura deliberadamente determinista y sin backend: el kumite aparece para
// el candidato (autenticado + gate ausente + /votar + catálogo con ≥3 cartas)
// y su práctica es autocontenida (duelo y búsqueda de mentira, sin red). Solo
// depende del catálogo, que aquí se sirve mockeado. El avance por gesto real se
// cubre en el harness visual de la pieza.

const CATALOG_STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'

// El kumite exige ≥3 personajes (izquierda, derecha y objetivo de búsqueda).
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
  {
    slug: 'luffy',
    nombre: 'Monkey D. Luffy',
    anime: 'One Piece',
    imagenUrl: '/img/OnePiece/luffy.webp',
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
    // OJO: aquí NO se cierra 'onboarding.v1' — este spec ES el del kumite.
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

const kumite = (page) =>
  page.getByRole('dialog', { name: /Kumite de iniciación/ })

test('el candidato ve el kumite de iniciación al pisar /votar', async ({ page }) => {
  await prepareCandidatePage(page)
  await page.goto('/votar')

  await expect(kumite(page)).toBeVisible({ timeout: 15_000 })
  // Arranca por el primer ejercicio (el voto).
  await expect(kumite(page)).toContainText('Ejercicio 1 de 4')
  // Saltable SIEMPRE: el botón "Ya entrené" está disponible de entrada.
  await expect(kumite(page).getByRole('button', { name: 'Ya entrené' })).toBeVisible()
})

test('Escape salta el kumite, fija el gate y no reaparece al recargar', async ({ page }) => {
  await prepareCandidatePage(page)
  await page.goto('/votar')
  await expect(kumite(page)).toBeVisible({ timeout: 15_000 })

  await page.keyboard.press('Escape')
  await expect(kumite(page)).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('onboarding.v1')))
    .toBe('skipped')

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(kumite(page)).toHaveCount(0)
})

test('con el gate cerrado el kumite no existe', async ({ page }) => {
  await prepareCandidatePage(page)
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.v1', 'done')
  })
  await page.goto('/votar')
  await page.waitForLoadState('networkidle')
  await expect(kumite(page)).toHaveCount(0)
})
