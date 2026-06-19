import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import {
  useAplicarPrediccion,
  useMisPredicciones,
} from '../hooks/usePredicciones'
import { ApiError } from '../lib/api'
import { useVotarEnfrentamiento } from '../lib/torneosQueries'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'
import PersonajeCutImg from './PersonajeCutImg'
import KanjiStroke from './KanjiStroke'
import RopeMatch from './RopeMatch'
import { WagerRopes } from './WagerRopes'

/**
 * Bracket — el árbol de cuerdas (RopeBracket reskin) con datos vivos del
 * backend. Cada enfrentamiento es una placa de madera (RopeMatch) y las
 * placas se unen con cuerdas SVG (hairline doble) que se tensan y entintan
 * en oro cuando un resultado avanza.
 *
 * El componente SOLO lee los DTOs que llegan del backend — NUNCA inventa
 * ganadores. El render progresivo emerge naturalmente del shape de los datos:
 *
 *   props.enfrentamientos: EnfrentamientoDto[] ya ordenados por
 *     (ronda asc, id asc). Cada uno con `personaje1`/`personaje2`
 *     posiblemente null (rondas futuras sin resolver) y `ganador`
 *     null hasta que la ronda se cierre.
 *   props.ganadorSlug: slug del campeón si el torneo está FINISHED.
 *   props.totalRondas: para etiquetar columnas (Octavos / Cuartos / etc.).
 *   props.estado: SCHEDULED / IN_PROGRESS / FINISHED (informativo).
 *   props.torneoId / props.torneoSlug: para predicciones y voto.
 *
 * Avance en vivo: el update llega por el topic STOMP del bracket y refresca
 * los DTOs; este componente detecta los matches que pasan de sin-ganador →
 * con-ganador comparando contra un ref (reveladosEnVivo). Solo ESOS
 * coreografían; el histórico pinta estado final sin teatro retroactivo.
 *
 * Un avance JAMÁS re-dibuja el árbol: el SVG de cuerdas es UNO, sus paths son
 * estáticos (geometría medida, coalescada con rAF+backstop) y al avanzar solo
 * cambian clases / stroke-dashoffset. RopeMatch va memo() y las rondas no
 * afectadas conservan identidad.
 */

const TITULOS = {
  4: ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
  3: ['Cuartos', 'Semifinal', 'Final'],
  2: ['Semifinal', 'Final'],
  1: ['Final'],
}

// Kanji decorativo por ronda. 一回戦 (primera ronda), 二回戦,
// 準決勝 (semifinal), 決勝 (final). La última siempre es 決勝.
const KANJI_RONDA = {
  4: ['一回戦', '二回戦', '準決勝', '決勝'],
  3: ['一回戦', '準決勝', '決勝'],
  2: ['準決勝', '決勝'],
  1: ['決勝'],
}

const CEREMONIA_LS = 'animeshowdown.ropeCeremonia'

/* cuerda: cúbica con seno (sag). reposo 9px · tensa 2.5px · suelta 26px */
function ropeD(ax, ay, bx, by, sag) {
  const mx = (bx - ax) * 0.42
  return `M ${ax} ${ay} C ${ax + mx} ${ay + sag}, ${bx - mx} ${by + sag}, ${bx} ${by}`
}

