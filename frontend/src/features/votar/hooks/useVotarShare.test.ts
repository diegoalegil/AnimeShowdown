import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useVotarShare } from './useVotarShare'

const { mockShareWithToast, mockShareOrCopy, mockRecordDailyShare } = vi.hoisted(() => ({
  mockShareWithToast: vi.fn(),
  mockShareOrCopy: vi.fn(),
  mockRecordDailyShare: vi.fn(),
}))

vi.mock('../../../lib/shareWithToast', () => ({ shareWithToast: mockShareWithToast }))
vi.mock('../../../lib/share', () => ({ shareOrCopy: mockShareOrCopy }))
vi.mock('../../../lib/dailyProgress', () => ({ recordDailyShare: mockRecordDailyShare }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const luffy = { slug: 'luffy', nombre: 'Monkey D. Luffy', anime: 'One Piece' }
const zoro = { slug: 'zoro', nombre: 'Roronoa Zoro', anime: 'One Piece' }

const baseInput = {
  a: luffy,
  b: zoro,
  votedPersonaje: null,
  losingPersonaje: null,
  personalVoteImpact: null,
  sessionStats: { total: 0, bySlug: {}, closeDuels: 0, lastShareText: '' },
  fixedSlug: null,
  fixedAnime: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockShareOrCopy.mockResolvedValue('native')
})

describe('useVotarShare', () => {
  it('handleChallenge comparte la URL del duelo exacto actual', () => {
    const { result } = renderHook(() => useVotarShare(baseInput))
    result.current.handleChallenge()
    expect(mockShareWithToast).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/votar?personaje=luffy&rival=zoro' }),
      expect.objectContaining({ nativeSuccess: 'Reto enviado' }),
    )
  })

  it('handleChallenge es no-op sin pareja completa', () => {
    const { result } = renderHook(() => useVotarShare({ ...baseInput, b: null }))
    result.current.handleChallenge()
    expect(mockShareWithToast).not.toHaveBeenCalled()
  })

  it('handleShareVote fija el duelo ganador-perdedor y registra el share diario', async () => {
    const { result } = renderHook(() => useVotarShare({
      ...baseInput,
      votedPersonaje: luffy,
      losingPersonaje: zoro,
    }))
    await result.current.handleShareVote()
    expect(mockShareOrCopy).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/votar?personaje=luffy&rival=zoro' }),
    )
    expect(mockRecordDailyShare).toHaveBeenCalledTimes(1)
  })

  it('handleShareVote cancelado no registra el share diario', async () => {
    mockShareOrCopy.mockResolvedValue('cancelled')
    const { result } = renderHook(() => useVotarShare({
      ...baseInput,
      votedPersonaje: luffy,
      losingPersonaje: zoro,
    }))
    await result.current.handleShareVote()
    expect(mockRecordDailyShare).not.toHaveBeenCalled()
  })

  it('handleShareSessionRecap arma el top 5 de la sesion', async () => {
    const { result } = renderHook(() => useVotarShare({
      ...baseInput,
      sessionStats: {
        total: 12,
        closeDuels: 2,
        lastShareText: '',
        bySlug: {
          luffy: { nombre: 'Monkey D. Luffy', anime: 'One Piece', count: 7 },
          zoro: { nombre: 'Roronoa Zoro', anime: 'One Piece', count: 5 },
        },
      },
    }))
    await result.current.handleShareSessionRecap()
    const llamada = mockShareOrCopy.mock.calls[0][0]
    expect(llamada.url).toBe('/mi-ranking')
    expect(llamada.text).toContain('Llevo 12 votos')
    expect(llamada.text).toContain('1. Monkey D. Luffy (One Piece) · x7')
    expect(llamada.text).toContain('2 duelos estuvieron a 1 voto o menos.')
  })

  it('handleShareSessionRecap es no-op sin votos en la sesion', async () => {
    const { result } = renderHook(() => useVotarShare(baseInput))
    await result.current.handleShareSessionRecap()
    expect(mockShareOrCopy).not.toHaveBeenCalled()
  })
})
