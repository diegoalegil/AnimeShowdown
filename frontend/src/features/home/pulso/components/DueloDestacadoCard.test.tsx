import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import DueloDestacadoCard from './DueloDestacadoCard'

function bannerSpan(container: HTMLElement) {
  return Array.from(container.querySelectorAll('span')).find((el) =>
    (el as HTMLElement).style.backgroundImage.includes('tournament-banners'),
  ) as HTMLElement | undefined
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
    const bg = bannerSpan(container)
    expect(bg).toBeTruthy()
    // El slug auto-generado no tiene webp propia: debe heredar la del slug base.
    expect(bg!.style.backgroundImage).toContain('/assets/tournament-banners/random-showdown.webp')
    // El slug numerado NUNCA debe aparecer en la URL (era la causa del 404).
    expect(bg!.style.backgroundImage).not.toContain('random-showdown-2.webp')
  })

  it('usa el banner directo para un torneo con webp propia', () => {
    const { container } = render(
      <MemoryRouter>
        <DueloDestacadoCard
          torneoEnCurso={{ slug: 'shonen-showdown', nombre: 'Shonen Showdown' }}
        />
      </MemoryRouter>,
    )
    const bg = bannerSpan(container)
    expect(bg).toBeTruthy()
    expect(bg!.style.backgroundImage).toContain('/assets/tournament-banners/shonen-showdown.webp')
  })
})
