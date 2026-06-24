import { useEffect, useRef } from 'react'
import { getEstadoEvento, getMsRestantes } from '../../../data/eventos'
import { descomponerMs, fraseCountdown, pad2 } from './festival-core'

/**
 * EventCountdown — countdown HONESTO del evento en odometro mono, cableado a las
 * fechas REALES del dominio (`inicioISO`/`finISO`) via los helpers de
 * `data/eventos.js` (getMsRestantes/getEstadoEvento). Si el evento esta PROXIMO
 * cuenta al inicio ("Empieza en"), si esta ACTIVO al fin ("Termina en").
 *
 * El timer vive en un effect (tick 1s) y SOLO ahi se lee Date.now(); el cuerpo
 * del render no toca el reloj (regla compiler/React 19).
 *
 * AT-safe: el contenedor es role="timer" aria-live="off" (no taladra cada
 * segundo). Las cifras vivas se escriben por REF (no por estado: evita re-render
 * por segundo). Un nodo sr aparte se actualiza con la frase completa SOLO al
 * cambiar el minuto ("Termina en 2 dias y 4 horas").
 *
 * Pausa con la pestaña oculta (document.hidden) para no contar en segundo plano.
 *
 * @param {object} props
 * @param {{inicioISO:string, finISO:string}} props.evento  shape REAL del evento
 * @param {boolean} [props.hero]  realce visual cuando el countdown es protagonista
 */
export default function EventCountdown({ evento, hero = false }) {
  const wrapRef = useRef(null)
  const srRef = useRef(null)

  useEffect(() => {
    if (!evento) return undefined
    let lastMin = -1
    const setDigit = (k, v) => {
      const el = wrapRef.current?.querySelector(`[data-key="${k}"]`)
      if (el) el.textContent = v
    }
    const tick = () => {
      if (document.hidden) return // pausado con la pestaña oculta
      const ahora = new Date()
      const est = getEstadoEvento(evento, ahora)
      const ms = getMsRestantes(evento, ahora)
      const d = descomponerMs(ms)
      setDigit('dias', pad2(d.dias))
      setDigit('horas', pad2(d.horas))
      setDigit('mins', pad2(d.mins))
      // Frase AT refrescada por MINUTO (no por segundo): los AT no reciben tic.
      const minNow = Math.floor(ms / 60000)
      if (minNow !== lastMin) {
        lastMin = minNow
        if (srRef.current) srRef.current.textContent = fraseCountdown(ms, est)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    const onVis = () => { if (!document.hidden) { lastMin = -1; tick() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [evento])

  // El cuerpo del render NO lee el reloj (regla compiler/React 19): el effect
  // corre tick() en el montaje y rellena cifras + frase AT al instante.
  return (
    <>
      <div ref={wrapRef} className={`fest-count${hero ? ' fest-count--hero' : ''}`} role="timer" aria-live="off">
        <div className="fest-count__unit">
          <span className="fest-count__value" data-key="dias">--</span>
          <span className="fest-count__label">días</span>
        </div>
        <span className="fest-count__sep" aria-hidden="true">:</span>
        <div className="fest-count__unit">
          <span className="fest-count__value" data-key="horas">--</span>
          <span className="fest-count__label">hrs</span>
        </div>
        <span className="fest-count__sep" aria-hidden="true">:</span>
        <div className="fest-count__unit">
          <span className="fest-count__value" data-key="mins">--</span>
          <span className="fest-count__label">min</span>
        </div>
      </div>
      {/* Frase completa para AT, refrescada cada minuto (no cada segundo).
          La rellena el effect (tick) en el montaje; vacia hasta entonces. */}
      <span className="fest-sr" aria-live="off" ref={srRef} />
    </>
  )
}
