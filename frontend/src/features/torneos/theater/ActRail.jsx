import { useMemo } from 'react'
import MatchScroll from './MatchScroll'
import { elbowPath, nombreRonda, kanjiNumeral } from './theater-utils'

const HEADER = 66

/**
 * ActRail — las rondas como ACTOS colgados de cuerdas. Layout absoluto puro
 * (cada match centrado entre sus dos feeders, vía computeLayout) + capa SVG
 * de cuerdas estática. Desktop: actos en columnas con plaquita colgante y
 * envoltorio POR ACTO con content-visibility en el cuadro gigante (32). Móvil:
 * actos apilados a ancho completo (sin cuerdas; la función funciona igual).
 *
 * Las cuerdas solo trazan UNA vez (stroke-dashoffset, en theater.css) y en
 * función se ENCIENDEN en oro al resolverse cada match (derivado del paso).
 * Cero medición de DOM: la geometría es pura → ningún salto de layout.
 *
 * USO REAL: este componente se monta SOLO dentro del overlay de "función"
 * (torneo FINISHED). El cuadro vivo del torneo lo pinta el Bracket del repo.
 *
 * @param {object} props
 * @param {{rondas:Array, campeon:object|null}} props.derived  deriveBracketState(...)
 * @param {object} props.layout   computeLayout(rounds)
 * @param {'bracket'|'funcion'} props.modo
 * @param {boolean} props.enter   reproduce desenrollado + trazo de cuerdas
 * @param {number}  props.act1Key clave para re-disparar el desenrollado (replay)
 * @param {string|number|null} props.cutId  match que se está resolviendo ahora
 * @param {boolean} props.cutActive  anima el corte de tinta del match cutId
 * @param {number}  props.liveRoundIdx  ronda con duelos abiertos (IN_PROGRESS) o -1
 * @param {boolean} props.reduced
 * @param {boolean} props.mobile
 * @param {Function} props.hrefPersonaje
 */
