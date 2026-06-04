import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import DueloDestacadoCard from './DueloDestacadoCard'

function bannerImg(container: HTMLElement) {
  return container.querySelector('picture img') as HTMLImageElement | null
}

describe('DueloDestacadoCard', () => {
  it('resuelve el banner de un torneo random-showdown-N al webp base (evita el 404)', () => {
    const { container } = render(
      <MemoryRouter>
        <DueloDestacadoCard
          torneoEnCurso={{ slug: 'random-showdown-2', nombre: 'Random Showdown #2' }}
        />
      </MemoryRouter>,
    )
    const img = bannerImg(container)
    expect(img).toBeTruthy()
    // El slug auto-generado no tiene webp propia: hereda la del slug base.
    expect(img!.getAttribute('src')).toContain('/assets/tournament-banners/random-showdown.webp')
    // El slug numerado NUNCA debe aparecer en la URL (era la causa del 404).
    expect(img!.getAttribute('src')).not.toContain('random-showdown-2')
  })

  it('emite <source> AVIF y WebP responsive para el banner', () => {
    const { container } = render(
      <MemoryRouter>
        <DueloDestacadoCard
          torneoEnCurso={{ slug: 'shonen-showdown', nombre: 'Shonen Showdown' }}
        />
      </MemoryRouter>,
    )
    const img = bannerImg(container)
    expect(img!.getAttribute('src')).toContain('/assets/tournament-banners/shonen-showdown.webp')
    const sources = container.querySelectorAll('picture source')
    const types = Array.from(sources).map((s) => s.getAttribute('type'))
    expect(types).toContain('image/avif')
    expect(types).toContain('image/webp')
    expect(container.querySelector('source[type="image/avif"]')!.getAttribute('srcset')).toContain(
      'shonen-showdown-768.avif',
    )
  })
})
