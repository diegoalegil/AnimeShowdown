import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useFixedDuelParams } from './useFixedDuelParams'

const catalogo = [
  { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' },
  { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' },
  { slug: 'rem', nombre: 'Rem', anime: 'Re:Zero' },
]

function withRoute(search: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[`/votar${search}`]}>{children}</MemoryRouter>
  }
}

describe('useFixedDuelParams', () => {
  it('resuelve el duelo exacto personaje+rival', () => {
    const { result } = renderHook(() => useFixedDuelParams(catalogo), {
      wrapper: withRoute('?personaje=luffy&rival=zoro'),
    })
    expect(result.current.fixedPersonaje?.nombre).toBe('Monkey D. Luffy')
    expect(result.current.fixedRival?.nombre).toBe('Roronoa Zoro')
    expect(result.current.hasFixedDuel).toBe(true)
    expect(result.current.casualContextKey).toBe('luffy::zoro::')
  })

  it('un rival igual al personaje no fija duelo exacto', () => {
    const { result } = renderHook(() => useFixedDuelParams(catalogo), {
      wrapper: withRoute('?personaje=luffy&rival=luffy'),
    })
    expect(result.current.fixedRival).toBeNull()
    expect(result.current.hasFixedDuel).toBe(false)
  })

  it('el modo anime exige al menos dos personajes en el catalogo', () => {
    const conDos = renderHook(() => useFixedDuelParams(catalogo), {
      wrapper: withRoute('?anime=One%20Piece'),
    })
    expect(conDos.result.current.hasFixedAnime).toBe(true)

    const conUno = renderHook(() => useFixedDuelParams(catalogo), {
      wrapper: withRoute('?anime=Re%3AZero'),
    })
    expect(conUno.result.current.hasFixedAnime).toBe(false)
  })

  it('el personaje fijado tiene prioridad sobre el anime', () => {
    const { result } = renderHook(() => useFixedDuelParams(catalogo), {
      wrapper: withRoute('?personaje=luffy&anime=One%20Piece'),
    })
    expect(result.current.hasFixedAnime).toBe(false)
    expect(result.current.fixedPersonaje?.slug).toBe('luffy')
  })
})
