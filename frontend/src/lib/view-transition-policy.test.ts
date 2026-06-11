import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function leer(file: string) {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

// Superficies calientes de navegación: deben usar el wrapper AppLink (la
// prop viewTransition de react-router es inerte en modo declarativo) en vez
// del Link/NavLink directos.
const SUPERFICIES_APPLINK = [
  'src/components/Header.jsx',
  'src/components/MobileBottomNav.jsx',
  'src/components/PersonajeCard.jsx',
  'src/features/ranking/components/RankingRows.jsx',
  'src/features/ranking/components/RankingPodium.jsx',
  'src/components/Hero.jsx',
  'src/pages/InicioPage.jsx',
  'src/pages/RankingPage.jsx',
]

// Orígenes del morph carta → hero: al click marcan su retrato con el
// view-transition-name compartido.
const ORIGENES_MORPH = [
  'src/components/PersonajeCard.jsx',
  'src/features/ranking/components/RankingPodium.jsx',
  'src/pages/InicioPage.jsx',
  'src/pages/RankingPage.jsx',
]

describe('política de view transitions', () => {
  it('las superficies calientes navegan con AppLink', () => {
    for (const file of SUPERFICIES_APPLINK) {
      const source = leer(file)
      expect(source, file).toContain('AppLink')
    }
  })

  it('el shell del header y del bottom nav usan NavLinks con transición', () => {
    expect(leer('src/components/Header.jsx')).toContain('<AppNavLink')
    expect(leer('src/components/MobileBottomNav.jsx')).toContain('<AppNavLink')
  })

  it('los orígenes del morph marcan el retrato al hacer click', () => {
    for (const file of ORIGENES_MORPH) {
      const source = leer(file)
      expect(source, file).toContain('markPersonajeHero')
    }
  })

  it('el hero del detalle adopta y libera el nombre compartido', () => {
    const source = leer('src/pages/PersonajeDetailPage.jsx')
    expect(source).toContain('adoptPersonajeHero')
    expect(source).toContain('releasePersonajeHero')
  })

  it('App asienta la transición en el commit de ruta, con el scroll ya arriba', () => {
    const source = leer('src/App.jsx')
    const scrollReset = source.match(/useLayoutEffect\(\(\) => \{[\s\S]*?\}, \[location\.pathname\]\)/)?.[0] ?? ''
    expect(scrollReset).toContain('window.scrollTo(0, 0)')
    expect(scrollReset).toContain('settleNavigationViewTransition()')
    expect(scrollReset.indexOf('window.scrollTo(0, 0)')).toBeLessThan(
      scrollReset.indexOf('settleNavigationViewTransition()'),
    )
  })

  it('el shell fijo tiene grupo propio para no parpadear entre páginas', () => {
    expect(leer('src/components/Header.jsx')).toContain('as-vt-header')
    expect(leer('src/components/MobileBottomNav.jsx')).toContain('as-vt-bottom-nav')
    expect(leer('src/components/ScrollProgress.jsx')).toContain('as-vt-scroll-progress')
  })

  it('el CSS define la transición raíz, el morph y el guard de reduced motion', () => {
    const css = leer('src/index.css')
    expect(css).toContain('::view-transition-old(root)')
    expect(css).toContain('::view-transition-new(root)')
    expect(css).toContain('::view-transition-group(personaje-hero)')
    expect(css).toContain('.as-vt-header')
    expect(css).toContain('.as-vt-bottom-nav')

    // Reduced motion: TODOS los pseudos de view transition sin animación.
    const reduceGuard = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-group\(\*\),[\s\S]*?\n\}/,
    )?.[0] ?? ''
    expect(reduceGuard).toContain('::view-transition-old(*)')
    expect(reduceGuard).toContain('::view-transition-new(*)')
    expect(reduceGuard).toContain('animation: none !important')
  })

  it('las animaciones de la transición solo tocan transform/opacity (CLS)', () => {
    const css = leer('src/index.css')
    for (const nombre of ['as-vt-page-out', 'as-vt-page-in']) {
      const keyframes = css.match(
        new RegExp(`@keyframes ${nombre} \\{[\\s\\S]*?\\n\\}`),
      )?.[0]
      expect(keyframes, nombre).toBeTruthy()
      const propiedades = [...(keyframes ?? '').matchAll(/^\s{4}([a-z-]+):/gm)].map((m) => m[1])
      expect(propiedades.length, nombre).toBeGreaterThan(0)
      for (const prop of propiedades) {
        expect(['opacity', 'transform'], `${nombre} → ${prop}`).toContain(prop)
      }
    }
  })
})
