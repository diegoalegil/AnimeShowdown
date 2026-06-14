import { useEffect, useState } from 'react'

/* ─────────────────────────────────────────────────────────────────────────────
   WagerRopes — la porra sobre el árbol de cuerdas (RopeBracket).

   Capa ÚNICA: un <g> que se monta DENTRO del <svg> existente del árbol
   (criterio 1: cero duplicación; reutiliza la geometría ya medida en
   RopesLayer, NO vuelve a medir). La ceremonia del hanko vive fuera y queda
   intacta (criterio 2). Los puntos son SIEMPRE dato del backend; este
   componente nunca suma (criterio 3). Sin filtros SVG (criterio 4). Si falta
   un dato, no pinta: honestidad (criterio 5).

   El bloque CSS de esta capa (clases wr-*) vive tokenizado en src/index.css,
   junto al de RopeBracket, para mantener una sola hoja de estilos del árbol
   (CSP por hash). No hay import de CSS aquí.
   ──────────────────────────────────────────────────────────────────────────── */

/* ───────────── helpers puros a nivel de módulo (react-refresh safe) ───────── */

/**
 * Curva de cuerda entre dos anclas — misma silueta que las oficiales del árbol,
 * desplazada +6px para correr en paralelo.
 * @param {{x:number,y:number}} from ancla de la placa elegida
 * @param {{x:number,y:number}} to   ancla de la placa siguiente
 * @param {number} [dy] separación vertical respecto a la cuerda oficial
 */
function ropeGeom(from, to, dy = 6) {
  const a = { x: from.x, y: from.y + dy }
  const b = { x: to.x, y: to.y + dy }
  const dx = Math.max(40, (b.x - a.x) * 0.45)
  const p1 = { x: a.x + dx, y: a.y + 4 }
  const p2 = { x: b.x - dx, y: b.y - 4 }
  return { a, p1, p2, b, d: `M ${a.x} ${a.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${b.x} ${b.y}` }
}

/** Punto sobre la cúbica en t (0..1) — origen del deshilachado. */
function bezPoint(g, t) {
  const u = 1 - t
  const c = (k) => u * u * u * g.a[k] + 3 * u * u * t * g.p1[k] + 3 * u * t * t * g.p2[k] + t * t * t * g.b[k]
  return { x: c('x'), y: c('y') }
}

/** Dónde rompe la cuerda al deshilacharse (fracción del recorrido). */
const FRAY_T = 0.86

/**
 * Cruces ya resueltos al montar: se pintan en su estado final, sin coreografía
 * (p. ej. recarga de página a mitad de torneo). Función PURA → inicializador
 * de estado válido bajo StrictMode.
 */
function settleFromProps(results, predictions) {
  const out = {}
  if (!results || !predictions) return out
  for (const id of Object.keys(results)) {
    if (id in predictions) {
      out[id] = { outcome: results[id] === predictions[id] ? 'hit' : 'miss', instant: true }
    }
  }
  return out
}

/**
 * Nudo deshilachado: 3 hilos ESTÁTICOS que se separan vía transform/opacity
 * (cero filtros SVG — criterio 4).
 * @param {{point:{x:number,y:number}, instant:boolean}} props
 */
function FrayKnot({ point, instant }) {
  const mod = instant ? ' wr-thread--instant' : ''
  return (
    <g transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
      <path className={`wr-thread wr-thread--1${mod}`} d="M0 0 C 5 2, 8 7, 8 14" />
      <path className={`wr-thread wr-thread--2${mod}`} d="M0 0 C 6 1, 10 5, 12 11" />
      <path className={`wr-thread wr-thread--3${mod}`} d="M0 0 C 4 3, 6 9, 5 15" />
    </g>
  )
}

/* ────────────────────────────── componente ────────────────────────────────── */

