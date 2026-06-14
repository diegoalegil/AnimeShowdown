import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import CookieConsent from './CookieConsent'
import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  getConsent,
  setConsent,
} from '../lib/consent'

// ConsentScroll usa playSello/playWhoosh (Web Audio) — se mockean.
vi.mock('../lib/sounds', () => ({
  playSello: vi.fn(),
  playWhoosh: vi.fn(),
}))

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieConsent />
    </MemoryRouter>,
  )
}

// El pergamino arranca en fase `entering` (desenrollado ~350ms) y solo acepta
// clicks una vez `open`; se avanza el timer de entrada antes de pulsar.
function avanzarEntrada() {
  act(() => {
    vi.advanceTimersByTime(400)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  cleanup()
  window.localStorage.clear()
})

describe('CookieConsent', () => {
  it('aparece sin elección previa y enlaza a /privacidad sin recargar', () => {
    renderBanner()
    expect(
      screen.getByRole('region', { name: 'Consentimiento de cookies' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Más información/ }),
    ).toHaveAttribute('href', '/privacidad')
  })

  it('no aparece si ya hay una elección guardada', () => {
    setConsent(CONSENT_GRANTED)
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('"Aceptar" concede la telemetría (CONSENT_GRANTED)', () => {
    renderBanner()
    avanzarEntrada()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(getConsent()).toBe(CONSENT_GRANTED)
  })

  it('"Solo esenciales" la deniega (CONSENT_DENIED)', () => {
    renderBanner()
    avanzarEntrada()
    fireEvent.click(screen.getByRole('button', { name: 'Solo esenciales' }))
    expect(getConsent()).toBe(CONSENT_DENIED)
  })
})
