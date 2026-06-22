import { describe, expect, it } from 'vitest'
import {
  DUEL_LIVE_POLL_BASE_MS,
  DUEL_LIVE_POLL_MAX_MS,
  DUEL_LIVE_PUSH_FRESH_MS,
  getDueloLivePollDelay,
  isStaleDueloLiveUpdate,
  shouldPollDueloLiveFallback,
} from './dueloLiveRecoveryPolicy'

describe('dueloLiveRecoveryPolicy', () => {
  it('mantiene el polling REST apagado cuando el WebSocket privado esta fresco', () => {
    const now = 20_000
    expect(shouldPollDueloLiveFallback({
      user: { username: 'diego' },
      connected: true,
      state: { estado: 'IN_PROGRESS' },
      lastPushAt: now - DUEL_LIVE_PUSH_FRESH_MS + 1,
      now,
    })).toBe(false)
  })

  it('activa fallback con conexion directa si el push privado no llega o queda viejo', () => {
    const now = 20_000
    expect(shouldPollDueloLiveFallback({
      user: { username: 'diego' },
      connected: true,
      state: { estado: 'MATCHED' },
      lastPushAt: 0,
      now,
    })).toBe(true)
    expect(shouldPollDueloLiveFallback({
      user: { username: 'diego' },
      connected: true,
      state: { estado: 'MATCHED' },
      lastPushAt: now - DUEL_LIVE_PUSH_FRESH_MS,
      now,
    })).toBe(true)
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

  describe('isStaleDueloLiveUpdate', () => {
    it('descarta una respuesta más vieja que el último estado aplicado', () => {
      // poll lento (t=1000) llega tras un push WS más nuevo (t=2000) ya aplicado
      expect(isStaleDueloLiveUpdate(2000, 1000)).toBe(true)
    })

    it('aplica respuestas más nuevas o de la misma marca (idempotente)', () => {
      expect(isStaleDueloLiveUpdate(1000, 2000)).toBe(false)
      expect(isStaleDueloLiveUpdate(2000, 2000)).toBe(false)
    })

    it('nunca descarta si la respuesta no trae serverNow (defensivo)', () => {
      expect(isStaleDueloLiveUpdate(5000, null)).toBe(false)
      expect(isStaleDueloLiveUpdate(5000, undefined)).toBe(false)
      expect(isStaleDueloLiveUpdate(5000, NaN)).toBe(false)
    })

    it('aplica el primer estado aunque el último-aplicado sea no finito', () => {
      expect(isStaleDueloLiveUpdate(0, 1000)).toBe(false)
      expect(isStaleDueloLiveUpdate(null, 1000)).toBe(false)
      expect(isStaleDueloLiveUpdate(NaN, 1000)).toBe(false)
    })
  })
})