function Bracket({ enfrentamientos, ganadorSlug, totalRondas, torneoId, torneoSlug, estado }) {
  // Predicciones del usuario para este torneo (skip si no hay user/torneoId;
  // el hook respeta esos gates internamente). Indexadas por enfrentamientoId.
  const { data: misPredicciones } = useMisPredicciones(torneoId)
  const prediccionesPorEnf = useMemo(() => {
    const map = new Map()
    for (const p of misPredicciones ?? []) {
      map.set(p.enfrentamientoId, p)
    }
    return map
  }, [misPredicciones])

  const gridRef = useRef(null)
  const scrollRef = useRef(null)
  const reduced = useReducedMotionPref()

  // Cruces que se resuelven EN VIVO: el update llega por el topic STOMP del
  // bracket y refresca los DTOs; solo ESOS coreografían. El histórico ya
  // resuelto al montar se pinta estático — sin teatro retroactivo.
  const resueltosPreviosRef = useRef(null)
  const [reveladosEnVivo, setReveladosEnVivo] = useState(() => new Set())
  const [cuelgues, setCuelgues] = useState(() => new Set())
  const [anuncio, setAnuncio] = useState('')

  // agrupación por ronda + metadatos de posición visual (0-based).
  const { rondas, posPorId } = useMemo(() => {
    const porRonda = new Map()
    for (const enf of enfrentamientos ?? []) {
      if (!porRonda.has(enf.ronda)) porRonda.set(enf.ronda, [])
      porRonda.get(enf.ronda).push(enf)
    }
    const keys = [...porRonda.keys()].sort((a, b) => a - b)
    const rondasArr = keys.map((k) => porRonda.get(k))
    const pos = new Map()
    rondasArr.forEach((r, ri) => r.forEach((m, mi) => pos.set(m.id, { ronda: ri, idx: mi })))
    return { rondas: rondasArr, posPorId: pos }
  }, [enfrentamientos])

  useEffect(() => {
    const actuales = new Set(
      (enfrentamientos ?? []).filter((e) => e.ganador).map((e) => e.id),
    )
    if (resueltosPreviosRef.current === null) {
      resueltosPreviosRef.current = actuales
      return
    }
    const previos = resueltosPreviosRef.current
    const nuevos = [...actuales].filter((id) => !previos.has(id))
    resueltosPreviosRef.current = actuales
    if (nuevos.length === 0) return
    setReveladosEnVivo((prev) => {
      const next = new Set(prev)
      for (const id of nuevos) next.add(id)
      return next
    })
    // cuelgues: el ganador aparece en la placa destino — anclamos por
    // posición visual destino "ronda:idx:lado".
    setCuelgues((prev) => {
      const next = new Set(prev)
      for (const id of nuevos) {
        const meta = posPorId.get(id)
        if (meta && meta.ronda < rondas.length - 1) {
          next.add(`${meta.ronda + 1}:${Math.floor(meta.idx / 2)}:${meta.idx % 2}`)
        }
      }
      return next
    })
    const frases = nuevos
      .map((id) => (enfrentamientos ?? []).find((e) => e.id === id))
      .filter((e) => e?.ganador)
      .map((e) => `${e.ganador.nombre} gana y avanza`)
    if (frases.length) setAnuncio(frases.join('. '))
  }, [enfrentamientos]) // eslint-disable-line react-hooks/exhaustive-deps

  const titulos = TITULOS[totalRondas] || []
  const kanjis = KANJI_RONDA[totalRondas] || []
  const ultimo = rondas[rondas.length - 1]?.[0]
  // Campeón resuelto con dos fuentes (alineado con TorneoQueryService):
  // ganadorSlug del DTO, y el ganador del match de la última ronda.
  const campeon = useMemo(() => {
    if (ultimo?.ganador) return ultimo.ganador
    if (!ganadorSlug) return null
    for (const e of enfrentamientos ?? []) {
      if (e.personaje1?.slug === ganadorSlug) return e.personaje1
      if (e.personaje2?.slug === ganadorSlug) return e.personaje2
      if (e.ganador?.slug === ganadorSlug) return e.ganador
    }
    return null
  }, [enfrentamientos, ganadorSlug, ultimo])

  // entrada: IO por columna → stagger de placas + dibujado por ronda.
  const [dibujadas, setDibujadas] = useState({})
  const ordenDibujoRef = useRef(0)
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined
    const cols = [...grid.querySelectorAll('[data-rope-col]')]
    const io = new IntersectionObserver((entries) => {
      const nuevas = []
      for (const en of entries) {
        if (!en.isIntersecting) continue
        en.target.classList.add('rb-col--in')
        const r = Number(en.target.getAttribute('data-rope-col'))
        if (!Number.isNaN(r)) nuevas.push(r)
        io.unobserve(en.target)
      }
      if (nuevas.length) {
        setDibujadas((prev) => {
          const next = { ...prev }
          for (const r of nuevas.sort((a, b) => a - b)) {
            if (next[r] == null) {
              next[r] = 200 + ordenDibujoRef.current * 150
              ordenDibujoRef.current += 1
            }
          }
          return next
        })
      }
    }, { threshold: 0.15 })
    cols.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [rondas.length])

  // ceremonia del campeón: UNA vez por torneo+campeón (localStorage). Los
  // setState viven dentro de timers (incl. el caso "instant" con delay 0)
  // para no disparar setState síncrono en el cuerpo del effect (React 19).
  const [corona, setCorona] = useState(null) // { edges: string[], sealed }
  useEffect(() => {
    if (!campeon || rondas.length === 0) return undefined
    const key = `${CEREMONIA_LS}.${torneoId}:${campeon.slug}`
    const edges = []
    rondas.forEach((ronda, r) => ronda.forEach((m, i) => {
      if (m.ganador && m.ganador.slug === campeon.slug) edges.push(`${r}:${i}`)
    }))
    let hecha = false
    try { hecha = localStorage.getItem(key) === '1' } catch { /* private mode */ }
    if (hecha || reduced) {
      const t0 = setTimeout(() => setCorona({ edges, sealed: true, instant: true }), 0)
      return () => clearTimeout(t0)
    }
    try { localStorage.setItem(key, '1') } catch { /* private mode */ }
    const t1 = setTimeout(() => setCorona({ edges, sealed: false }), 1100)
    const t2 = setTimeout(() => setCorona({ edges, sealed: true }), 1100 + edges.length * 80 + 380)
    const t3 = setTimeout(() => setAnuncio(`${campeon.nombre} es el campeón del torneo`), 0)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [campeon?.slug, torneoId, rondas.length, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enfrentamientos || enfrentamientos.length === 0) return null
  const ult = rondas.length - 1

  // Barra de progreso del torneo: matches resueltos sobre el total.
  const totalMatches = enfrentamientos.length
  const matchesResueltos = enfrentamientos.filter((e) => e.ganador).length
  const rondaActualIdx = (() => {
    const i = rondas.findIndex((r) =>
      r.some((m) => m.personaje1 && m.personaje2 && !m.ganador),
    )
    return i === -1 ? rondas.length - 1 : i
  })()

  return (
    <div>
      {totalMatches > 0 && matchesResueltos < totalMatches && (
        <div className="mb-5 rounded-lg border border-border bg-surface p-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-semibold text-fg-muted">Progreso</span>
            <span className="font-mono tabular-nums text-fg-muted">
              <strong className="text-fg-strong">{matchesResueltos}</strong> /{' '}
              {totalMatches} matches · ronda{' '}
              <strong className="text-fg-strong">
                {rondaActualIdx + 1} de {rondas.length}
              </strong>
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-gold to-electric transition-all duration-700"
              style={{ width: `${(matchesResueltos / totalMatches) * 100}%` }}
            />
          </div>
        </div>
      )}
      <RopeBreadcrumb titulos={titulos} kanjis={kanjis} scrollRef={scrollRef} />
      <div
        ref={scrollRef}
        className="rb-scroll scrollbar-hide -mx-5 px-5 sm:-mx-8 sm:px-8"
        aria-label="Árbol del torneo, desplazable por rondas"
      >
        <div ref={gridRef} className="rb-grid">
          <RopesLayer
            gridRef={gridRef}
            rondas={rondas}
            reveladosEnVivo={reveladosEnVivo}
            corona={corona}
            dibujadas={dibujadas}
            prediccionesPorEnf={prediccionesPorEnf}
            onPorraResuelta={setAnuncio}
          />
          {rondas.map((ronda, r) => (
            <div key={r} data-rope-col={r} className="rb-col">
              <div className="rb-col-head">
                <h3 className={`text-[11px] font-semibold ${r === ult ? 'text-gold' : 'text-fg-muted'}`}>
                  {titulos[r] || `Ronda ${r + 1}`}
                </h3>
                {kanjis[r] && (
                  <span aria-hidden="true" lang="ja" className="text-gold/70">
                    <KanjiStroke kanji={kanjis[r]} size="0.95em" strokeMs={380} gapMs={70} strokeWidth={6} />
                  </span>
                )}
              </div>
              <div className="rb-col-body">
                {ronda.map((m, i) => {
                  const extras = (
                    <MatchExtras
                      match={m}
                      torneoId={torneoId}
                      torneoSlug={torneoSlug}
                      estado={estado}
                      prediccion={prediccionesPorEnf.get(m.id)}
                    />
                  )
                  const placa = (
                    <RopeMatch
                      match={m}
                      esFinal={r === ult}
                      titulo={titulos[r] || `Ronda ${r + 1}`}
                      revelarEnVivo={reveladosEnVivo.has(m.id)}
                      cuelga1={cuelgues.has(`${r}:${i}:0`)}
                      cuelga2={cuelgues.has(`${r}:${i}:1`)}
                      posicion={`${r}:${i}`}
                      extras={extras}
                    />
                  )
                  if (r !== ult) {
                    return <div key={m.id} style={{ '--rb-in-delay': `${i * 40}ms` }}>{placa}</div>
                  }
                  // la final lleva dosel propio.
                  return (
                    <div key={m.id} className={`rb-bloque-final ${campeon ? 'rb-bloque-final--coronado' : ''}`}>
                      <div className="rb-dosel">
                        <span className="rb-dosel-kanji" lang="ja" aria-hidden="true">決勝</span>
                        {corona?.sealed && (
                          <span className={`rb-sello ${corona.instant ? 'rb-sello--instant' : ''}`} lang="ja" aria-hidden="true">王</span>
                        )}
                      </div>
                      <div className="rb-dosel-cuerdas" aria-hidden="true"><i /><i /></div>
                      {placa}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div data-rope-col={rondas.length} className="rb-col rb-col--campeon">
            <div className="rb-col-head">
              <h3 className="text-[11px] font-semibold text-gold">Campeón</h3>
              <span aria-hidden="true" lang="ja" className="text-gold/80">
                <KanjiStroke kanji="王者" size="0.95em" strokeMs={420} gapMs={80} strokeWidth={6} />
              </span>
            </div>
            <div className="rb-col-body">
              {campeon ? (
                <div
                  data-rope-champion
                  role="group"
                  aria-label={`Campeón del torneo: ${campeon.nombre}`}
                  className={`rb-campeon ${reveladosEnVivo.has(ultimo?.id) ? 'rb-cuelga' : ''}`}
                  style={{ '--rb-cuelga-delay': '650ms' }}
                >
                  <PersonajeCutImg slug={campeon.slug} alt={campeon.nombre} className="aspect-[2/3] w-full" />
                  <div className="rb-campeon-meta">
                    <b className="text-fg-strong">{campeon.nombre}</b>
                    <span className="text-fg-muted">{campeon.anime}</span>
                  </div>
                </div>
              ) : (
                <div data-rope-champion className="rb-campeon-hueco">
                  <span className="rb-campeon-hueco-kanji" lang="ja" aria-hidden="true">王</span>
                  <p className="text-[11px] font-semibold text-fg-muted">Por decidir</p>
                  <p className="text-[10px] text-fg-muted">El torneo aún no ha terminado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite" role="status">{anuncio}</div>
    </div>
  )
}

/* ── capa de cuerdas: UN SVG, paths estáticos, solo clases/dash mutan ── */
function RopesLayer({ gridRef, rondas, reveladosEnVivo, corona, dibujadas, prediccionesPorEnf, onPorraResuelta }) {
  const [geo, setGeo] = useState(null)
  const sigRef = useRef('')
  const svgRef = useRef(null)

  /* medición coalescada rAF+backstop, relativa al grid (el scroll-x
     cancela por construcción) */
  useLayoutEffect(() => {
    const grid = svgRef.current?.parentElement ?? gridRef.current
    if (!grid) return undefined
    let raf = 0
    let timer = 0
    const measure = () => {
      const g = grid.getBoundingClientRect()
      const map = {}
      grid.querySelectorAll('[data-rope-match],[data-rope-champion]').forEach((el) => {
        const key = el.getAttribute('data-rope-match') ?? 'champ'
        const r = el.getBoundingClientRect()
        map[key] = { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height }
      })
      const sig = JSON.stringify(map)
      if (sig !== sigRef.current) { sigRef.current = sig; setGeo(map) }
    }
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
      const run = () => {
        cancelAnimationFrame(raf); clearTimeout(timer); raf = 0; timer = 0
        measure()
      }
      raf = requestAnimationFrame(run)
      timer = setTimeout(run, 80)
    }
    const ro = new ResizeObserver(schedule)
    ro.observe(grid)
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [gridRef, rondas.length])

  const edges = useMemo(() => {
    if (!geo) return []
    const last = rondas.length - 1
    const out = []
    rondas.forEach((ronda, r) => ronda.forEach((m, i) => {
      const a = geo[`${r}:${i}`]
      if (!a) return
      let bx; let by; let dest = null; let side = 0
      if (r === last) {
        const c = geo.champ
        if (!c) return
        bx = c.x
        by = c.y + Math.min(c.h * 0.2, 46)
      } else {
        const b = geo[`${r + 1}:${Math.floor(i / 2)}`]
        if (!b) return
        side = i % 2
        bx = b.x
        by = b.y + b.h * (side === 0 ? 0.32 : 0.68)
        dest = rondas[r + 1][Math.floor(i / 2)]
      }
      const ax = a.x + a.w
      const ay = a.y + a.h / 2
      const suelta = !m.personaje1 && !m.personaje2
      const ganada = Boolean(m.ganador)
      const viva = reveladosEnVivo.has(m.id)
      const idxCorona = corona ? corona.edges.indexOf(`${r}:${i}`) : -1
      /* perdida: el destino ya se resolvió y el lado que alimenta esta
         cuerda no es su ganador → laca apagada */
      const ladoQueAlimenta = side === 0 ? dest?.personaje1 : dest?.personaje2
      const perdida = Boolean(dest?.ganador) && idxCorona === -1
        && ladoQueAlimenta?.id !== dest.ganador.id
      out.push({
        key: `${r}:${i}`,
        ronda: r,
        suelta,
        ganada,
        viva,
        perdida,
        coronaIdx: idxCorona,
        reposo: ropeD(ax, ay, bx, by, 9),
        tensa: ropeD(ax, ay, bx, by, 2.5),
        floja: ropeD(ax, ay, bx, by, 26),
        nudo: { x: bx, y: by },
      })
    }))
    return out
  }, [geo, rondas, reveladosEnVivo, corona])

  /* ── porra (WagerRopes): adaptador desde el MISMO `geo`/`edges` ──────────
     No re-mide ni duplica el <svg>: traduce la geometría ya calculada al
     contrato de WagerRopes. Para cada match con predicción tomamos el ancla
     de SALIDA de su placa (la misma de la cuerda oficial) como origen y el
     destino de su edge como llegada. `anchors` se indexa por el slug del
     personaje predicho para que WagerRopes lo resuelva sin cambios. */
  const last = rondas.length - 1
  const edgePorKey = useMemo(() => {
    const map = new Map()
    for (const e of edges) map.set(e.key, e)
    return map
  }, [edges])

  const { porraLayout, porraPredicciones, porraResultados } = useMemo(() => {
    const layout = {}
    const preds = {}
    const results = {}
    if (!geo || !prediccionesPorEnf || prediccionesPorEnf.size === 0) {
      return { porraLayout: layout, porraPredicciones: preds, porraResultados: results }
    }
    rondas.forEach((ronda, r) =>
      ronda.forEach((m, i) => {
        const pred = prediccionesPorEnf.get(m.id)
        if (!pred) return // sin predicción → no pinta (criterio 5)
        // slug del personaje predicho: del DTO del match (la predicción trae id).
        const elegido =
          m.personaje1?.id === pred.personajePredichoId
            ? m.personaje1
            : m.personaje2?.id === pred.personajePredichoId
              ? m.personaje2
              : null
        if (!elegido?.slug) return // dato ausente → no pinta (criterio 5)
        const a = geo[`${r}:${i}`]
        if (!a) return // ancla ausente → no pinta (criterio 5)
        // destino: el mismo que usa la cuerda oficial de este edge.
        let to = null
        if (r === last) {
          const c = geo.champ
          if (c) to = { x: c.x, y: c.y + Math.min(c.h * 0.2, 46) }
        } else {
          const e = edgePorKey.get(`${r}:${i}`)
          if (e) to = { x: e.nudo.x, y: e.nudo.y }
        }
        if (!to) return // sin destino → no pinta (criterio 5)
        const id = String(m.id)
        layout[id] = {
          anchors: { [elegido.slug]: { x: a.x + a.w, y: a.y + a.h / 2 } },
          to,
        }
        preds[id] = elegido.slug
        // resultado oficial SOLO si el cruce ya tiene ganador (dato backend).
        if (m.ganador?.slug) results[id] = m.ganador.slug
      }),
    )
    return { porraLayout: layout, porraPredicciones: preds, porraResultados: results }
  }, [geo, rondas, prediccionesPorEnf, edgePorKey, last])

  const tienePorra = Object.keys(porraPredicciones).length > 0

  const announce = useCallback(
    (matchId, outcome, mensaje) => {
      if (onPorraResuelta) onPorraResuelta(mensaje)
    },
    [onPorraResuelta],
  )

  return (
    <svg ref={svgRef} className="rb-ropes" aria-hidden="true">
      {edges.map((e) => {
        const cls = [
          'rb-edge',
          dibujadas[e.ronda] != null ? 'rb-edge--dibujada' : '',
          e.suelta ? 'rb-edge--suelta' : '',
          e.ganada ? 'rb-edge--ganada' : '',
          e.viva ? 'rb-edge--viva' : '',
          e.perdida ? 'rb-edge--perdida' : '',
          e.coronaIdx >= 0 && corona ? 'rb-edge--corona' : '',
          corona?.instant ? 'rb-edge--instant' : '',
        ].join(' ')
        const style = {
          '--rb-dib-delay': `${dibujadas[e.ronda] ?? 0}ms`,
          '--rb-corona-delay': e.coronaIdx >= 0 ? `${e.coronaIdx * 80}ms` : '0ms',
        }
        if (e.suelta) {
          return (
            <g key={e.key} className={cls} style={style}>
              <path className="rb-rope-out rb-dib" d={e.floja} pathLength="1" />
              <path className="rb-rope-in rb-dib" d={e.floja} pathLength="1" />
            </g>
          )
        }
        return (
          <g key={e.key} className={cls} style={style}>
            <g className="rb-par-reposo">
              <path className="rb-rope-out rb-dib" d={e.reposo} pathLength="1" />
              <path className="rb-rope-in rb-dib" d={e.reposo} pathLength="1" />
            </g>
            <g className="rb-par-tensa">
              <path className="rb-rope-out rb-dib" d={e.tensa} pathLength="1" />
              <path className="rb-rope-in rb-dib" d={e.tensa} pathLength="1" />
            </g>
            <path className="rb-rope-ink" d={e.tensa} pathLength="1" />
            {e.coronaIdx >= 0 && <path className="rb-rope-champ" d={e.tensa} pathLength="1" />}
            <circle
              className={`rb-nudo ${e.ganada ? 'rb-nudo--oro' : ''} ${e.coronaIdx >= 0 && corona ? 'rb-nudo--brillo' : ''}`}
              cx={e.nudo.x}
              cy={e.nudo.y}
              r="3"
            />
          </g>
        )
      })}
      {/* porra del usuario: capa ADITIVA dentro de ESTE mismo <svg>, sobre las
          cuerdas oficiales. Reutiliza la geometría ya medida (geo/edges); no
          re-mide ni crea otro svg. Solo se monta si hay predicciones. */}
      {tienePorra && (
        <WagerRopes
          layout={porraLayout}
          predictions={porraPredicciones}
          results={porraResultados}
          onResolve={announce}
        />
      )}
    </svg>
  )
}

/* ── breadcrumb de rondas (móvil): sticky arriba, targets ≥44px ──────── */
function RopeBreadcrumb({ titulos, kanjis, scrollRef }) {
  const [activa, setActiva] = useState(0)
  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return undefined
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const cols = [...sc.querySelectorAll('[data-rope-col]')]
        let act = 0
        cols.forEach((c, i) => { if (c.offsetLeft <= sc.scrollLeft + sc.clientWidth * 0.35) act = i })
        setActiva(act)
      })
    }
    sc.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { sc.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [scrollRef])
  const irA = (idx) => {
    const sc = scrollRef.current
    if (!sc) return
    const col = sc.querySelectorAll('[data-rope-col]')[idx]
    if (col) sc.scrollTo({ left: Math.max(0, col.offsetLeft - 16), behavior: 'smooth' })
  }
  const crumbs = [...titulos, 'Campeón']
  return (
    <nav className="rb-crumbs sm:hidden" aria-label="Rondas del torneo">
      {crumbs.map((c, idx) => (
        <button
          key={c}
          type="button"
          aria-current={activa === idx ? 'true' : undefined}
          className={`rb-crumb ${activa === idx ? 'rb-crumb--act' : ''}`}
          onClick={() => irA(idx)}
        >
          {c}
          <span className="rb-crumb-kanji" lang="ja" aria-hidden="true">{idx < kanjis.length ? kanjis[idx] : '王者'}</span>
        </button>
      ))}
    </nav>
  )
}

/**
 * Controles bajo la placa: voto (IN_PROGRESS + abierto) y predicción.
 * Conserva EXACTA la integración de Bracket.jsx — solo lee DTOs, no inventa.
 */
function MatchExtras({ match, torneoId, torneoSlug, estado, prediccion }) {
  const ambosPersonajes = match.personaje1 && match.personaje2
  if (!ambosPersonajes) return null

  const resuelto = Boolean(match.ganador?.id)
  const abiertoParaVotar = estado === 'IN_PROGRESS' && !resuelto

  return (
    <div className="rb-extras">
      {abiertoParaVotar && <VotoRow match={match} torneoSlug={torneoSlug} />}
      {torneoId && (
        <PrediccionRow
          match={match}
          prediccion={prediccion}
          resuelto={resuelto}
          torneoId={torneoId}
        />
      )}
    </div>
  )
}

function VotoRow({ match, torneoSlug }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mutation = useVotarEnfrentamiento(torneoSlug)
  const [votadoLocal, setVotadoLocal] = useState(null)

  const totalVotos = match.totalVotos ?? 0
  const disabled = mutation.isPending || Boolean(votadoLocal)

  const onVote = (personaje) => {
    if (disabled) return
    if (!user) {
      toast.error('Entra para votar este duelo', {
        description: 'Te devolvemos al torneo después.',
      })
      const next = `${location.pathname}${location.search}${location.hash}`
      navigate(`/login?next=${encodeURIComponent(next)}`)
      return
    }

    setVotadoLocal('pending')
    mutation.mutate(
      { enfrentamientoId: match.id, personajeGanadorId: personaje.id },
      {
        onSuccess: (data) => {
          setVotadoLocal(personaje.id)
          toast.success(`Voto para ${personaje.nombre}`, {
            description: data?.votosGanador != null
              ? `${data.votosGanador} votos en este match`
              : 'Bracket actualizado',
          })
        },
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : 0
          if (status === 409) {
            setVotadoLocal('ya-votado')
            toast.error('Ya votaste este enfrentamiento')
          } else if (status === 401 || status === 403) {
            setVotadoLocal(null)
            const next = `${location.pathname}${location.search}${location.hash}`
            navigate(`/login?next=${encodeURIComponent(next)}`)
          } else {
            setVotadoLocal(null)
            toast.error('No se pudo registrar el voto', {
              description: err?.message || 'Inténtalo de nuevo.',
            })
          }
        },
      },
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-accent/25 bg-accent/5 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-fg-muted">
        <span>Vota este duelo</span>
        <span className="font-mono tabular-nums">{totalVotos} votos</span>
      </div>
      <div className="flex gap-1">
        <VotoButton
          personaje={match.personaje1}
          active={votadoLocal === match.personaje1.id}
          disabled={disabled}
          onClick={() => onVote(match.personaje1)}
        />
        <VotoButton
          personaje={match.personaje2}
          active={votadoLocal === match.personaje2.id}
          disabled={disabled}
          onClick={() => onVote(match.personaje2)}
        />
      </div>
      {votadoLocal === 'pending' && (
        <p className="mt-1 text-center text-[10px] font-medium text-fg-muted">
          Registrando voto…
        </p>
      )}
      {votadoLocal && votadoLocal !== 'pending' && (
        <p className="mt-1 text-center text-[10px] font-medium text-gold">
          Voto registrado
        </p>
      )}
    </div>
  )
}

function VotoButton({ personaje, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Votar a ${personaje.nombre}`}
      className={`min-h-11 min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
        active
          ? 'border-accent bg-accent text-bg'
          : 'border-border bg-bg text-fg-strong hover:border-accent hover:bg-accent-soft hover:text-gold'
      }`}
    >
      <span className="block truncate">{personaje.nombre}</span>
    </button>
  )
}

/**
 * Footer del match con la predicción.
 *
 * - Match abierto + sin predicción → botón "🔮 Predice".
 * - Match abierto + con predicción → "Predigo: <nombre>" + opción cambiar.
 * - Match resuelto + con predicción → badge verde/rojo según acertaste.
 * - Match resuelto + sin predicción → no se pinta nada.
 */
function PrediccionRow({ match, prediccion, resuelto, torneoId }) {
  const { user } = useAuth()
  const [picking, setPicking] = useState(false)
  const mutation = useAplicarPrediccion(torneoId)

  if (resuelto) {
    if (!prediccion) return null
    const acerto = prediccion.acertada === true
    return (
      <div
        className={`mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${
          acerto
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger'
        }`}
      >
        <Sparkles className="h-3 w-3" />
        {acerto ? '¡Acertaste tu predicción!' : 'Tu predicción falló'}
      </div>
    )
  }

  // No mostrar el picker a invitados — el botón redirigiría a login.
  if (!user) return null

  const onPick = (personajeId) => {
    mutation.mutate(
      { enfrentamientoId: match.id, personajePredichoId: personajeId },
      {
        onSuccess: () => {
          setPicking(false)
          toast.success('Predicción guardada')
        },
        onError: (err) => {
          toast.error(
            err instanceof ApiError ? err.message : 'No se pudo guardar',
          )
        },
      },
    )
  }

  if (picking || !prediccion) {
    return (
      <div className="mt-1.5 flex items-center gap-1">
        {picking ? (
          <>
            <PickButton
              personaje={match.personaje1}
              onClick={() => onPick(match.personaje1.id)}
              disabled={mutation.isPending}
            />
            <PickButton
              personaje={match.personaje2}
              onClick={() => onPick(match.personaje2.id)}
              disabled={mutation.isPending}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-9 w-full rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] font-semibold text-fg-muted transition-colors hover:border-accent/40 hover:text-gold"
          >
            🔮 Predice el ganador
          </button>
        )}
      </div>
    )
  }

  // Predicción ya hecha (sin resolver). Resumen + opción cambiar.
  return (
    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1">
      <Check className="h-3 w-3 shrink-0 text-gold" />
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg-strong">
        Predigo: {prediccion.personajePredichoNombre}
      </span>
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="text-[11px] text-fg-muted underline-offset-2 hover:text-gold hover:underline"
      >
        cambiar
      </button>
    </div>
  )
}

function PickButton({ personaje, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Predecir a ${personaje.nombre}`}
      className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] font-medium text-fg-strong transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <PersonajeCutImg
        slug={personaje.slug}
        alt={personaje.nombre}
        className="h-5 w-5 shrink-0 rounded-lg border border-white/10"
      />
      <span className="truncate">{personaje.nombre}</span>
    </button>
  )
}

export default Bracket
