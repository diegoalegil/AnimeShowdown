import { expect, test } from '@playwright/test'
import sharp from 'sharp'

const CATALOG_STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'

// Catálogo sintético largo: el bug de tiles blancos solo aparece con
// listados que superan varias pantallas (fling con zonas sin rasterizar).
const ANIMES = ['One Piece', 'Naruto', 'Bleach', 'Dragon Ball']
const CATALOG = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  slug: `personaje-${i + 1}`,
  nombre: `Personaje ${i + 1}`,
  anime: ANIMES[i % ANIMES.length],
  imagenUrl: `/img/_e2e/personaje-${i + 1}.webp`,
  imagenColorDominante: '#1a2230',
}))

async function prepararListado(page) {
  await page.addInitScript((catalog) => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('i18nextLng', 'es')
    localStorage.setItem('animeshowdown.catalogo-personajes.v1', JSON.stringify(catalog))
    localStorage.setItem('as-consent-analytics-v1', 'denied')
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
  }, CATALOG)

  await page.route('**/api/personajes/catalogo**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG),
    })
  })

  // Las imágenes sintéticas no existen: 404 → PersonajeImg pinta su
  // placeholder oscuro con el color dominante, que es justo lo que el
  // test necesita comprobar que ocupa los huecos (nunca blanco).
  await page.route('**/img/_e2e/**', async (route) => {
    await route.fulfill({ status: 404, body: '' })
  })
}

/** % de píxeles casi-blancos en un screenshot (texto antialiasado aparte,
 *  un tile sin rasterizar es un bloque enorme y dispara este ratio). */
async function ratioPixelesBlancos(buffer) {
  const { data, info } = await sharp(buffer)
    .resize({ width: 400 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  let blancos = 0
  const total = info.width * info.height
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) blancos++
  }
  return blancos / total
}

test.describe('scroll rápido sin pantallas blancas', () => {
  test('el documento declara lienzo oscuro y un fling no deja tiles blancos', async ({ page }) => {
    await prepararListado(page)
    await page.goto('/personajes')
    await expect(page.locator('a[href^="/personajes/personaje-"]').first()).toBeVisible()

    // Contrato raíz del fix: html con background-color sólido oscuro y
    // color-scheme dark — es lo que el navegador usa para rellenar los
    // tiles aún sin rasterizar durante el fling.
    const lienzo = await page.evaluate(() => ({
      bg: getComputedStyle(document.documentElement).backgroundColor,
      scheme: getComputedStyle(document.documentElement).colorScheme,
    }))
    expect(lienzo.bg).toBe('rgb(4, 7, 12)')
    expect(lienzo.scheme).toContain('dark')

    // Fling agresivo: ráfaga de ruedazos sin esperas + captura inmediata
    // en varios puntos profundos del listado.
    for (let ronda = 0; ronda < 3; ronda++) {
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 3200)
      }
      const captura = await page.screenshot({ fullPage: false })
      const ratio = await ratioPixelesBlancos(captura)
      expect(ratio, `ronda ${ronda}: ${(ratio * 100).toFixed(2)}% de píxeles casi-blancos`).toBeLessThan(0.02)
    }

    // Tras asentarse, la página sigue interactiva y sin huecos.
    await page.waitForTimeout(400)
    const capturaFinal = await page.screenshot({ fullPage: false })
    expect(await ratioPixelesBlancos(capturaFinal)).toBeLessThan(0.02)
  })
})
