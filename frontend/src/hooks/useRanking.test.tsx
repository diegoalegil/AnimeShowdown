import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useRankingDeltaSubscription } from './useRanking'

// Capturamos el callback que useRankingDeltaSubscription registra en STOMP, sin
// red real. vi.hoisted porque vi.mock se iza por encima de los imports.
const stomp = vi.hoisted(() => {
  let handler: ((delta: unknown) => void) | null = null
  return {
    setHandler: (h: (delta: unknown) => void) => {
      handler = h
    },
    fire: (delta: unknown) => handler?.(delta),
  }
})

vi.mock('../lib/stomp.js', () => ({
  subscribe: (_topic: string, cb: (delta: unknown) => void) => {
    stomp.setHandler(cb)
    return () => {}
  },
}))

type Item = { personaje: { slug: string; anime: string; id: number }; votos: number; pesoVotos: number }

describe('useRankingDeltaSubscription — feature #15', () => {
  it('el delta global actualiza la caché global pero NUNCA la caché por categoría', () => {
    const qc = new QueryClient()
    // queryKey: ['ranking','segmentado', periodo, anime, categoria, limit]
    const KEY_GLOBAL = ['ranking', 'segmentado', 'all', '', '', 100]
    const KEY_CATEGORIA = ['ranking', 'segmentado', 'all', '', 'poder', 100]
    const luffy = { slug: 'luffy', anime: 'One Piece', id: 1 }
    qc.setQueryData<Item[]>(KEY_GLOBAL, [{ personaje: luffy, votos: 5, pesoVotos: 5 }])
    qc.setQueryData<Item[]>(KEY_CATEGORIA, [{ personaje: luffy, votos: 2, pesoVotos: 2 }])

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    renderHook(() => useRankingDeltaSubscription({ enabled: true }), { wrapper })

    stomp.fire({
      personaje: luffy,
      votos: 6,
      delta: 1,
      pesoVotos: 6,
      deltaPeso: 1,
    })

    const global = qc.getQueryData<Item[]>(KEY_GLOBAL)
    const categoria = qc.getQueryData<Item[]>(KEY_CATEGORIA)
    expect(global?.[0].votos).toBe(6) // global se actualiza con el total all-time
    expect(categoria?.[0].votos).toBe(2) // la categoría queda INTACTA (no contaminada)
  })
})
