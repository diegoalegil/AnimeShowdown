import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_DENIED,
  CONSENT_EVENT,
  CONSENT_GRANTED,
  getConsent,
  hasAnalyticsConsent,
  setConsent,
} from './consent'

describe('consent', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('sin elección getConsent es null y no hay consentimiento de analítica', () => {
    expect(getConsent()).toBeNull()
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it('aceptar persiste y habilita la analítica; rechazar la deja off', () => {
    setConsent(CONSENT_GRANTED)
    expect(getConsent()).toBe(CONSENT_GRANTED)
    expect(hasAnalyticsConsent()).toBe(true)

    setConsent(CONSENT_DENIED)
    expect(getConsent()).toBe(CONSENT_DENIED)
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it('setConsent emite el evento as:consent con el valor', () => {
    const handler = vi.fn()
    window.addEventListener(CONSENT_EVENT, handler)
    setConsent(CONSENT_GRANTED)
    window.removeEventListener(CONSENT_EVENT, handler)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].detail).toBe(CONSENT_GRANTED)
  })
})
