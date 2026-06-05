import { Component } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Sentry } from '../lib/sentry'
import { BRAND_VISUALS } from '../data/visual-assets'
import { LEGAL_CONTACT_EMAIL, LEGAL_CONTACT_MAILTO } from '../data/legal'
import {
  isStaleAssetError,
  recoverFromStaleAssetError,
} from '../lib/staleAssetRecovery'

/**
 * Error boundary global.
 *
 * React no atrapa errores async ni los disparados durante el render del
 * propio boundary; cubrimos solo errores síncronos del árbol descendiente,
 * que son ~95% del riesgo en producción (props inválidas, undefined
 * accesses, throws en componentes).
 *
 * Cuando lo capture muestra una escena de fallback completa con salida segura
 * a inicio y botón de recarga. Sentry (configurado en main.jsx) recibe el
 * error en paralelo vía componentDidCatch.
 *
 * No usa estado de routing: si el error pasó al renderizar /perfil, recargar
 * navega al mismo /perfil porque ese es el URL actual. Si el error es
 * persistente (bug duro), recargar lo seguirá disparando; en ese caso el
 * usuario verá la UI siempre y al menos no es pantalla en blanco.
 */
class ErrorBoundary extends Component {
  state = { hasError: false, error: null, staleAsset: false }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, staleAsset: isStaleAssetError(error) }
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  componentDidCatch(error, info) {
    const recoveringStaleAsset = recoverFromStaleAssetError(error)

    if (recoveringStaleAsset) {
      if (import.meta.env.DEV) {
        console.warn('[ErrorBoundary] stale asset detectado; recargando shell', error)
      }
      return
    }

    // Reporta a Sentry si está inicializado (lib/sentry.js solo llama
    // init si hay VITE_SENTRY_DSN). Si no, captureException es no-op
    // silencioso del propio SDK. Pasamos componentStack como contexto.
    try {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: info?.componentStack } },
      })
    } catch {
      /* Sentry roto no debe tumbar el boundary */
    }
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info?.componentStack)
    }
  }

  handleReload = () => {
    // Hard reload — reset completo del state de React + bundle nuevo si
    // hubo deploy mientras tanto (caso "rompí algo, hice fix, redeploy,
    // usuario reload y se cura").
    window.location.reload()
  }

  reset = () => {
    this.setState({ hasError: false, error: null, staleAsset: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : this.props.fallback
    }

    const visual = BRAND_VISUALS.error
    const image = visual.image || visual.fallbackImage || '/img/stage/error-rain.webp'
    const staleAsset = this.state.staleAsset
    const eyebrow = staleAsset ? 'Nueva versión disponible' : 'Error de escena'
    const title = staleAsset ? 'Actualizando la arena' : 'La batalla se ha interrumpido'
    const copy = staleAsset
      ? 'Tu navegador tenía una pieza antigua de la página. Recarga para tomar la versión nueva y volver al combate.'
      : 'Algo falló al cargar esta pantalla. Recarga para volver al combate; si vuelve a pasar, avísanos en'

    return (
      <section className="relative min-h-[100svh] overflow-hidden bg-bg text-fg-strong">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-[63%_center] sm:bg-center"
          style={{ backgroundImage: `url("${image}")` }}
        />
        <div
          aria-hidden="true"
          className="as-error-boundary-scrim absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg via-bg/60 to-transparent"
        />

        <div className="relative z-10 flex min-h-[100svh] w-full items-center px-5 py-12 sm:px-10 lg:px-20">
          <div className="as-error-boundary-panel w-full max-w-xl rounded-2xl border border-accent/42 p-6 shadow-aura-lg inset-shadow-hairline backdrop-blur-xl sm:p-9">
            <span className="as-error-boundary-icon inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold shadow-aura">
              <AlertTriangle className="h-6 w-6" />
            </span>

            <div className="mt-8 flex flex-col gap-3">
              <p className="text-[11px] font-black text-gold">
                {eyebrow}
              </p>
              <h1 className="max-w-sm text-3xl font-black tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-md text-sm leading-7 text-fg-muted sm:text-base">
                {copy}
                {!staleAsset && (
                  <>
                    {' '}
                    <a
                      href={LEGAL_CONTACT_MAILTO}
                      className="font-semibold text-gold hover:text-fg-strong"
                    >
                      {LEGAL_CONTACT_EMAIL}
                    </a>
                    .
                  </>
                )}
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent/55 bg-gradient-to-b from-accent-hover to-accent px-5 py-3 text-sm font-black text-white shadow-aura inset-shadow-hairline-strong transition-all hover:-translate-y-0.5 hover:brightness-110"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
              >
                <Home className="h-4 w-4" />
                Volver al inicio
              </a>
            </div>

            <p className="mt-6 text-[11px] text-fg-muted/70">
              El error queda registrado para poder rastrearlo.
            </p>

            {/* Detalles solo en desarrollo — en producción ocultamos el
                stacktrace para no exponer internals del bundle. */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-5 w-full">
                <summary className="cursor-pointer text-[11px] font-mono text-fg-muted">
                  Stack (solo en dev)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/10 bg-bg/85 p-3 text-[11px] text-gold">
                  {String(this.state.error.stack || this.state.error)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </section>
    )
  }
}

export default ErrorBoundary
