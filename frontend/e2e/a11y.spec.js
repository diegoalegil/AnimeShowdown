import { expect, test } from '@playwright/test'
import axe from 'axe-core'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/personajes', name: 'personajes' },
  { path: '/animes', name: 'animes' },
  { path: '/ranking', name: 'ranking' },
  { path: '/torneos', name: 'torneos' },
  { path: '/games', name: 'games' },
  { path: '/votar', name: 'votar' },
  { path: '/eventos', name: 'eventos' },
  { path: '/comparar', name: 'comparar' },
  { path: '/descubre-personaje', name: 'descubre-personaje' },
  { path: '/games/shadow-guess', name: 'shadow-guess' },
  { path: '/games/anime-reveal', name: 'anime-reveal' },
  { path: '/games/anigrid', name: 'anigrid' },
  { path: '/games/impostor-trial', name: 'impostor-trial' },
  { path: '/games/elo-duel', name: 'elo-duel' },
  { path: '/games/ruleta', name: 'ruleta' },
  { path: '/omikuji', name: 'omikuji' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/forgot-password', name: 'forgot-password' },
  { path: '/reset-password', name: 'reset-password' },
  { path: '/verify', name: 'verify' },
  { path: '/newsletter/confirmar', name: 'newsletter-confirmar' },
  { path: '/misiones', name: 'misiones' },
  { path: '/mi-ranking', name: 'mi-ranking' },
  { path: '/logros', name: 'logros' },
  { path: '/leaderboards', name: 'leaderboards' },
  { path: '/mi-top5', name: 'mi-top5' },
  { path: '/faq', name: 'faq' },
  { path: '/como-funciona', name: 'como-funciona' },
  { path: '/metodologia-elo', name: 'metodologia-elo' },
  { path: '/api-docs', name: 'api-docs' },
  { path: '/status', name: 'status' },
  { path: '/apoya', name: 'apoya' },
  { path: '/privacidad', name: 'privacidad' },
  { path: '/terminos', name: 'terminos' },
  { path: '/dmca', name: 'dmca' },
  { path: '/glossary', name: 'glossary' },
  { path: '/no-existe-a11y', name: 'not-found' },
]

async function preparePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('i18nextLng', 'es')
    // El kumite de onboarding tiene su propio spec; aquí se cierra para que no
    // aparezca en /votar (ahora arranca también para invitados).
    localStorage.setItem('onboarding.v1', 'done')
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
  })
}

function formatViolations(route, violations) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.join(' ')} :: ${node.failureSummary ?? node.html}`)
        .join('\n')

      return [
        `${route.name} ${route.path}`,
        `${violation.id}: ${violation.help}`,
        `impact: ${violation.impact ?? 'unknown'}`,
        nodes,
      ].join('\n')
    })
    .join('\n\n')
}

test.describe('accessibility smoke', () => {
  for (const route of ROUTES) {
    test(`${route.name} has no WCAG A/AA axe violations`, async ({ page }) => {
      await preparePage(page)
      await page.goto(route.path)
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
      await page.waitForTimeout(250)
      await page.addScriptTag({ content: axe.source })

      const results = await page.evaluate((tags) =>
        window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: tags,
          },
          resultTypes: ['violations'],
        }),
      WCAG_TAGS)

      expect(results.violations.length, formatViolations(route, results.violations)).toBe(0)
    })
  }
})

test.describe('keyboard navigation', () => {
  test('skip link moves keyboard focus to main content', async ({ page }) => {
    await preparePage(page)
    await page.goto('/')

    const skipLink = page.getByRole('link', { name: 'Saltar al contenido' })
    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('mobile navigation traps focus and closes with Escape', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'El panel movil solo existe bajo xl.')

    await preparePage(page)
    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'Abrir menú' })
    await menuButton.click()

    const panel = page.getByRole('dialog', { name: 'Menú de navegación' })
    await expect(panel).toBeVisible()
    // §FE-004: el nav ya no incluye "Inicio" (lo cubre el logo); el primer enlace
    // del drawer es "Personajes", que es quien recibe el foco al abrir el panel.
    await expect(panel.getByRole('link', { name: 'Personajes' })).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    const isFocusInsidePanel = () =>
      page.evaluate(() => document.querySelector('#mobile-nav-noren')?.contains(document.activeElement))
    await expect.poll(isFocusInsidePanel).toBe(true)

    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(menuButton).toBeFocused()
  })

  test('toast region exposes a localized polite live region', async ({ page }) => {
    await preparePage(page)
    await page.goto('/')

    await expect(
      page.locator('[aria-live="polite"][aria-label^="Notificaciones de AnimeShowdown"]'),
    ).toBeAttached()
  })
})
