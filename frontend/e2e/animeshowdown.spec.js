import { expect, test } from '@playwright/test'

async function preparePage(page) {
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))
  await page.addInitScript(() => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('animeshowdown.votar.fast', 'false')
    localStorage.setItem('animeshowdown.votos_count', '0')
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
  })
  return consoleErrors
}

async function attachVisualSmoke(page, name) {
  const shot = await page.screenshot({ fullPage: false })
  await test.info().attach(`${name}.png`, {
    body: shot,
    contentType: 'image/png',
  })
  expect(shot.length, `${name} screenshot should not be blank`).toBeGreaterThan(20_000)
}

async function registerThroughUi(page, suffix = Date.now()) {
  const username = `e2e_${suffix}`.slice(0, 24)
  const email = `${username}@example.com`
  const password = 'E2ePass123'

  await page.goto('/register')
  await page.getByLabel('Nombre de usuario').fill(username)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirma la contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.waitForURL('**/')
  await expect(page.getByRole('link', { name: 'Perfil' })).toBeVisible()
  return { username, email, password }
}

test('home renderiza sin errores y con CTA principal', async ({ page }) => {
  const consoleErrors = await preparePage(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Votar ahora' })).toBeVisible()
  await attachVisualSmoke(page, 'home-desktop')
  expect(consoleErrors).toEqual([])
})

test('registro deja sesión activa y perfil accesible', async ({ page }) => {
  const consoleErrors = await preparePage(page)
  const { username } = await registerThroughUi(page, `reg_${Date.now()}`)
  await page.goto('/perfil')
  await expect(page.getByText(username)).toBeVisible()
  await attachVisualSmoke(page, 'perfil-registrado')
  expect(consoleErrors).toEqual([])
})

test('votar 5 veces actualiza contador local del header', async ({ page }, testInfo) => {
  const consoleErrors = await preparePage(page)
  await registerThroughUi(page, `vote_${Date.now()}`)
  await page.goto('/votar')

  for (let i = 1; i <= 5; i++) {
    const voteButtons = page.locator('button[aria-label^="Votar por"]')
    await expect(voteButtons.first()).toBeVisible()
    await voteButtons.first().click()
    if (testInfo.project.name === 'chromium-desktop') {
      await expect(page.getByLabel(`${i} votos en esta sesión`)).toBeVisible()
    }
    const next = page.getByRole('button', { name: 'Siguiente duelo' })
    if (i < 5) {
      await next.click()
    }
  }

  const count = await page.evaluate(() => localStorage.getItem('animeshowdown.votos_count'))
  expect(count).toBe('5')
  await attachVisualSmoke(page, 'votar-5-votos')
  expect(consoleErrors).toEqual([])
})

test('deeplink de personaje monta 3D solo tras interacción', async ({ page }) => {
  const consoleErrors = await preparePage(page)
  await page.goto('/personajes/luffy')
  // .first() porque "Luffy" aparece en breadcrumb + h1 + section heading;
  // strict mode lo bloqueaba con "resolved to 3 elements". Solo nos
  // interesa confirmar que ALGÚN heading "Luffy" pintó, no cuál.
  await expect(page.getByRole('heading', { name: 'Luffy' }).first()).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await attachVisualSmoke(page, 'personaje-luffy-static')

  await page.getByRole('button', { name: 'Ver en 3D' }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
  await attachVisualSmoke(page, 'personaje-luffy-3d')
  expect(consoleErrors).toEqual([])
})

test('banner de anime renderiza imagen y contenido desde URL directa', async ({ page }) => {
  const consoleErrors = await preparePage(page)
  await page.goto('/animes/one-piece')
  // .first() — "One Piece" también aparece en varios headings (breadcrumb +
  // hero + sección "Personajes de One Piece"...). Mismo motivo que en el test
  // de personaje arriba.
  await expect(page.getByRole('heading', { name: 'One Piece' }).first()).toBeVisible()
  const visibleImages = await page.locator('img:visible').count()
  expect(visibleImages).toBeGreaterThan(0)
  await attachVisualSmoke(page, 'anime-one-piece')
  expect(consoleErrors).toEqual([])
})
