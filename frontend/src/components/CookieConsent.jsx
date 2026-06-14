import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  getConsent,
  setConsent,
} from '../lib/consent'
import ConsentScroll from './ConsentScroll'

/**
 * Banner de consentimiento (RGPD). Solo aparece la primera vez (mientras no
 * haya elección guardada). Gatea SOLO la telemetría no esencial (Session Replay
 * de Sentry); las cookies de autenticación son esenciales y no se piden.
 *
 * <p>La piel la pone ConsentScroll («el pergamino del consentimiento»): franja
 * de papel con dos sellos hanko EQUIVALENTES. Este host conserva todo el gating
 * real: `onDecide` escribe la elección (localStorage + evento de consent) en el
 * instante del click, y `onDismissed` (fin del enrollado) oculta el banner. El
 * mapeo es accept → CONSENT_GRANTED, essentials → CONSENT_DENIED.
 */
function CookieConsent() {
  // Inicializador perezoso (client-only): el banner aparece solo si aún no hay
  // elección guardada. Sin efecto → sin setState-en-effect.
  const [visible, setVisible] = useState(() => getConsent() == null)

  if (!visible) return null

  return (
    <ConsentScroll
      open
      onDecide={(kind) =>
        setConsent(kind === 'accept' ? CONSENT_GRANTED : CONSENT_DENIED)
      }
      onDismissed={() => setVisible(false)}
      labels={{
        region: 'Consentimiento de cookies',
        essentials: 'Solo esenciales',
        accept: 'Aceptar',
      }}
      legalText={
        <>
          Usamos cookies <strong className="text-fg-strong">esenciales</strong> para
          que la app funcione (sesión, preferencias). Con tu permiso activamos
          también <strong className="text-fg-strong">telemetría de errores</strong>{' '}
          (grabación de sesión de Sentry) para detectar y arreglar fallos.
        </>
      }
      moreInfo={
        <Link to="/privacidad" className="cs-more">
          Más información
        </Link>
      }
    />
  )
}

export default CookieConsent
