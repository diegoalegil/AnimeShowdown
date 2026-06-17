import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// t(key) → key: aseguramos que los enlaces usan las claves nav.* esperadas.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

import FooterSlim from './FooterSlim'

function renderFooter() {
  return render(
    <MemoryRouter>
      <FooterSlim />
    </MemoryRouter>,
  )
}

describe('FooterSlim', () => {
  afterEach(() => cleanup())

  it('ofrece atajos de producto de vuelta al loop (votar/personajes/ranking/juegos)', () => {
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'footer.producto' })
    const votar = within(nav).getByRole('link', { name: 'nav.votar' })
    expect(votar).toHaveAttribute('href', '/votar')
    expect(within(nav).getByRole('link', { name: 'nav.personajes' })).toHaveAttribute('href', '/personajes')
    expect(within(nav).getByRole('link', { name: 'nav.ranking' })).toHaveAttribute('href', '/ranking')
    expect(within(nav).getByRole('link', { name: 'nav.games' })).toHaveAttribute('href', '/games')
  })

  it('conserva los enlaces legales (privacidad/términos/DMCA)', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: 'footer.privacidad' })).toHaveAttribute('href', '/privacidad')
    expect(screen.getByRole('link', { name: 'footer.terminos' })).toHaveAttribute('href', '/terminos')
    expect(screen.getByRole('link', { name: 'DMCA' })).toHaveAttribute('href', '/dmca')
  })
})
