import { test, expect } from '@playwright/test'

/**
 * Guardrail responsive: bloquea overflow horizontal en rutas publicas clave.
 * Cada test recorre varias rutas en el mismo viewport para mantener CI rapido
 * sin perder senal de regresiones globales de layout.
 */

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

async function settleRoute(page, path) {
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(250)
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
