/**
 * BracketPaths — capa de caminos del bracket: conectores SVG entre rondas,
 * superpuesta al grid de slots de Bracket.jsx.
 *
 * ── QUÉ PINTA ────────────────────────────────────────────────────────────────
 *
 *   1. Esqueleto SIEMPRE visible: codos ortogonales con esquinas suavizadas,
 *      hairline neutra (stroke-fg al 10 %, 1.25 px), un camino por match
 *      hacia su match destino de la siguiente ronda.
 *   2. Cuando un cruce se resuelve EN VIVO (su id está en `revealedIds`),
 *      el camino del ganador se ENCIENDE: trazo oro que avanza con
 *      stroke-dashoffset 1 → 0, 450 ms. Es exactamente la fase (1) de
 *      REVEAL_TIMING, así que el pulse del ganador (350–650 ms) y el
 *      atenuado del perdedor (550–800 ms) de BracketReveal encadenan solos.
 *   3. Matches resueltos al montar (histórico, fuera de revealedIds) pintan
 *      el oro en estado final sin transición — sin teatro retroactivo,
 *      coherente con reveladosEnVivo de Bracket.jsx.
 *   4. El último tramo (final → campeón) desemboca en un nodo. Cuando la
 *      final se resuelve en vivo, el nodo se enciende y emite UNA onda
 *      (WAAPI one-shot: scale 0.35 → 2.4 + opacity, 700 ms, delay 430 ms).
 *      Nunca un loop: nada que pausar fuera del viewport.
 *
 * ── PERF (reglas del proyecto) ───────────────────────────────────────────────
 *
 *   - Solo se animan stroke-dashoffset y opacity (+ el transform one-shot de
 *     la onda). Cero filter/blur/SVG filters — nada que WebKit re-rasterice.
 *   - getBoundingClientRect COALESCADO: ResizeObserver(grid + cards) y
 *     window.resize desembocan en un único par rAF+setTimeout pendiente
 *     (el primero que dispara cancela al otro — el timeout es backstop para
 *     contextos con rAF throttled); N avisos en el mismo frame = 1 lectura
 *     batched. Jamás se mide por frame; en reposo el coste es cero.
 *   - El SVG vive DENTRO del contenido scrolleable y las coordenadas son
 *     relativas al grid → el scroll-x de móvil cancela por construcción.
 *     No se escucha scroll.
 *   - prefers-reduced-motion → caminos pintados directamente en su estado
 *     final, sin onda.
 *   - Cero dependencias nuevas: React solo (ni framer-motion en esta capa).
 *
 * Contrato DOM completo en docs/bracket-paths-anclaje.md (data-bracket-match
 * "ronda:idx" en cada card incl. placeholders, data-bracket-slot
 * "ronda:idx:lado" en cada fila, data-bracket-champion en el remate).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'
import { elbowPath, half } from './bracket-paths'

const TRACE_MS = 450
const TRACE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)' // = fase (1) de REVEAL_TIMING
const WAVE_DELAY_MS = 430
const WAVE_MS = 700

/**
 * @param {object} props
 * @param {React.RefObject<HTMLElement>} props.gridRef  Grid interior (relative, min-w-max)
 * @param {Array<{id: number|string, ronda: number, idx: number, resuelto: boolean}>} props.matches
 *        Meta de cada match en orden visual. `ronda`/`idx` 0-based por columna.
 * @param {Set<number|string>} [props.revealedIds]  Ids resueltos EN VIVO (animan);
 *        el resto de resueltos pinta estado final sin transición.
 * @param {boolean} [props.hayCampeon]  Si la final resuelta debe encender el nodo.
 * @param {number}  [props.radius=10]   Radio de esquina del codo.
 * @param {'slot'|'centro'} [props.entrada='slot']  Anclaje de entrada en destino.
 */