export default function ActRail({ derived, layout, modo, enter, act1Key, cutId, cutActive,
  liveRoundIdx, reduced, mobile, hrefPersonaje }) {
  const { rondas } = derived
  const giant = rondas[0].length >= 8

  const scrollProps = (m, rIdx) => {
    const live = modo !== 'funcion' && rIdx === liveRoundIdx && m.status !== 'resolved' && m.slot1.seated && m.slot2.seated
    let mm = m
    let playingCut = false
    if (modo === 'funcion' && m.id === cutId && cutActive && m.ganadorSlug) {
      const w = m.ganadorSlug
      mm = { ...m, status: 'resolved',
        slot1: { ...m.slot1, isWinner: m.slot1.persona?.slug === w, isLoser: m.slot1.seated && m.slot1.persona?.slug !== w },
        slot2: { ...m.slot2, isWinner: m.slot2.persona?.slug === w, isLoser: m.slot2.seated && m.slot2.persona?.slug !== w } }
      playingCut = true
    }
    return { m: mm, live, playingCut }
  }

  const ropes = useMemo(() => buildRopes(rondas, layout, derived), [rondas, layout, derived])

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {rondas.map((ronda, r) => (
          <section key={r} aria-label={`Acto ${r + 1}: ${nombreRonda(ronda.length)}`}
            style={ronda.length >= 8 ? { contentVisibility: 'auto', containIntrinsicSize: `${ronda.length * 130}px` } : undefined}>
            <ActHeader r={r} ronda={ronda} mobile />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              {ronda.map((m, i) => (
                <MatchScroll key={`${m.id}-${act1Key}`} {...scrollProps(m, r)} enter={enter && !reduced}
                  delay={i * 60} hrefPersonaje={hrefPersonaje} />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: layout.width, height: layout.height + HEADER, margin: '0 auto' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: 6, left: -20, right: -20, height: 8, borderRadius: 4,
        background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold) 30%, var(--color-canvas)), var(--color-canvas))',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb,var(--color-gold-bright) 40%,transparent)' }} />
      {layout.cols.map((col, r) => (
        <div key={r} style={{ position: 'absolute', left: col.x, top: 14, width: layout.colW }}>
          <ActHeader r={r} ronda={rondas[r]} />
        </div>
      ))}

      <svg aria-hidden="true" width={layout.width} height={layout.height}
        style={{ position: 'absolute', left: 0, top: HEADER, overflow: 'visible', pointerEvents: 'none' }}>
        {ropes.edges.map((e) => (
          <g key={e.key}>
            <path d={e.d} fill="none" strokeWidth={1.5} stroke="color-mix(in srgb, var(--color-fg) 12%, transparent)" />
            <path d={e.d} fill="none" pathLength="1" strokeWidth={2.4} strokeLinecap="round"
              className={enter && !reduced ? 'teatro-cuerda teatro-cuerda--play' : 'teatro-cuerda'} stroke="var(--color-gold)"
              style={{ '--teatro-cuerda-delay': `${e.delay}ms`, strokeDashoffset: e.lit ? 0 : 1, opacity: e.lit ? 1 : 0,
                transition: e.lit && e.live && !reduced ? 'stroke-dashoffset 600ms var(--ease-brush), opacity 90ms linear' : 'none' }} />
          </g>
        ))}
        {ropes.node && (
          <circle cx={ropes.node.cx} cy={ropes.node.cy} r={5} strokeWidth={1.5}
            fill={ropes.node.lit ? 'var(--color-gold)' : 'var(--color-surface)'}
            stroke={ropes.node.lit ? 'var(--color-gold-bright)' : 'color-mix(in srgb,var(--color-fg) 25%,transparent)'} />
        )}
      </svg>

      {layout.cols.map((col, r) => (
        <div key={r} style={{ position: 'absolute', left: col.x, top: HEADER, width: layout.colW, height: layout.height,
          ...(giant ? { contentVisibility: 'auto', containIntrinsicSize: `${layout.colW}px ${layout.height}px` } : {}) }}>
          {col.matches.map((pos, i) => (
            <div key={`${rondas[r][i].id}-${act1Key}`} style={{ position: 'absolute', left: 0, top: pos.y, width: layout.colW }}>
              <MatchScroll {...scrollProps(rondas[r][i], r)} enter={enter && !reduced}
                delay={(r * 40) + (i * 60)} hrefPersonaje={hrefPersonaje} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Plaquita del acto (numeral kanji + nombre de ronda) colgando de una cuerda. */
function ActHeader({ r, ronda, mobile = false }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, justifyContent: mobile ? 'flex-start' : 'center' }}>
      {!mobile && <span aria-hidden="true" style={{ position: 'absolute', top: -10, left: '50%', width: 2, height: 12, background: 'color-mix(in srgb,var(--color-gold) 35%,transparent)' }} />}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 13px', borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold) 9%, var(--color-surface)), var(--color-surface))',
        border: '1px solid var(--color-border-gold-subtle)', boxShadow: 'inset 0 1px 0 color-mix(in srgb,var(--color-gold-bright) 18%,transparent)' }}>
        <span lang="ja" className="font-kanji-serif" aria-hidden="true" style={{ fontSize: 19, fontWeight: 900, color: 'var(--color-gold-bright)', lineHeight: 1 }}>
          {kanjiNumeral(r + 1)}
        </span>
        <span>
          <span style={{ display: 'block', fontSize: 9.5, letterSpacing: 0.5, color: 'var(--color-gold)', fontFamily: 'var(--font-mono)' }}>acto {r + 1}</span>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--color-fg-strong)' }}>{nombreRonda(ronda.length)}</span>
        </span>
      </div>
    </div>
  )
}

/** Cuerdas + estado encendido (oro) derivado del estado resuelto de cada match. */
function buildRopes(rondas, layout, derived) {
  const edges = []
  let node = null
  const last = rondas.length - 1
  rondas.forEach((ronda, r) => {
    ronda.forEach((m, i) => {
      const col = layout.cols[r]
      const pos = col.matches[i]
      const x1 = col.x + layout.colW
      const y1 = pos.cy
      const lit = m.status === 'resolved'
      if (r === last) {
        node = { cx: x1 + 46, cy: y1, lit: Boolean(derived.campeon) }
        edges.push({ key: m.id, d: elbowPath(x1, y1, x1 + 40, y1, 12), lit: Boolean(derived.campeon), live: true, delay: 0 })
        return
      }
      const pcol = layout.cols[r + 1]
      const ppos = pcol.matches[Math.floor(i / 2)]
      const x2 = pcol.x
      const y2 = ppos.cy + (i % 2 === 0 ? -26 : 26)
      edges.push({ key: m.id, d: elbowPath(x1, y1, x2, y2, 12), lit, live: true, delay: r * 120 + i * 40 })
    })
  })
  return { edges, node }
}
