/**
 * Facade de medición de embudo — el `track()` único del frontend.
 *
 * Reporta los pasos del funnel que el servidor NO ve: la visita a la home, el
 * muro de 5 votos del invitado, el click de compartir y la llegada con código
 * de referido. Hoy el sink es un beacon anónimo a `POST /api/funnel/event` que
 * agrega en el Prometheus que ya existe (cero dependencias de terceros). Cuando
 * se elija una herramienta de analítica (Plausible/PostHog) se añade como sink
 * adicional dentro de `track()`, sin tocar ni un solo call-site.
 *
 * Privacidad: el beacon NO lleva cookie, ID ni PII — solo el nombre de un
 * evento de un whitelist cerrado, y el backend solo incrementa un contador
 * agregado. Por eso se emite salvo opt-out explícito (`getConsent() === 'denied'`),
 * igual que el logging de errores de Sentry corre por interés legítimo y solo
 * el Replay (que graba sesión) exige consentimiento. (Revisión legal pendiente
 * del owner — ver private/qa/NECESITA-DIEGO.md.)
 */
import { API_BASE } from './api'
import { CONSENT_DENIED, getConsent } from './consent'

const BEACON_URL = `${API_BASE}/api/funnel/event`

// Whitelist cliente — DEBE coincidir con EVENTOS_PERMITIDOS de FunnelController.
// Un evento fuera de aquí se descarta antes de salir a red.
export const FUNNEL_EVENTS = Object.freeze({
  LANDING_VIEW: 'landing_view',
  VOTE_WALL_HIT: 'vote_wall_hit',
  SHARE_CLICK: 'share_click',
  REFERRAL_LANDING: 'referral_landing',
  REGISTER_START: 'register_start',
})

const EVENTOS_VALIDOS = new Set(Object.values(FUNNEL_EVENTS))

function consentidoParaMedir() {
  // Aggregate cookieless: se mide salvo opt-out explícito del usuario.
  try {
    return getConsent() !== CONSENT_DENIED
  } catch {
    return true
  }
}

function enviarBeacon(event) {
  // El evento viaja en el query param `e`, SIN cuerpo de petición. Así
  // sendBeacon (que manda text/plain por defecto) no choca nunca con el
  // content-type del backend: el endpoint siempre responde 204.
  const url = `${BEACON_URL}?e=${encodeURIComponent(event)}`
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(url)) return
    }
  } catch {
    /* sendBeacon puede lanzar en algunos navegadores: caemos a fetch */
  }
  try {
    if (typeof fetch === 'function') {
      // keepalive: el beacon sobrevive a la navegación que descarga la página.
      fetch(url, { method: 'POST', keepalive: true, credentials: 'omit' }).catch(() => {})
    }
  } catch {
    /* la telemetría JAMÁS rompe la app */
  }
}

/**
 * Reporta un paso del embudo. No-op silencioso si el evento no está en el
 * whitelist o si el usuario rechazó la medición. Nunca lanza.
 *
 * @param {string} event  uno de {@link FUNNEL_EVENTS}
 * @param {object} [props] reservado para sinks futuros (Plausible/PostHog); el
 *                         beacon actual solo envía el nombre del evento.
 */
export function track(event /* , props */) {
  if (!EVENTOS_VALIDOS.has(event)) return
  if (!consentidoParaMedir()) return
  enviarBeacon(event)
}