export default function BracketPaths({
  gridRef,
  matches,
  revealedIds,
  hayCampeon = false,
  radius = 10,
  entrada = 'slot',
}) {
  const [geo, setGeo] = useState(null)
  const svgRef = useRef(null)
  const sigRef = useRef('')
  const rafRef = useRef(0)
  const waveRef = useRef(null)
  const reduced = useReducedMotionPref()

  /* Medición coalescada: cualquier aviso (RO del grid, RO de cada card,
     window.resize) programa UN par rAF+timeout; el callback hace una sola
     pasada de lecturas y solo hace setState si la firma cambió. */
  useLayoutEffect(() => {
    // El propio SVG (siempre montado) ancla la medición: su ref es de un
    // fiber HIJO de este componente, así que está enganchado cuando corre
    // este layout effect. El ref del grid (nuestro PADRE) aún no lo está —
    // los refs de un padre se atan después de los effects de sus hijos,
    // también en el replay de StrictMode.
    const grid = svgRef.current?.parentElement ?? gridRef.current
    if (!grid) return undefined

    const measure = () => {
      const g = grid.getBoundingClientRect()
      const byKey = {}
      grid
        .querySelectorAll('[data-bracket-match],[data-bracket-slot],[data-bracket-champion]')
        .forEach((el) => {
          const key =
            el.getAttribute('data-bracket-match') ??
            el.getAttribute('data-bracket-slot') ??
            'champ'
          const r = el.getBoundingClientRect()
          byKey[key] = {
            x: half(r.left - g.left),
            y: half(r.top - g.top),
            w: half(r.width),
            h: half(r.height),
          }
        })
      const sig = JSON.stringify(byKey)
      if (sig !== sigRef.current) {
        sigRef.current = sig
        setGeo(byKey)
      }
    }
    let timerId = 0
    const schedule = () => {
      // Coalescado con backstop: rAF y setTimeout compiten; el primero que
      // dispara cancela al otro. En tabs/iframes ocultos o throttled el rAF
      // puede no disparar nunca — sin el timeout, la capa quedaría vacía
      // hasta el siguiente aviso. Máximo un par pendiente (cancel + re-pedir).
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timerId) clearTimeout(timerId)
      const run = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        if (timerId) clearTimeout(timerId)
        rafRef.current = 0
        timerId = 0
        measure()
      }
      rafRef.current = requestAnimationFrame(run)
      timerId = setTimeout(run, 80)
    }

    const ro = new ResizeObserver(schedule)
    ro.observe(grid)
    grid
      .querySelectorAll('[data-bracket-match],[data-bracket-champion]')
      .forEach((el) => ro.observe(el))
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(rafRef.current)
      clearTimeout(timerId)
      rafRef.current = 0
      timerId = 0
    }
    // matches.length: al rellenarse rondas futuras aparecen slots nuevos que observar.
  }, [gridRef, matches.length])

  /* Aristas: cada match alimenta al match (ronda+1, floor(idx/2)) entrando
     por el slot (idx % 2); la última ronda desemboca en el campeón. */
  const { edges, node, finalId } = useMemo(() => {
    if (!geo) return { edges: [], node: null, finalId: null }
    const ultimaRonda = Math.max(...matches.map((m) => m.ronda))
    const out = []
    let champNode = null
    let idFinal = null

    for (const m of matches) {
      const a = geo[`${m.ronda}:${m.idx}`]
      if (!a) continue
      const esFinal = m.ronda === ultimaRonda
      if (esFinal) idFinal = m.id
      const dstKey = esFinal ? 'champ' : `${m.ronda + 1}:${Math.floor(m.idx / 2)}`
      const b = geo[dstKey]
      if (!b) continue

      const x1 = a.x + a.w
      const y1 = a.y + a.h / 2
      const x2 = b.x
      let y2 = b.y + b.h / 2
      if (!esFinal && entrada === 'slot') {
        const side = m.idx % 2
        const s = geo[`${dstKey}:${side}`]
        // Destino aún placeholder (sin filas de slot): fallback 30 % / 70 %.
        y2 = s ? s.y + s.h / 2 : b.y + b.h * (side === 0 ? 0.3 : 0.7)
      }

      let endX = x2
      if (esFinal) {
        endX = x2 - 17
        champNode = { cx: x2 - 10, cy: y2, lit: m.resuelto && hayCampeon }
      }
      out.push({
        key: `${m.ronda}:${m.idx}`,
        d: elbowPath(x1, y1, endX, y2, radius),
        lit: m.resuelto,
        live: Boolean(revealedIds?.has(m.id)),
      })
    }
    return { edges: out, node: champNode, finalId: idFinal }
  }, [geo, matches, revealedIds, entrada, radius, hayCampeon])

  /* UNA onda en el nodo del campeón, solo si la final se resolvió en vivo.
     WAAPI one-shot — no requiere keyframes en index.css ni loop alguno. */
  const waveArmed = Boolean(node?.lit && finalId != null && revealedIds?.has(finalId))
  useEffect(() => {
    if (!waveArmed || reduced) return undefined
    const el = waveRef.current
    if (!el || typeof el.animate !== 'function') return undefined
    const anim = el.animate(
      [
        { opacity: 0.85, transform: 'scale(0.35)' },
        { opacity: 0, transform: 'scale(2.4)' },
      ],
      { duration: WAVE_MS, delay: WAVE_DELAY_MS, easing: TRACE_EASE, fill: 'forwards' },
    )
    return () => anim.cancel()
  }, [waveArmed, reduced])

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      {edges.map((e) => (
        <g key={e.key}>
          {/* Esqueleto: hairline neutra al 10 %, siempre presente. */}
          <path d={e.d} fill="none" strokeWidth={1.25} className="stroke-fg/10" />
          {/* Camino del ganador: pathLength=1 normaliza el dash → 450 ms
              uniformes por tramo, solo stroke-dashoffset/opacity. */}
          <path
            d={e.d}
            fill="none"
            pathLength={1}
            strokeWidth={2}
            strokeLinecap="round"
            className="stroke-gold"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: e.lit ? 0 : 1,
              opacity: e.lit ? 1 : 0,
              transition:
                e.lit && e.live && !reduced
                  ? `stroke-dashoffset ${TRACE_MS}ms ${TRACE_EASE}, opacity 80ms linear`
                  : 'none',
            }}
          />
        </g>
      ))}
      {node && (
        <g>
          <circle
            cx={node.cx}
            cy={node.cy}
            r={4.5}
            strokeWidth={1.25}
            className={node.lit ? 'fill-gold stroke-gold' : 'fill-surface stroke-fg/25'}
          />
          <circle
            ref={waveRef}
            cx={node.cx}
            cy={node.cy}
            r={7}
            fill="none"
            strokeWidth={2}
            className="stroke-gold"
            style={{ opacity: 0, transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </g>
      )}
    </svg>
  )
}
