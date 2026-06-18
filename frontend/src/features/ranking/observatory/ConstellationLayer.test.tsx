import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConstellationLayer from './ConstellationLayer'
import { pathDeConstelacion } from './observatory-core'

const CONSTELACIONES = [
  {
    anime: 'Dragon Ball',
    indice: 0,
    segmentos: [
      { x1: 0, y1: 0, x2: 10, y2: 10, desde: 'goku', hasta: 'vegeta' },
      { x1: 10, y1: 10, x2: 20, y2: 5, desde: 'vegeta', hasta: 'gohan' },
    ],
  },
  // constelación de una sola estrella: sin segmentos ⇒ sin trazo
  { anime: 'One Piece', indice: 1, segmentos: [] },
]

describe('pathDeConstelacion', () => {
  it('encadena los segmentos en un único path M…L…L', () => {
    expect(pathDeConstelacion(CONSTELACIONES[0].segmentos)).toBe('M 0 0 L 10 10 L 20 5')
  })
  it('devuelve null sin segmentos', () => {
    expect(pathDeConstelacion([])).toBeNull()
  })
})

describe('ConstellationLayer', () => {
  it('dibuja un path por constelación con ≥2 estrellas y omite las solitarias', () => {
    const { container } = render(
      <ConstellationLayer constelaciones={CONSTELACIONES} ancho={800} alto={620} />,
    )
    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttribute('pathLength')).toBe('1')
    expect(paths[0].classList.contains('is-dibujando')).toBe(true)
  })

  it('es decorativa: el svg está oculto a lectores de pantalla', () => {
    const { container } = render(
      <ConstellationLayer constelaciones={CONSTELACIONES} ancho={800} alto={620} />,
    )
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('en reduced-motion no aplica la clase de dibujado', () => {
    const { container } = render(
      <ConstellationLayer constelaciones={CONSTELACIONES} ancho={800} alto={620} reducedMotion />,
    )
    expect(container.querySelector('path')!.classList.contains('is-dibujando')).toBe(false)
  })
})
