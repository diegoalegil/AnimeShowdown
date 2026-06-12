import { Component } from 'react'
import { Sentry } from '../lib/sentry'
import BroadcastInterruption from './BroadcastInterruption'
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

    let shouldReport = true
    if (typeof this.props.shouldReportError === 'function') {
      try {
        shouldReport = this.props.shouldReportError(error, info) !== false
      } catch {
        shouldReport = true
      }
    }

    if (shouldReport) {
      // Reporta a Sentry si está inicializado (lib/sentry.js solo llama
      // init si hay VITE_SENTRY_DSN). Si no, captureException es no-op
      // silencioso del propio SDK. Pasamos componentStack como contexto.
      try {
        Sentry.captureException(error, {
          contexts: { react: { componentStack: info?.componentStack } },
        })
        // El parte nº de la pantalla de interrupción; si Sentry no está,
        // queda undefined y la franja del parte no se renderiza.
        const eventId = Sentry.lastEventId?.()
        if (eventId) this.setState({ eventId })
      } catch {
        /* Sentry roto no debe tumbar el boundary */
      }
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
    this.setState({ hasError: false, error: null, staleAsset: false, eventId: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : this.props.fallback
    }

    // La interrupción de la retransmisión: carta de ajuste + sello 乱.
    // Aislada a propósito del árbol que pudo romper (cero router/contexts).
    return (
      <BroadcastInterruption
        eventId={this.state.eventId || undefined}
        esChunkError={this.state.staleAsset}
        onRetry={this.reset}
      />
    )
  }
}

export default ErrorBoundary
