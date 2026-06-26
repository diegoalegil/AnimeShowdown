import { expect, test } from '@playwright/test'

async function preparePage(page) {
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))
  // El beacon de embudo (navigator.sendBeacon → POST /api/funnel/event) es
  // telemetría fire-and-forget. En e2e el front se sirve en 127.0.0.1, que es
  // cross-site respecto al API, así que el POST se bloquea con
  // ERR_BLOCKED_BY_RESPONSE.NotSameSite y ensucia la aserción "sin errores de
  // consola". En prod front y API son same-site (*.animeshowdown.dev) y el
  // endpoint responde 204 — lo replicamos aquí para no medir la peculiaridad
  // del entorno de test.
  await page.route('**/api/funnel/event**', (route) => route.fulfill({ status: 204 }))
  await page.addInitScript(() => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('animeshowdown.votar.fast', 'false')
    localStorage.setItem('animeshowdown.votos_count', '0')
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
    // Los specs generales no van del combate guiado: gate cerrado para que
    // el tour (que navega solo tras el primer voto) no secuestre el flujo.
    // El tour tiene su spec propio: onboarding.spec.js.
    localStorage.setItem('onboarding.v1', 'done')
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
  // El rito de registro (RegisterRite) exige sellar el juramento (consentimiento
  // explícito de términos/privacidad) antes de alistarse. El <input> del
  // checkbox está visualmente oculto (sr-only), así que clicamos su <label>
  // asociado (htmlFor="juramento"), que togglea el checkbox de forma nativa.
  await page.locator('label[for="juramento"]').click()
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

test('votar 5 veces incrementa el contador local de sesión', async ({ page }) => {
  // El badge numérico del botón Votar se retiró del header (UX: acumulaba un
  // número incómodo). El contador localStorage 'animeshowdown.votos_count' se
  // mantiene como instrumentación invisible: es el ground-truth determinista
  // de que el voto se registró (el texto del botón es optimista/transitorio).
  const consoleErrors = await preparePage(page)
  await registerThroughUi(page, `vote_${Date.now()}`)
  await page.goto('/votar')

  let acceptedVotes = 0
  for (let attempts = 0; acceptedVotes < 5 && attempts < 15; attempts++) {
    const voteButtons = page.locator('button[aria-label^="Votar por"]')
    await expect(voteButtons.first()).toBeVisible()
    await voteButtons.first().click()

    // El click setea votedFor de forma optimista y cambia el botón a
    // "Siguiente duelo" antes de que el backend confirme. Si el endpoint
    // devuelve 409 porque el duelo ya estaba votado, localStorage NO sube.
    // Por eso el ground truth del test es el contador local, no el texto
    // transitorio del botón.
    const target = acceptedVotes + 1
    const committed = await page
      .waitForFunction(
        (expected) =>
          localStorage.getItem('animeshowdown.votos_count') === String(expected),
        target,
        { timeout: 5000 },
      )
      .then(() => true)
      .catch(() => false)

    if (committed) {
      acceptedVotes = target
    }

    if (acceptedVotes < 5) {
      const next = page.getByRole('button', { name: 'Siguiente duelo' })
      const skip = page.getByRole('button', { name: 'Saltar duelo' })
      if (await next.isVisible().catch(() => false)) {
        await next.click()
      } else {
        await skip.click()
      }
    }
  }

  // El ground-truth es el contador localStorage (loop arriba). El badge
  // numérico del header se retiró (UX), así que ya no se asercia su DOM.
  expect(acceptedVotes).toBe(5)
  await attachVisualSmoke(page, 'votar-5-votos')
  // Durante el retry loop podemos tocar un enfrentamiento ya votado.
  // El producto lo maneja con toast + skip, pero Chromium registra el
  // 409 como console error de red. Ese caso es parte esperada del test;
  // cualquier otro error de consola sigue fallando.
  expect(
    consoleErrors.filter(
      (msg) => !msg.includes('Failed to load resource: the server responded with a status of 409'),
    ),
  ).toEqual([])
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
