import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_DENIED, CONSENT_GRANTED, setConsent } from './consent'
import { FUNNEL_EVENTS, track } from './analytics'

const beacon = vi.fn()

describe('analytics track()', () => {
  beforeEach(() => {
    beacon.mockReset()
    beacon.mockReturnValue(true)
    // happy-dom puede no traer sendBeacon: lo definimos como mock sin chocar
    // con el tipado estricto de navigator.
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beacon,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('envía un beacon a /api/funnel/event para un evento del whitelist', () => {
    track(FUNNEL_EVENTS.LANDING_VIEW)
    expect(beacon).toHaveBeenCalledTimes(1)
    const [url, blob] = beacon.mock.calls[0]
    expect(String(url)).toContain('/api/funnel/event')
    expect(blob).toBeInstanceOf(Blob)
    // application/json para que el @RequestBody del backend parsee el beacon.
    expect((blob as Blob).type).toBe('application/json')
  })

  it('ignora eventos fuera del whitelist sin tocar la red', () => {
    track('hacker_event_xyz')
    expect(beacon).not.toHaveBeenCalled()
  })

  it('no mide si el usuario rechazó el consentimiento (opt-out explícito)', () => {
    setConsent(CONSENT_DENIED)
    track(FUNNEL_EVENTS.SHARE_CLICK)
    expect(beacon).not.toHaveBeenCalled()
  })

  it('mide sin decisión de consent y con consent concedido (aggregate cookieless)', () => {
    track(FUNNEL_EVENTS.VOTE_WALL_HIT) // consent === null → se mide
    setConsent(CONSENT_GRANTED)
    track(FUNNEL_EVENTS.REFERRAL_LANDING)
    expect(beacon).toHaveBeenCalledTimes(2)
  })

  it('el cuerpo del beacon es JSON con solo el nombre del evento', async () => {
    track(FUNNEL_EVENTS.REGISTER_START)
    const blob = beacon.mock.calls[0][1] as Blob
    expect(JSON.parse(await blob.text())).toEqual({ event: 'register_start' })
  })
})
