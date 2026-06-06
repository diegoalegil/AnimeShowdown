// Consentimiento de telemetría no esencial (RGPD).
//
// Las cookies de autenticación son ESENCIALES (no requieren consentimiento). Lo
// que SÍ gateamos es la telemetría no esencial: el Session Replay de Sentry
// (graba la sesión del usuario). El registro de errores y el tracing van por
// interés legítimo (estabilidad, sin PII: sendDefaultPii=false) y no se gatean.
//
// La elección se persiste en localStorage (tolerante a modo privado) y se emite
// un evento para que los listeners reaccionen sin recargar.

const KEY = 'as-consent-analytics-v1'

export const CONSENT_GRANTED = 'granted'
export const CONSENT_DENIED = 'denied'
export const CONSENT_EVENT = 'as:consent'

/** 'granted' | 'denied' | null (sin elección todavía). */
export function getConsent() {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    // Safari modo privado / storage bloqueado: tratamos como "sin elección".
    return null
  }
}

export function setConsent(value) {
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    /* storage no disponible: la elección no persiste, no es crítico */
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
  } catch {
    /* entornos sin CustomEvent (tests/SSR): no-op */
  }
}

/** ¿El usuario aceptó la telemetría no esencial (Session Replay)? */
export function hasAnalyticsConsent() {
  return getConsent() === CONSENT_GRANTED
}
