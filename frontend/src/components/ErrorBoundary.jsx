import { Component } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Sentry } from '../lib/sentry'

/**
 * Error boundary global (Plan v2 §3.7).
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
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
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
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReload = () => {
    // Hard reload — reset completo del state de React + bundle nuevo si
    // hubo deploy mientras tanto (caso "rompí algo, hice fix, redeploy,
    // usuario reload y se cura").
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <section className="relative min-h-[100svh] overflow-hidden bg-bg text-fg-strong">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/img/stage/error-rain.webp')] bg-cover bg-[63%_center] sm:bg-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_48%,rgba(255,46,99,0.18),transparent_32%),linear-gradient(90deg,rgba(8,8,13,0.92)_0%,rgba(8,8,13,0.72)_36%,rgba(8,8,13,0.28)_70%,rgba(8,8,13,0.08)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg via-bg/60 to-transparent"
        />

        <div className="relative z-10 flex min-h-[100svh] w-full items-center px-5 py-12 sm:px-10 lg:px-20">
          <div className="w-full max-w-xl rounded-2xl border border-accent/45 bg-[#160916]/72 p-6 shadow-[0_0_80px_rgba(255,46,99,0.18)] backdrop-blur-xl sm:p-9">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/15 text-rose-200 shadow-[0_0_32px_rgba(255,46,99,0.24)]">
              <AlertTriangle className="h-6 w-6" />
            </span>

            <div className="mt-8 flex flex-col gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-accent">
                Error de escena
              </p>
              <h1 className="max-w-sm text-3xl font-black tracking-tight sm:text-4xl">
                La batalla se ha interrumpido
              </h1>
              <p className="max-w-md text-sm leading-7 text-fg-muted sm:text-base">
                Algo falló al cargar esta pantalla. Recarga para volver al
                combate; si vuelve a pasar, avísanos en{' '}
                <a
                  href="mailto:soporte@animeshowdown.dev"
                  className="font-semibold text-accent hover:text-accent-hover"
                >
                  soporte@animeshowdown.dev
                </a>
                .
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-black text-white shadow-[0_0_28px_rgba(255,46,99,0.32)] transition-colors hover:bg-accent-hover"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-accent/45 hover:text-accent"
              >
                <Home className="h-4 w-4" />
                Volver al inicio
              </a>
            </div>

            <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-fg-muted/70">
              El error queda registrado para poder rastrearlo.
            </p>

            {/* Detalles solo en desarrollo — en producción ocultamos el
                stacktrace para no exponer internals del bundle. */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-5 w-full">
                <summary className="cursor-pointer text-[11px] font-mono text-fg-muted">
                  Stack (solo en dev)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-white/10 bg-bg/85 p-3 text-[11px] text-rose-300">
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
