import { useEffect, useId, useRef } from 'react'
import './key-lantern.css'

/**
 * KeyLantern — el emblema compartido de /forgot y /reset: una linterna de
 * papel (chōchin) con el kanji 灯 y, colgando de ella, una llave en su
 * cerradura. Es 100% decorativa (aria-hidden); el estado se anuncia por
 * el aria-live de la página.
 *
 * Coreografía (clases en el bloque as-kl-* de key-lantern.css):
 * - `state="lit"`     → prende: 2 capas de luz pre-renderizadas en
 *   cross-fade de opacity 400ms var(--ease-brush) (papel interior a 0ms,
 *   halo exterior a +80ms). Trazos y kanji cambian de color en la misma
 *   ventana (one-shot, patrón transition-colors).
 * - `state="expired"` → parpadea UNA vez y se apaga: keyframes
 *   as-kl-blink-out, 380ms total (dip ~110ms, recuperación ~200ms,
 *   apagado final 200ms).
 * - `keyTurned`       → la llave gira 90° UNA vez, 450ms var(--ease-lift),
 *   pivote en el centro de la cerradura. El click metálico lo dispara la
 *   página con `play('playClick')` (useSound) en el MISMO handler de
 *   confirmación — el componente no toca audio.
 *
 * Único loop decorativo: la respiración del halo (opacity, 5.6s). Se pausa
 * con html.as-calm, con la pestaña oculta y fuera del viewport (este
 * componente pone data-paused vía visibilitychange + IntersectionObserver).
 * prefers-reduced-motion: estados finales directos, cero transición
 * (reglas en el bloque CSS).
 *
 * @param {object} props
 * @param {'unlit'|'lit'|'expired'} [props.state='unlit'] Estado de la linterna.
 *   'expired' asume que venía de 'lit' (la animación arranca encendida).
 * @param {boolean} [props.keyTurned=false] La llave girada 90° (true tras
 *   confirmar el reset; en reduced-motion pinta el estado final sin giro).
 * @param {boolean} [props.showLock=true] Renderiza la cerradura + llave.
 *   Ponlo a false si una pantalla solo necesita la linterna.
 * @param {number} [props.width=116] Ancho en px de la linterna (la cerradura
 *   escala a 0.46×).
 * @param {string} [props.className] Clases extra para el contenedor.
 *
 * @example
 * // /forgot — prende al confirmar el envío:
 * <KeyLantern state={enviado ? 'lit' : 'unlit'} />
 *
 * @example
 * // /reset — gira al confirmar; caducada parpadea y se apaga:
 * <KeyLantern state={caducada ? 'expired' : 'lit'} keyTurned={confirmado} />
 */
function KeyLantern({ state = 'unlit', keyTurned = false, showLock = true, width = 116, className = '' }) {
  // id único por instancia para el gradiente (varias linternas por página).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gid = `klGlow${uid}`
  const rootRef = useRef(null)

  // Pausa del loop decorativo: pestaña oculta o fuera del viewport.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    let inView = true
    const apply = () => {
      if (document.hidden || !inView) el.setAttribute('data-paused', '')
      else el.removeAttribute('data-paused')
    }
    const onVis = () => apply()
    document.addEventListener('visibilitychange', onVis)
    let io = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0]
        inView = Boolean(entry && entry.isIntersecting)
        apply()
      })
      io.observe(el)
    }
    apply()
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (io) io.disconnect()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={`as-kl ${className}`.trim()}
      aria-hidden="true"
      data-lit={state === 'lit' ? '' : undefined}
      data-expired={state === 'expired' ? '' : undefined}
      data-key-turned={keyTurned ? '' : undefined}
    >
      <div className="as-kl__lantern">
        {/* Capa de luz B — halo exterior (radial pre-renderizado) */}
        <div className="as-kl__halo" />
        <svg
          className="as-kl__svg"
          viewBox="0 0 120 150"
          width={width}
          height={Math.round((width * 150) / 120)}
        >
          <defs>
            <radialGradient id={gid} cx="50%" cy="44%" r="62%">
              <stop offset="0%" stopColor="var(--color-gold-pale)" stopOpacity="0.95" />
              <stop offset="42%" stopColor="var(--color-gold)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* papel */}
          <ellipse cx="60" cy="78" rx="42" ry="52" fill="var(--color-surface)" />
          {/* Capa de luz A — papel encendido */}
          <ellipse className="as-kl__light" cx="60" cy="76" rx="40" ry="50" fill={`url(#${gid})`} />
          {/* kanji 灯 — luz/lámpara, tipografiado con --font-kanji-serif */}
          <text className="as-kl__kanji" x="60" y="92" textAnchor="middle">灯</text>
          {/* esqueleto: suspensión, tapas, aro, varillas, cordel */}
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="60" y1="0" x2="60" y2="14" />
            <rect x="44" y="14" width="32" height="12" rx="3" fill="var(--color-surface-alt)" />
            <ellipse cx="60" cy="78" rx="42" ry="52" />
            <path d="M 29.7 42 Q 60 50 90.3 42" strokeWidth="1" opacity="0.6" />
            <path d="M 20.6 60 Q 60 68 99.4 60" strokeWidth="1" opacity="0.6" />
            <path d="M 18 78 Q 60 86 102 78" strokeWidth="1" opacity="0.6" />
            <path d="M 20.6 96 Q 60 104 99.4 96" strokeWidth="1" opacity="0.6" />
            <path d="M 29.7 114 Q 60 121 90.3 114" strokeWidth="1" opacity="0.6" />
            <rect x="47" y="130" width="26" height="9" rx="2.5" fill="var(--color-surface-alt)" />
            <line x1="60" y1="139" x2="60" y2="150" />
          </g>
        </svg>
      </div>
      {showLock && (
        <div className="as-kl__lock">
          <svg viewBox="0 0 64 64" width={Math.round(width * 0.46)} height={Math.round(width * 0.46)}>
            {/* cerradura */}
            <circle className="as-kl__ring" cx="32" cy="32" r="24" fill="none" strokeWidth="1.5" />
            {/* llave — gira sobre el centro de la cerradura (32,32) */}
            <g className="as-kl__key" fill="none" strokeWidth="3" strokeLinecap="round">
              <circle cx="32" cy="18" r="6.5" />
              <line x1="32" y1="24.5" x2="32" y2="46" />
              <line x1="32" y1="39" x2="40" y2="39" />
              <line x1="32" y1="45" x2="38" y2="45" />
            </g>
          </svg>
        </div>
      )}
    </div>
  )
}

export default KeyLantern
