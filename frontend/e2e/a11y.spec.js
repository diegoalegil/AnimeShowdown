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
]

async function preparePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('i18nextLng', 'es')
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
