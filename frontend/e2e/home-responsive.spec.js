import { test, expect } from '@playwright/test'

/**
 * Guardrail responsive: bloquea overflow horizontal en rutas publicas clave.
 * Cada test recorre varias rutas en el mismo viewport para mantener CI rapido
 * sin perder senal de regresiones globales de layout.
 */

// El kumite de onboarding tiene su propio spec (onboarding.spec.js); aquí se
// cierra para que no aparezca en /votar (ahora arranca también para invitados)
// y altere el layout responsive medido.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.v1', 'done')
  })
})

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 740 },
  { name: 'android-compact', width: 360, height: 800 },
  { name: 'iphone-13-mini', width: 390, height: 844 },
  { name: 'iphone-14-pro-max', width: 430, height: 932 },
  { name: 'ipad-portrait', width: 768, height: 1024 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'laptop-small', width: 1280, height: 800 },
  { name: 'laptop-mid', width: 1440, height: 900 },
  { name: 'desktop-fhd', width: 1920, height: 1080 },
]

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/personajes', name: 'personajes' },
  { path: '/animes', name: 'animes' },
  { path: '/torneos', name: 'torneos' },
  { path: '/eventos', name: 'eventos' },
  { path: '/ranking', name: 'ranking' },
  { path: '/votar', name: 'votar' },
  { path: '/games', name: 'games' },
  { path: '/comparar', name: 'comparar' },
  { path: '/descubre-personaje', name: 'descubre-personaje' },
  { path: '/logros', name: 'logros' },
  { path: '/leaderboards', name: 'leaderboards' },
]

const TOUCH_ROUTES = [
  { path: '/', name: 'home' },
  { path: '/personajes', name: 'personajes' },
  { path: '/ranking', name: 'ranking' },
  { path: '/votar', name: 'votar' },
  { path: '/games', name: 'games' },
]

const TOUCH_VIEWPORT = { name: 'iphone-13-mini', width: 390, height: 844 }
const MIN_TOUCH_TARGET = 44

async function settleRoute(page, path) {
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(250)
}

async function expectVisibleTouchTargets(page, label) {
  const violations = await page.evaluate((minSize) => {
    const selector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    return Array.from(document.querySelectorAll(selector))
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        const tag = el.tagName.toLowerCase()
        const className = typeof el.className === 'string' ? el.className : ''
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= 0 &&
          rect.right >= 0 &&
          rect.top <= window.innerHeight &&
          rect.left <= window.innerWidth &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none'

        if (!isVisible || el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
          return null
        }

        if (className.includes('sr-only')) return null

        const isPlainTextLink =
          tag === 'a' &&
          !el.querySelector('svg,img') &&
          !/(as-button|inline-flex|flex|grid|block|rounded|min-h-|h-\d|w-\d|px-|py-|p-)/.test(className)

        if (isPlainTextLink) return null

        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        if (width >= minSize && height >= minSize) return null

        return {
          tag,
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80),
          width,
          height,
          className,
        }
      })
      .filter(Boolean)
  }, MIN_TOUCH_TARGET)

  expect(violations, `Touch targets menores de ${MIN_TOUCH_TARGET}px @ ${label}`).toEqual([])
}

async function expectNoHorizontalOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    docC: document.documentElement.clientWidth,
    bodyW: document.body.scrollWidth,
    bodyC: document.body.clientWidth,
  }))

  expect(
    sizes.docW,
    `<html> scrollWidth (${sizes.docW}) > clientWidth (${sizes.docC}) @ ${label}`,
  ).toBeLessThanOrEqual(sizes.docC)
  expect(
    sizes.bodyW,
    `<body> scrollWidth (${sizes.bodyW}) > clientWidth (${sizes.bodyC}) @ ${label}`,
  ).toBeLessThanOrEqual(sizes.bodyC)
}

for (const vp of VIEWPORTS) {
  test(`rutas clave sin overflow horizontal @ ${vp.name} ${vp.width}x${vp.height}`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'La matriz fija el viewport manualmente; evitar duplicado por proyecto movil mantiene CI rapido.',
    )

    await page.setViewportSize({ width: vp.width, height: vp.height })

    for (const route of ROUTES) {
      await settleRoute(page, route.path)
      await expectNoHorizontalOverflow(page, `${route.name} ${vp.name}`)
    }
  })
}

test('rutas clave mantienen touch targets visibles de al menos 44px', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'El test fija viewport movil manualmente para evitar duplicado por proyecto.',
  )

  await page.setViewportSize({ width: TOUCH_VIEWPORT.width, height: TOUCH_VIEWPORT.height })

  for (const route of TOUCH_ROUTES) {
    await settleRoute(page, route.path)
    await expectVisibleTouchTargets(page, `${route.name} ${TOUCH_VIEWPORT.name}`)
  }
})

test('panel de navegacion movil mantiene touch targets de al menos 44px', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'El test fija viewport movil manualmente para evitar duplicado por proyecto.',
  )

  await page.setViewportSize({ width: TOUCH_VIEWPORT.width, height: TOUCH_VIEWPORT.height })
  await settleRoute(page, '/')
  await page.getByRole('button', { name: /Abrir menú|Abrir menu/i }).click()
  await expect(page.getByRole('dialog', { name: /Menú de navegación|Menu de navegacion/i })).toBeVisible()
  await expectVisibleTouchTargets(page, `mobile-nav ${TOUCH_VIEWPORT.name}`)
})