/**
 * Capa de porra sobre RopeBracket. Se monta como hijo directo del <svg> del
 * árbol (en RopesLayer), reutilizando la geometría `geo`/`edges` ya medida:
 *
 *   <svg …>                          {· el árbol de cuerdas existente ·}
 *     …cuerdas oficiales…
 *     <WagerRopes
 *       layout={porraLayout}
 *       predictions={porraPredicciones}
 *       results={porraResultados}
 *       onResolve={announce}
 *     />
 *   </svg>
 *
 * @param {Object} props
 * @param {Record<string, {anchors: Record<string, {x:number,y:number}>, to: {x:number,y:number}}>} props.layout
 *        Anclas por cruce derivadas del MISMO `geo` del árbol: `anchors[slug]`
 *        = borde de salida de la placa predicha; `to` = destino del edge.
 * @param {Record<string, string>} props.predictions
 *        matchId → slug elegido (del endpoint de predicciones). Vacío/ausente →
 *        la capa no pinta nada.
 * @param {Record<string, string>} props.results
 *        matchId → slug ganador oficial, solo cruces resueltos (dato backend).
 * @param {number} [props.resultDelayMs=600]
 *        Espera tras el cambio de `results` antes de soldar/deshilachar.
 * @param {(matchId: string, outcome: 'hit'|'miss', message: string) => void} [props.onResolve]
 *        Se dispara al resolverse CADA cruce con porra → el padre lo vuelca a
 *        su región aria-live.
 */
export function WagerRopes({ layout, predictions, results, resultDelayMs = 600, onResolve }) {
  // Cruces cuya coreografía ya corrió (o llegaron resueltos al montar).
  const [settled, setSettled] = useState(() => settleFromProps(results, predictions))
  const [queue, setQueue] = useState([])
  const [prevResults, setPrevResults] = useState(results)

  // Resultado nuevo → cola pendiente. Ajuste DURANTE el render con guard
  // (patrón canónico React 19 — nada de setState síncrono en effects).
  if (prevResults !== results) {
    setPrevResults(results)
    const fresh = Object.keys(results || {}).filter(
      (id) => predictions && id in predictions && !(id in settled) && !queue.includes(id),
    )
    if (fresh.length) setQueue((q) => [...q, ...fresh])
  }

  // Coreografía: solo timers; setState únicamente dentro de callbacks (legal).
  useEffect(() => {
    if (!queue.length) return undefined
    const timers = queue.map((id) =>
      setTimeout(() => {
        const outcome = results && predictions && results[id] === predictions[id] ? 'hit' : 'miss'
        setSettled((s) => ({ ...s, [id]: { outcome, instant: false } }))
        setQueue((q) => q.filter((x) => x !== id))
        if (onResolve) {
          onResolve(
            id,
            outcome,
            outcome === 'hit'
              ? 'Porra: acierto — tu cuerda se suelda a la oficial.'
              : 'Porra: fallo — tu cuerda queda colgando.',
          )
        }
      }, resultDelayMs),
    )
    return () => timers.forEach(clearTimeout)
  }, [queue, results, predictions, resultDelayMs, onResolve])

  if (!predictions || !layout) return null

  return (
    <g className="wr-layer" aria-hidden="true">
      {Object.keys(predictions).map((id) => {
        const node = layout[id]
        if (!node || !node.anchors || !node.to) return null
        const from = node.anchors[predictions[id]]
        if (!from) return null // dato ausente → no pintar (criterio 5)
        const geom = ropeGeom(from, node.to)
        const st = settled[id]

        if (!st) {
          // pendiente: cuerda propia en cian apagado, tendida con ease-brush
          return <path key={id} className="wr-rope-own wr-rope-own--draw" d={geom.d} pathLength="100" />
        }

        if (st.outcome === 'hit') {
          // acierto: la propia se SUELDA a la dorada (cross-fade 300ms)
          return (
            <g key={id}>
              <path
                className={st.instant ? 'wr-rope-own wr-rope-own--gold' : 'wr-rope-own wr-rope-own--welding'}
                d={geom.d}
                pathLength="100"
              />
              {!st.instant && <path className="wr-rope-weld" d={geom.d} pathLength="100" />}
              {!st.instant && <circle className="wr-knot-pulse" cx={geom.b.x} cy={geom.b.y} r="6" />}
            </g>
          )
        }

        // fallo: retract 250ms + 3 hilos que se separan; queda colgando con dignidad
        return (
          <g key={id}>
            <path
              className={st.instant ? 'wr-rope-own wr-rope-own--frayed-static' : 'wr-rope-own wr-rope-own--fraying'}
              d={geom.d}
              pathLength="100"
            />
            <FrayKnot point={bezPoint(geom, FRAY_T)} instant={st.instant} />
          </g>
        )
      })}
    </g>
  )
}
