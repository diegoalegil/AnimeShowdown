import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Sentry } from '../lib/sentry'

/**
 * Error boundary global (Plan v2 §3.7).
 *
 * React no atrapa errores async ni los disparados durante el render del
 * propio boundary; cubrimos solo errores síncronos del árbol descendiente,
 * que son ~95% del riesgo en producción (props inválidas, undefined
 * accesses, throws en componentes).
 *
 * Cuando lo capture muestra una UI minimal con "Ups, algo fue mal" + botón
 * para recargar. Sentry (configurado en main.jsx) recibe el error en
 * paralelo vía componentDidCatch — el boundary llama a window.Sentry si
 * está disponible.
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
      <section className="flex min-h-[60vh] items-center justify-center px-5 py-16 sm:px-8">
        <div className="flex w-full max-w-md flex-col items-start gap-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl tracking-tight">Ups, algo fue mal</h1>
            <p className="text-[13px] text-fg-muted">
              Hemos detectado un error inesperado en la web y ya lo estamos
              registrando. Prueba a recargar; si vuelve a pasar dínoslo en{' '}
              <a
                href="mailto:diegogildam@gmail.com"
                className="text-accent hover:text-accent-hover"
              >
                diegogildam@gmail.com
              </a>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar página
          </button>
          {/* Detalles solo en desarrollo — en producción ocultamos el
              stacktrace para no exponer internals del bundle. */}
          {import.meta.env.DEV && this.state.error && (
            <details className="w-full">
              <summary className="cursor-pointer text-[11px] font-mono text-fg-muted">
                Stack (solo en dev)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-bg p-3 text-[11px] text-rose-300">
                {String(this.state.error.stack || this.state.error)}
              </pre>
            </details>
          )}
        </div>
      </section>
    )
  }
}

export default ErrorBoundary
