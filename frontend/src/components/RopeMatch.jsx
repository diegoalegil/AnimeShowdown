/**
 * RopeMatch — placa de madera de un enfrentamiento del árbol de cuerdas.
 *
 * Sustituye la card visual de cada match en el detalle de torneo. Cada placa
 * muestra los dos retratos enfrentados, los nombres y el marcador de votos.
 * La placa expone el anclaje DOM que RopeBracket usa para tender las cuerdas:
 *
 *   data-rope-match="ronda:idx"   (0-based, posición VISUAL en su columna)
 *
 * Estados que pinta (todos derivados del DTO, NUNCA inventa ganadores):
 *   - abierto (ambos personajes, sin ganador): marcador con totalVotos.
 *   - resuelto: ganador en fg-strong + 勝, perdedor atenuado (laca apagada).
 *   - hueco parcial (rival por decidir): lado vacío con "?".
 *   - pendiente de sorteo (ambos null): ambos lados "?".
 *
 * Coreografía local (las cuerdas las anima RopeBracket):
 *   - revelado en vivo: latido UNA vez (scale 1.02, 250ms, WAAPI one-shot).
 *   - clasificado entrante: el lado nuevo SE CUELGA (rb-cuelga, delay).
 *
 * Los controles de voto y predicción se inyectan vía `extras` (children
 * debajo de la placa) para conservar EXACTA la integración de Bracket.jsx.
 */
import { useEffect, useRef, memo } from 'react'
import { Lock } from 'lucide-react'
import PersonajeCutImg from './PersonajeCutImg'
import LiveNumber from '../features/ranking/components/LiveNumber'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'

/**
 * @param {object} props
 * @param {object} props.match            EnfrentamientoDto (id, ronda, personaje1,
 *        personaje2, ganador, totalVotos). personaje1/2/ganador pueden ser null.
 * @param {boolean} [props.esFinal]       Aplica el realce del dosel (borde oro).
 * @param {string}  props.titulo          "Cuartos", "Semifinal"… para el aria-label.
 * @param {boolean} [props.revelarEnVivo] El match acaba de resolverse delante del
 *        usuario (id ∈ reveladosEnVivo del padre): dispara el latido.
 * @param {boolean} [props.cuelga1]       El personaje1 acaba de clasificarse aquí.
 * @param {boolean} [props.cuelga2]       Ídem personaje2.
 * @param {string}  props.posicion        "ronda:idx" para el anclaje de cuerdas.
 * @param {React.ReactNode} [props.extras] Controles (voto/predicción) bajo la placa.
 */
function RopeMatch({
  match,
  esFinal = false,
  titulo,
  revelarEnVivo = false,
  cuelga1 = false,
  cuelga2 = false,
  posicion,
  extras = null,
}) {
  const ref = useRef(null)
  const reduced = useReducedMotionPref()
  const { personaje1: p1, personaje2: p2, ganador } = match
  const ganaId = ganador?.id
  const gana1 = Boolean(p1 && ganaId === p1.id)
  const gana2 = Boolean(p2 && ganaId === p2.id)
  const abierto = Boolean(p1 && p2 && !ganador)
  const sorteo = !p1 && !p2

  /* latido UNA vez al resolverse en vivo — WAAPI one-shot, nada en loop */
  useEffect(() => {
    if (!revelarEnVivo || !ganador || reduced) return undefined
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return undefined
    const anim = el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.02)', offset: 0.5 }, { transform: 'scale(1)' }],
      { duration: 250, easing: 'ease-out' },
    )
    return () => anim.cancel()
  }, [revelarEnVivo, ganador, reduced])

  let aria
  if (sorteo) aria = `${titulo}: pendiente de sorteo`
  else if (ganador) aria = `${titulo}: ${p1?.nombre} contra ${p2?.nombre}, ganó ${ganador.nombre}`
  else if (abierto) aria = `${titulo}: ${p1.nombre} contra ${p2.nombre}, en juego`
  else aria = `${titulo}: ${p1?.nombre ?? 'por decidir'} contra rival por decidir`

  return (
    <div className="rb-celda">
      <div
        ref={ref}
        role="group"
        aria-label={aria}
        data-rope-match={posicion}
        className={`rb-placa ${sorteo ? 'rb-placa--sorteo' : ''} ${esFinal ? 'rb-placa--final' : ''}`}
      >
        <Lado p={p1} lado="izq" pierde={gana2} cuelga={cuelga1} />
        <div className="rb-placa-centro">
          <span className={`rb-nombre ${gana1 ? 'rb-nombre--gana' : ''} ${gana2 ? 'rb-nombre--pierde' : ''}`}>
            {p1?.nombre ?? 'Por decidir'}
          </span>
          <Marcador match={match} sorteo={sorteo} />
          <span className={`rb-nombre rb-nombre--n2 ${gana2 ? 'rb-nombre--gana' : ''} ${gana1 ? 'rb-nombre--pierde' : ''}`}>
            {p2?.nombre ?? 'Por decidir'}
          </span>
        </div>
        <Lado p={p2} lado="der" pierde={gana1} cuelga={cuelga2} />
      </div>
      {extras}
    </div>
  )
}

function Lado({ p, lado, pierde, cuelga }) {
  if (!p) {
    return (
      <div className={`rb-lado-vacio ${lado === 'der' ? 'rb-lado-vacio--der' : ''}`} aria-hidden="true">
        <Lock className="h-3 w-3 text-fg-muted" />
      </div>
    )
  }
  return (
    <div
      className={`rb-lado ${lado === 'der' ? 'rb-lado--der' : ''} ${pierde ? 'rb-lado--pierde' : ''} ${cuelga ? 'rb-cuelga' : ''}`}
      style={cuelga ? { '--rb-cuelga-delay': '650ms' } : undefined}
    >
      <PersonajeCutImg slug={p.slug} alt="" loading="lazy" imgClassName="rb-lado-img" className="h-full w-full" />
      <i className="rb-velo" aria-hidden="true" />
    </div>
  )
}

/* Marcador honesto: el DTO solo trae totalVotos (no votos por lado). */
function Marcador({ match, sorteo }) {
  if (sorteo || !match.personaje1 || !match.personaje2) {
    return <span className="rb-marcador rb-marcador--tbd font-mono">? <span className="rb-sep">—</span> ?</span>
  }
  const abierto = !match.ganador
  return (
    <span className={`rb-marcador font-mono ${abierto ? 'rb-marcador--abierto' : ''}`}>
      <LiveNumber value={match.totalVotos ?? 0} />
      <span className="rb-sep-label">votos</span>
    </span>
  )
}

export default memo(RopeMatch)
