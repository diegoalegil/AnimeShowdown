import { expect, test } from '@playwright/test'

const CATALOG_STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'

const CATALOG = [
  {
    id: 1,
    slug: 'luffy',
    nombre: 'Luffy',
    anime: 'One Piece',
    imagenUrl: '/img/One_Piece/luffy.webp',
    imagenColorDominante: '#c95b3f',
  },
  {
    id: 2,
    slug: 'zoro',
    nombre: 'Zoro',
    anime: 'One Piece',
    imagenUrl: '/img/One_Piece/zoro.webp',
    imagenColorDominante: '#2f8b57',
  },
  {
    id: 3,
    slug: 'naruto',
    nombre: 'Naruto',
    anime: 'Naruto',
    imagenUrl: '/img/Naruto/naruto.webp',
    imagenColorDominante: '#e0a13c',
  },
  {
    id: 4,
    slug: 'sasuke',
    nombre: 'Sasuke',
    anime: 'Naruto',
    imagenUrl: '/img/Naruto/naruto.webp',
    imagenColorDominante: '#5b6f9f',
  },
]

async function prepareCriticalPage(page) {
  await page.addInitScript((catalog) => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('animeshowdown.votar.fast', 'false')
    localStorage.setItem('i18nextLng', 'es')
    // El kumite de onboarding tiene su propio spec; aquí se cierra para que no
    // tape el duelo en /votar (ahora arranca también para invitados).
    localStorage.setItem('onboarding.v1', 'done')
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog))
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
  }, CATALOG)

  await page.route('**/api/personajes/catalogo**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG),
    })
  })

  await page.route('**/api/personajes/buscar**', async (route) => {
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q')?.toLowerCase() ?? ''
    const results = CATALOG.filter((personaje) =>
      `${personaje.nombre} ${personaje.anime} ${personaje.slug}`.toLowerCase().includes(query),
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(results),
    })
  })

  await page.route('**/api/enfrentamientos/aleatorio', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })

  await page.route('**/api/votos/ranking/segmentado**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/personajes/*/elo-history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

test('votar un duelo fijado actualiza el ranking local y mantiene el matchup exacto', async ({ page }) => {
  await prepareCriticalPage(page)
  await page.goto('/votar?personaje=luffy&rival=zoro')

  await expect(page.getByText('Luffy vs Zoro').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Votar.*Luffy.*One Piece/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Votar.*Zoro.*One Piece/i })).toBeVisible()

  await page.getByRole('button', { name: /Votar.*Luffy.*One Piece/i }).click()
  await expect(page.getByText('Luffy ganó tu duelo.')).toBeVisible()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('animeshowdown.local-votes.v1')
        return raw ? JSON.parse(raw).length : 0
      }),
    )
    .toBe(1)

  await page.getByRole('button', { name: /Siguiente duelo/i }).click()
  await expect(page.getByText('Luffy vs Zoro').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Votar.*Luffy.*One Piece/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Votar.*Zoro.*One Piece/i })).toBeVisible()

  await page.goto('/mi-ranking')
  const main = page.getByRole('main')
  // El expediente muestra el voto como una placa cuyo nombre accesible reúne
  // personaje + anime ("Puesto 1: Luffy, One Piece"). Afinamos a la placa: el
  // retrato decorativo (aria-hidden) repite el anime como texto de placeholder
  // de imagen y su visibilidad depende de si la imagen cargó, así que un
  // getByText laxo cazaría ese nodo frágil en vez del dato del expediente.
  await expect(main.getByRole('listitem', { name: /Luffy, One Piece/i })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('animeshowdown.local-votes.v1')
        return raw ? JSON.parse(raw)[0]?.ganadorSlug : null
      }),
    )
    .toBe('luffy')
})

test('RankingPage sincroniza el tab activo con la URL y lo conserva al recargar', async ({ page }) => {
  await prepareCriticalPage(page)
  await page.goto('/ranking')

  const historicalTab = page.getByRole('tab', { name: /Histórico/i })
  await historicalTab.click()
  await expect(page).toHaveURL(/\/ranking\?tab=all$/)
  await expect(historicalTab).toHaveAttribute('aria-selected', 'true')

  await page.reload()
  await expect(page.getByRole('tab', { name: /Histórico/i })).toHaveAttribute('aria-selected', 'true')
})

test('PersonajesPage persiste la busqueda en query string y la rehidrata', async ({ page }) => {
  await prepareCriticalPage(page)
  await page.goto('/personajes')

  const search = page.getByRole('combobox', { name: 'Buscar personajes' })
  await search.fill('Luffy')
  await expect(page).toHaveURL(/\/personajes\?q=Luffy/)
  await expect(page.getByRole('link', { name: /Luffy/i }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Buscar personajes' })).toHaveValue('Luffy')
  await expect(page.getByRole('link', { name: /Luffy/i }).first()).toBeVisible()
})

test('prefers-reduced-motion desactiva animaciones decorativas clave', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await prepareCriticalPage(page)
  await page.goto('/')

  // La capa de luz del hogar respira en bucle (cross-fade de opacity);
  // con reduced-motion el kill-switch CSS del hearth la deja en seco.
  const glow = page.locator('.hearth-glow').first()
  await expect(glow).toBeVisible()
  await expect
    .poll(() =>
      glow.evaluate((element) => {
        const style = window.getComputedStyle(element)
        return {
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          animationName: style.animationName,
        }
      }),
    )
    .toEqual({
      reducedMotion: true,
      animationName: 'none',
    })
})

test('la navegacion movil no tapa el contenido final al hacer scroll al fondo', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'La prueba fija un viewport movil manual para evitar duplicado por proyecto.',
  )

  await prepareCriticalPage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ranking')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

  const nav = page.locator('nav[aria-label="Navegación móvil principal"]')
  const footer = page.locator('footer')
  await expect(nav).toBeVisible()
  await expect(footer).toBeVisible()

  // El fondo de página puede asentarse un par de frames después del scroll
  // (contenido lazy / fuentes), así que MEDIMOS CON POLL: leer una sola vez
  // justo tras el scroll capturaba en CI un estado intermedio (clearance
  // negativo esporádico) que se corregía al asentar. El poll reintenta la
  // medición hasta que el hueco es real.
  const medirClearance = () =>
    page.evaluate(() => {
      // Re-scrollea al fondo en CADA medición: el contenido lazy / las fuentes
      // pueden crecer la página tras el scroll inicial, dejándonos a media
      // altura y midiendo un solapamiento que ya no es el estado final.
      window.scrollTo(0, document.documentElement.scrollHeight)
      const navRect = document
        .querySelector('nav[aria-label="Navegación móvil principal"]')
        ?.getBoundingClientRect()
      const footerLinks = Array.from(document.querySelectorAll('footer a'))
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
        })
        .map((element) => element.getBoundingClientRect())
      const lastLinkBottom = Math.max(...footerLinks.map((rect) => rect.bottom))
      return navRect ? Math.round(navRect.top - lastLinkBottom) : -1
    })

  await expect.poll(medirClearance, { timeout: 10000 }).toBeGreaterThanOrEqual(12)
})
