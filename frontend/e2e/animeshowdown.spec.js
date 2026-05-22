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
    // Forzar idioma ES en los e2e. Sin esto, Playwright Chromium en CI
    // arranca con navigator.language=en-US y i18next-browser-languagedetector
    // (orden ['localStorage', 'navigator']) carga el bundle `en` → el aria-label
    // del link al perfil pasa a ser "My profile", el del nav a "Home", etc.
    // y los selectors del test (escritos contra el copy ES original) dejan de
    // matchear. Setear i18nextLng=es estabiliza el idioma del UI bajo test.
    localStorage.setItem('i18nextLng', 'es')
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
  // El shell puede arrancar en ES/EN/JA según el detector de idioma del
  // navegador en CI. La aserción valida que hay sesión activa sin casarse
  // con una única traducción del aria-label.
  await expect(
    page.getByRole('link', { name: /perfil|profile|プロフィール/i }).first(),
  ).toBeVisible()
  return { username, email, password }
}

test('home renderiza sin errores y con CTA principal', async ({ page }) => {
  const consoleErrors = await preparePage(page)
  await page.goto('/')
  // "Votar ahora" sale dos veces en la home (CTA del header + CTA del footer).
  // Solo necesitamos confirmar que al menos uno pintó.
  await expect(page.getByRole('link', { name: 'Votar ahora' }).first()).toBeVisible()
  await attachVisualSmoke(page, 'home-desktop')
  expect(consoleErrors).toEqual([])
})

test('registro deja sesión activa y perfil accesible', async ({ page }) => {
  const consoleErrors = await preparePage(page)
  const { username } = await registerThroughUi(page, `reg_${Date.now()}`)
  await page.goto('/perfil')
  // Restringir la búsqueda al <main> para evitar capturar el span del
  // UserBadge del header (que en viewport móvil queda display:none).
  // El .first() previo elegía ese span hidden y `toBeVisible()` fallaba
  // en chromium-mobile con "Received: hidden". El main contiene el
  // título de la card "Perfil público" + email, que siempre están
  // visibles si la sesión está hidratada.
  await expect(
    page.getByRole('main').getByText(username, { exact: true }).first(),
  ).toBeVisible()
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
    // Esperar a que el voto se haya commiteado: el botón "Saltar duelo"
    // cambia a "Siguiente duelo" cuando votedFor se setea tras un onSuccess
    // del votarMutation. Esto evita el race que tenía la antigua assertion
    // `getByLabel('${i} votos en esta sesión')` per iteración (flake en i=5
    // cuando el ms entre click+mutate y assert era demasiado justo).
    const next = page.getByRole('button', { name: 'Siguiente duelo' })
    await expect(next).toBeVisible()
    if (i < 5) {
      await next.click()
    }
  }

  // Esperar a que el último voto incremente el contador local (sucede en
  // onSuccess del votarMutation, async tras la respuesta del backend).
  // Sin este poll, el getByLabel('5 votos en esta sesión') de abajo se
  // ejecutaba antes de que el último mutate completara y fallaba.
  await expect
    .poll(
      () =>
        page.evaluate(() => localStorage.getItem('animeshowdown.votos_count')),
      { timeout: 8000 },
    )
    .toBe('5')
  if (testInfo.project.name === 'chromium-desktop') {
    await expect(page.getByLabel('5 votos en esta sesión')).toBeVisible()
  }
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

  // El botón muestra texto "Ver en 3D" pero su aria-label es
  // "Abrir vista 3D rotable de <nombre>". Cuando un elemento tiene
  // aria-label, ESE es el accessible name que ve Playwright; el texto
  // visible queda ignorado. Match por regex contra el aria-label.
  await page.getByRole('button', { name: /vista 3D rotable/i }).click()
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
