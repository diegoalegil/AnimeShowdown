import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../contexts/SoundContext'
import { useReducedMotionPref } from '../../hooks/useReducedMotionPref'

import './tesoro.css'

const DIGITOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function formatearMonedas(n) {
  return new Intl.NumberFormat('es-ES').format(n)
}

/**
 * Rueda de un dígito del odómetro. Columna 0-9 que rueda por translateY
 * (compositor-only); la posición la escribe --tsr-d y la transición vive
 * en CSS (var(--tesoro-odo-ms), var(--ease-lift)).
 */
function Rueda({ digito }) {
  return (
    <span className="tesoro-odo-celda">
      <span className="tesoro-odo-rueda" style={{ '--tsr-d': digito }}>
        {DIGITOS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </span>
    </span>
  )
}

/**
 * Odómetro del saldo. Claves estables contadas DESDE LA DERECHA: al crecer
 * de 999 a 1.024 las ruedas de unidades/decenas/centenas conservan
 * identidad y ruedan; la rueda nueva monta ya en su dígito (sin animación
 * de montaje — coherente con "cero ceremonia en el primer paint").
 *
 * <p>Decorativo para AT (aria-hidden): el valor real lo anuncia el
 * aria-live del CoinPurse.
 */
function Odometro({ valor }) {
  const chars = Array.from(formatearMonedas(Math.max(0, valor)))
  const nodos = []
  let dDesdeDerecha = 0
  let sDesdeDerecha = 0
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i]
    if (ch >= '0' && ch <= '9') {
      nodos.unshift(<Rueda key={`d${dDesdeDerecha}`} digito={Number(ch)} />)
      dDesdeDerecha += 1
    } else {
      nodos.unshift(
        <span key={`s${sDesdeDerecha}`} className="tesoro-odo-sep">
          {ch}
        </span>,
      )
      sDesdeDerecha += 1
    }
  }
  return (
    <span className="tesoro-odo" aria-hidden="true">
      {nodos}
    </span>
  )
}

/**
 * CoinPurse — el monedero vivo.
 *
 * <p>Ley del proyecto (anti-drift): el saldo mostrado es SIEMPRE el del
 * server. Este componente jamás suma por su cuenta — deriva el delta
 * visual comparando el prop nuevo con el anterior, pero lo que pinta el
 * odómetro es exactamente {@code saldo}.
 *
 * <p>Coreografía en cambios REALES de saldo (nunca en el primer paint):
 *  - flip de moneda con grosor fingido: 2 capas escalonadas + scaleX,
 *    400ms (var(--tesoro-flip-ms)), -webkit-backface-visibility en ambas;
 *  - odómetro: ruedas translateY, 480ms var(--ease-lift);
 *  - delta flotante único en mono (oro al ganar, sube; carmesí AA al
 *    gastar, baja), 600ms. RÁFAGAS: el delta en vuelo ABSORBE el importe
 *    nuevo y reinicia su vida (remontaje por key) — nunca llueven deltas.
 *  - saldo a 0: sin flip; la moneda descansa de canto (transición) y se
 *    muestra un mensaje honesto.
 *
 * <p>Sonido: clink corto SOLO en ganancia (lib/sounds.js#playClink vía
 * SoundContext — respeta el mute global). Nada en gasto.
 *
 * <p>reduced-motion: ni flip ni delta (no se montan); el odómetro pinta
 * directo (la transición la mata el bloque CSS).
 *
 * <p>React 19 / Compiler: el "prev" se ajusta con setState-durante-render
 * (patrón oficial de adaptación a props), no con setState en effect; el
 * único effect es el side-effect de sonido (lee/escribe su ref ahí, no en
 * render). Inicializadores puros → StrictMode doble-monta sin ruido.
 *
 * @param {object} props
 * @param {number} props.saldo Saldo REAL del server (fuente única de verdad).
 * @param {string} [props.etiqueta='monedas'] Sustantivo para etiqueta y aria-live.
 * @param {string} [props.mensajeCero='A cero — la moneda descansa de canto.']
 *   Mensaje honesto del estado vacío. El copy definitivo no existe en
 *   producto: queda como prop documentada (ver notas de handoff).
 * @param {string} [props.className] Clases extra para el panel.
 */
export default function CoinPurse({
  saldo,
  etiqueta = 'monedas',
  mensajeCero = 'A cero — la moneda descansa de canto.',
  className = '',
}) {
  const reduce = useReducedMotionPref()
  const { play } = useSound()
  const [prev, setPrev] = useState(saldo)
  // fx = { delta, dir: 'gana'|'gasta', key } — ÚNICO slot de delta en vuelo.
  const [fx, setFx] = useState(null)

  // Adaptación a cambio de prop durante el render (sin effects, sin refs).
  if (saldo !== prev) {
    const delta = saldo - prev
    setPrev(saldo)
    if (!reduce) {
      setFx((enVuelo) => {
        const dir = delta > 0 ? 'gana' : 'gasta'
        const key = (enVuelo?.key ?? 0) + 1
        // Coalescencia: misma dirección → el delta en vuelo absorbe el
        // importe y reinicia su vida. Dirección opuesta → lo sustituye.
        if (enVuelo && enVuelo.dir === dir) {
          return { delta: enVuelo.delta + delta, dir, key }
        }
        return { delta, dir, key }
      })
    }
  }

  // Clink SOLO en ganancia; independiente de reduced-motion, respeta el
  // mute global vía SoundContext. Ref solo se toca dentro del effect.
  const saldoSonadoRef = useRef(saldo)
  useEffect(() => {
    if (saldo > saldoSonadoRef.current) play('playClink')
    saldoSonadoRef.current = saldo
  }, [saldo, play])

  const enCero = saldo === 0
  const clasesCoin = [
    'tesoro-coin',
    // El flip JAMÁS dispara en mount (fx null) ni al quedarse a 0 (ahí la
    // moneda cae de canto por transición, sin ceremonia de giro).
    fx && !enCero ? 'tesoro-coin--flip' : '',
    enCero ? 'tesoro-coin--decanto' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={`tesoro-monedero tesoro-panel ${className}`}>
      {/* key por fx: el remontaje reinicia la animación CSS sin hacks de
          reflow (void offsetWidth) — barato y seguro en Safari. */}
      <span className={clasesCoin} key={fx?.key ?? 'reposo'} aria-hidden="true">
        <span className="tesoro-coin-capa tesoro-coin-canto"></span>
        <span className="tesoro-coin-capa tesoro-coin-cara" lang="ja">
          金<span className="tesoro-coin-sombra"></span>
        </span>
      </span>

      <div className="tesoro-monedero-info">
        <span className="tesoro-monedero-etiqueta">{etiqueta}</span>
        <span className="tesoro-saldo">
          <Odometro valor={saldo} />
          {fx && (
            <span
              key={fx.key}
              className={`tesoro-delta tesoro-delta--${fx.dir}`}
              onAnimationEnd={() => setFx(null)}
              aria-hidden="true"
            >
              {fx.delta > 0
                ? `+${formatearMonedas(fx.delta)}`
                : `\u2212${formatearMonedas(-fx.delta)}`}
            </span>
          )}
        </span>
        {enCero && <p className="tesoro-monedero-vacio">{mensajeCero}</p>}
      </div>

      {/* Anuncio AT: polite — en ráfagas, VoiceOver/NVDA colapsan los
          intermedios y leen el último saldo (deseable). */}
      <p className="sr-only" aria-live="polite">
        saldo: {formatearMonedas(saldo)} {etiqueta}
      </p>
    </section>
  )
}
