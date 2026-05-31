import { describe, expect, it } from 'vitest'
import {
  DUEL_LIVE_POLL_BASE_MS,
  DUEL_LIVE_POLL_MAX_MS,
  getDueloLivePollDelay,
  shouldPollDueloLiveFallback,
} from './dueloLiveRecoveryPolicy'

describe('dueloLiveRecoveryPolicy', () => {
  it('mantiene el polling REST apagado cuando el WebSocket privado esta conectado', () => {
    expect(shouldPollDueloLiveFallback({
      user: { username: 'diego' },
      connected: true,
      state: { estado: 'IN_PROGRESS' },
    })).toBe(false)
  })

  it('activa fallback solo para duelos recuperables sin conexion directa', () => {
    expect(shouldPollDueloLiveFallback({
      user: { username: 'diego' },
      connected: false,
      state: { estado: 'WAITING' },
    })).toBe(true)
    expect(shouldPollDueloLiveFallback({
      user: { username: 'diego' },
      connected: false,
      state: { estado: 'FINISHED' },
    })).toBe(false)
    expect(shouldPollDueloLiveFallback({
      user: null,
      connected: false,
      state: { estado: 'IN_PROGRESS' },
    })).toBe(false)
  })

  it('usa backoff acotado para no duplicar carga mientras reconecta STOMP', () => {
    expect(getDueloLivePollDelay(0)).toBe(DUEL_LIVE_POLL_BASE_MS)
    expect(getDueloLivePollDelay(1)).toBe(8000)
    expect(getDueloLivePollDelay(99)).toBe(DUEL_LIVE_POLL_MAX_MS)
  })
})
