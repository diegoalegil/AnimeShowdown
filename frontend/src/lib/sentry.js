// Carga diferida de Sentry.
//
// El SDK (@sentry/react + browserTracing + replay) pesa ~80-100KB gzip.
// Importarlo estático lo metía en el bundle de ENTRADA y lo ejecutaba antes
// de montar React, penalizando el first paint de TODAS las rutas. Ahora el
// SDK se trae con import() dinámico (initSentry, programado en idle) y queda
// en su propio chunk async fuera del entry.
//
// `Sentry` es una fachada estable: sus métodos delegan en el SDK real cuando
// está cargado y son no-op mientras no lo esté (o si no hay DSN). Así los
// consumidores (ErrorBoundary, SoundContext, vitals) no cambian — siguen
// importando { Sentry } y llamando Sentry.captureException / setMeasurement.

const DSN = import.meta.env.VITE_SENTRY_DSN

let sdk = null
let cargando = null

async function cargarYConfigurar() {
  const mod = await import('@sentry/react')
  mod.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    // GDPR-friendly: NO enviamos IP del cliente ni cookies por defecto.
    // Sentry recomienda true en su quickstart pero eso captura PII sin
    // consentimiento explícito del usuario. Si en el futuro añadimos un
    // banner de cookies que cubra "telemetría de errores", se puede subir
    // a true. Servidor en .de.sentry.io = EU residency, otra capa GDPR.
    sendDefaultPii: false,
    integrations: [
      mod.browserTracingIntegration(),
      mod.replayIntegration({
        // Solo grabar replays cuando hay error — ahorra cuota y privacidad.
        // maskAllText: true para no leakear nombres de usuario, emails u
        // otros datos en los replays grabados.
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Filtramos errores ruidosos comunes que no aportan valor: extensiones
    // del browser, scripts de terceros, abortos de fetch del usuario.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'AbortError',
      // Errores de extensiones de Chrome/Safari que inyectan código en la página.
      /^chrome-extension:/,
      /^moz-extension:/,
    ],
  })
  sdk = mod
  return mod
}

/**
 * Inicializa Sentry si hay DSN configurado. Idempotente y diferido: trae el
 * SDK con import() dinámico, así que se debe llamar en idle (ver main.jsx),
 * NO en el path crítico de arranque.
 *
 * - VITE_SENTRY_DSN se inyecta en build time desde Cloudflare Pages Env Vars.
 * - Si no hay DSN (dev local sin .env, o despliegues antes de configurar), no
 *   carga ni inicializa nada y la fachada queda como no-op silencioso.
 * - tracesSampleRate 0.1 = 10% de transacciones (recomendación oficial para
 *   apps de tráfico moderado en plan free de 10k errores/mes).
 * - replaysOnErrorSampleRate 1.0 + replaysSessionSampleRate 0 = solo grabamos
 *   sesión cuando hay error (no consume cuota innecesariamente).
 *
 * Devuelve una Promise que resuelve al módulo del SDK (o null si no hay DSN /
 * falló la carga).
 */
export function initSentry() {
  if (!DSN) {
    // Log discreto, no warning, para no ensuciar la consola en dev.
    if (import.meta.env.DEV) {
      console.info('[sentry] VITE_SENTRY_DSN no definido — Sentry deshabilitado')
    }
    return Promise.resolve(null)
  }
  if (!cargando) {
    cargando = cargarYConfigurar().catch((err) => {
      // Si el chunk del SDK no carga (red, deploy a medias), no rompemos la
      // app: dejamos la fachada en no-op y permitimos reintento futuro.
      cargando = null
      if (import.meta.env.DEV) {
        console.warn('[sentry] no se pudo cargar el SDK', err)
      }
      return null
    })
  }
  return cargando
}

/**
 * Fachada estable de Sentry. Sus métodos delegan en el SDK real si ya está
 * cargado y son no-op si no. `captureException` además dispara la carga bajo
 * demanda: si ocurre un error ANTES de que initSentry corra en idle, el SDK
 * se trae al vuelo y el reporte no se pierde.
 */
export const Sentry = {
  captureException(error, context) {
    if (sdk) {
      try {
        return sdk.captureException(error, context)
      } catch {
        return undefined
      }
    }
    if (DSN) {
      // Carga diferida bajo demanda y captura al resolver (fire-and-forget).
      initSentry().then((mod) => {
        if (!mod) return
        try {
          mod.captureException(error, context)
        } catch {
          /* SDK roto no debe propagar */
        }
      })
    }
    return undefined
  },
  setMeasurement(name, value, unit) {
    if (sdk?.setMeasurement) {
      try {
        return sdk.setMeasurement(name, value, unit)
      } catch {
        return undefined
      }
    }
    // Si Sentry aún no cargó, la métrica se descarta (no-op). Web Vitals se
    // reportan al final de sesión, cuando Sentry ya está inicializado en prod.
    return undefined
  },
}
