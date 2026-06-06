import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  getConsent,
  setConsent,
} from '../lib/consent'

/**
 * Banner de consentimiento (RGPD). Solo aparece la primera vez (mientras no
 * haya elección guardada). Gatea SOLO la telemetría no esencial (Session Replay
 * de Sentry); las cookies de autenticación son esenciales y no se piden.
 *
 * <p>Aceptar/Rechazar persisten la elección (localStorage) y ocultan el banner.
 * El Session Replay se activa en el siguiente arranque de Sentry si se aceptó
 * (la fachada de sentry.js lee el consentimiento al inicializar). Reusa los
 * tokens/paneles existentes; sin paleta nueva.
 */
function CookieConsent() {
  // Inicializador perezoso (client-only): el banner aparece solo si aún no hay
  // elección guardada. Sin efecto → sin setState-en-effect.
  const [visible, setVisible] = useState(() => getConsent() == null)

  if (!visible) return null

  const elegir = (valor) => {
    setConsent(valor)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="as-panel mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lift sm:flex-row sm:items-center sm:gap-4">
        <p className="min-w-0 flex-1 text-[12px] leading-5 text-fg-muted sm:text-[13px]">
          Usamos cookies <strong className="text-fg-strong">esenciales</strong> para
          que la app funcione (sesión, preferencias). Con tu permiso activamos
          también <strong className="text-fg-strong">telemetría de errores</strong>{' '}
          (grabación de sesión de Sentry) para detectar y arreglar fallos.{' '}
          <Link to="/privacidad" className="font-semibold text-gold underline">
            Más info
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => elegir(CONSENT_DENIED)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-[12px] font-bold text-fg-muted transition-colors hover:text-fg-strong"
          >
            Solo esenciales
          </button>
          <button
            type="button"
            onClick={() => elegir(CONSENT_GRANTED)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-accent-hover"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
