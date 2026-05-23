import * as Sentry from '@sentry/react'

/**
 * Inicializa Sentry si hay DSN configurado.
 *
 * - VITE_SENTRY_DSN se inyecta en build time desde Cloudflare Pages Env Vars.
 * - Si no hay DSN (dev local sin .env, o despliegues antes de configurar),
 *   no inicializamos Sentry y captureException queda como no-op silencioso.
 * - tracesSampleRate 0.1 = 10% de transacciones (recomendación oficial para
 *   apps de tráfico moderado en plan free de 10k errores/mes).
 * - replaysOnErrorSampleRate 1.0 + replaysSessionSampleRate 0 = solo grabamos
 *   sesión cuando hay error (no consume cuota innecesariamente).
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    // Log discreto, no warning, para no ensuciar la consola en dev.
    if (import.meta.env.DEV) {
      console.info('[sentry] VITE_SENTRY_DSN no definido — Sentry deshabilitado')
    }
    return
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // GDPR-friendly: NO enviamos IP del cliente ni cookies por defecto.
    // Sentry recomienda true en su quickstart pero eso captura PII sin
    // consentimiento explícito del usuario. Si en el futuro añadimos un
    // banner de cookies que cubra "telemetría de errores", se puede subir
    // a true. Servidor en .de.sentry.io = EU residency, otra capa GDPR.
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
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
}

export { Sentry }
