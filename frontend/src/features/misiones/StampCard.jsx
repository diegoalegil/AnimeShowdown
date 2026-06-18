import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSound } from '../../contexts/SoundContext'
import './stamp-card.css'

/**
 * @typedef {Object} ScMission Misión de HOY.
 * @property {string} id            Identificador estable ('votos' | 'juego' | 'ranking' | …).
 * @property {string} kanji         Kanji CON significado del tipo de misión (票 voto · 戦 juego · 覧 ver).
 * @property {string} label         Copy de la misión (p. ej. «Vota 10 duelos»).
 * @property {string} progress      Progreso ya formateado en mono («7/10 votos»). Lo formatea el caller.
 * @property {string} reward        Recompensa ya formateada en mono (p. ej. «+monedas»). La misión
 *                                  diaria acredita monedas vía DropService; este componente no la
 *                                  calcula: la recibe ya formateada y solo la muestra.
 * @property {'pending'|'claimable'|'completed'} state
 *                                  pending = sin lograr · claimable = lograda, botón-sello listo ·
 *                                  completed = reclamada (sello puesto).
 */

/**
 * @typedef {Object} ScDay Casilla de la cartilla (lunes→domingo, 7 entradas).
 * @property {string}  key          Clave estable del día (p. ej. la fecha ISO del server).
 * @property {number|string} dayNum Número del día para la esquina de la casilla.
 * @property {string}  weekdayShort «lun» … «dom».
 * @property {string}  weekdayLong  «lunes» … «domingo» (aria-label).
 * @property {number}  done         Misiones RECLAMADAS del día (las claimable no cuentan).
 * @property {number}  total        Misiones del día.
 * @property {boolean} isToday      Día actual SEGÚN EL SERVER (la TZ que manda es la del server).
 * @property {boolean} isPast       Día anterior a hoy según el server.
 */

const SC_ROT = [-3, 2, -5, 4, -2, 3, -4]
const SC_WEEKDAY_KANJI = ['月', '火', '水', '木', '金', '土', '日']

function scSealed(d) {
  return d.total > 0 && d.done >= d.total
}

/**
 * Tramo del cordón de racha: días sellados consecutivos. El extremo se
 * adelanta a HOY en cuanto hoy tiene su primer hito (done > 0) — es el
 * momento «la racha sigue viva» de la coreografía.
 */
function scComputeRun(week) {
  const ti = week.findIndex((d) => d.isToday)
  let end = -1
  if (ti >= 0 && week[ti].done > 0) {
    end = ti
  } else {
    const from = (ti >= 0 ? ti : week.length) - 1
    for (let i = from; i >= 0; i--) {
      if (scSealed(week[i])) { end = i; break }
    }
  }
  if (end < 0) return null
  let start = end
  while (start > 0 && scSealed(week[start - 1])) start--
  if (start === end) return null // un solo punto: no hay cordón
  return { start, end }
}

function scIsPerfect(week) {
  return week.length === 7 && week.every(scSealed)
}

/**
 * StampCard — cartilla de sellos de verano (rajio taisō) de las misiones
 * diarias. Componente CONTROLADO: el estado vive fuera (server +
 * lib/dailyProgress.js); aquí solo se detectan transiciones para
 * coreografiar. Reglas que garantiza:
 *
 *  · Los sellos históricos NUNCA re-animan: al montar, todo se pinta seco
 *    (el estado base CSS ya es el final). Solo anima lo que transiciona
 *    con el componente montado (= completado real).
 *  · El botón de reclamar y el sello resultante son el MISMO <button>
 *    (cambia data-state, no el nodo).
 *  · 皆勤 solo se renderiza con 7/7 real, y solo cae si el séptimo sello
 *    ocurre en vivo.
 *  · CSS en index.css (bloque sc-*), cero estilos runtime (CSP por hash).
 *
 * @param {Object}  props
 * @param {string}  props.weekLabel     Rótulo de la semana («8 – 14 jun»), formateado con la TZ del server.
 * @param {ScDay[]} props.week          7 días, lunes→domingo, calculados con la TZ del server.
 * @param {ScMission[]} props.missions  Misiones de hoy.
 * @param {number}  props.streak        Racha actual (días). Candidato natural a <LiveNumber>.
 * @param {string}  props.resetLabel    Tiempo hasta medianoche DEL SERVER ya formateado («5 h 04 min»).
 *                                      Recalcular con intervalo de minuto fuera (cero timers/segundo).
 * @param {(missionId: string) => void} props.onClaim
 *                                      Reclamación (optimista). El caller persiste y refresca props.
 * @param {number}  [props.replayCordKey=0]
 *                                      Solo demos/QA: al cambiar, redibuja el cordón con stagger.
 * @example
 * <StampCard
 *   weekLabel={semana.label}
 *   week={semana.dias}
 *   missions={misionesDeHoy}
 *   streak={racha.current}
 *   resetLabel={hastaMedianocheServer}
 *   onClaim={(id) => reclamarMision(id)}
 * />
 */
function StampCard({
  weekLabel,
  week,
  missions,
  streak,
  resetLabel,
  onClaim,
  replayCordKey = 0,
}) {
  const { play } = useSound()

  /* ── Transiciones derivadas EN render (patrón estado-desde-props).
     Al montar, prev === props iniciales → TODO seco (criterio 1).
     Inicializadores puros → StrictMode y React Compiler contentos:
     ni lectura ni escritura de refs durante el render. */
  const [prevMissions, setPrevMissions] = useState(missions)
  const [prevWeek, setPrevWeek] = useState(week)
  const [prevCordKey, setPrevCordKey] = useState(replayCordKey)
  const [wetIds, setWetIds] = useState(() => new Set())
  const [justSealed, setJustSealed] = useState(() => new Set())
  const [kaikinWet, setKaikinWet] = useState(false)
  const [freshSegs, setFreshSegs] = useState(() => new Map())
  const [freshMarks, setFreshMarks] = useState(() => new Set())
  const [announce, setAnnounce] = useState('')

  if (missions !== prevMissions) {
    setPrevMissions(missions)
    const wet = new Set(wetIds)
    missions.forEach((m) => {
      const before = prevMissions.find((p) => p.id === m.id)
      if (m.state === 'completed' && before && before.state !== 'completed') {
        wet.add(m.id) // completado AHORA: tinta fresca
      }
      if (m.state !== 'completed') wet.delete(m.id)
    })
    setWetIds(wet)
  }

  if (week !== prevWeek || replayCordKey !== prevCordKey) {
    const before = prevWeek
    const cordReplayed = replayCordKey !== prevCordKey
    setPrevWeek(week)
    setPrevCordKey(replayCordKey)

    const js = new Set()
    week.forEach((d, i) => {
      const b = before[i]
      const now = scSealed(d)
      const was = b ? scSealed(b) : now
      if (now && !was) js.add(d.key)
      else if (now && justSealed.has(d.key)) js.add(d.key)
    })
    setJustSealed(js)

    const ti = week.findIndex((d) => d.isToday)
    const fm = new Set()
    if (ti >= 0 && before[ti] && before[ti].key === week[ti].key &&
        week[ti].done > before[ti].done) {
      for (let k = before[ti].done; k < week[ti].done; k++) fm.add(k)
    }
    setFreshMarks(fm)

    const perfNow = scIsPerfect(week)
    const perfWas = scIsPerfect(before)
    if (perfNow && !perfWas) setKaikinWet(true)
    else if (!perfNow && kaikinWet) setKaikinWet(false)

    const runNow = scComputeRun(week)
    const runWas = scComputeRun(before)
    const fs = new Map()
    if (runNow && cordReplayed) {
      for (let i = runNow.start; i < runNow.end; i++) fs.set(i, i - runNow.start)
    } else if (runNow) {
      const prevEnd = runWas && runWas.start === runNow.start ? runWas.end : runNow.start
      let order = 0
      for (let i = Math.max(prevEnd, runNow.start); i < runNow.end; i++) fs.set(i, order++)
      freshSegs.forEach((o, i) => {
        if (i >= runNow.start && i < runNow.end && !fs.has(i)) fs.set(i, o)
      })
    }
    setFreshSegs(fs)
  }

  /* ── Efectos colaterales del completado real: sonido + aria-live. */
  const sndPrevRef = useRef(missions)
  useEffect(() => {
    const before = sndPrevRef.current
    sndPrevRef.current = missions
    if (before === missions) return
    const fresh = missions.filter((m) => {
      const b = before.find((p) => p.id === m.id)
      return m.state === 'completed' && b && b.state !== 'completed'
    })
    if (fresh.length > 0) {
      play('playAcunado') // respeta el mute global (animeshowdown.muted)
      setAnnounce(`Misión sellada: ${fresh[0].label}. Recompensa: ${fresh[0].reward}.`)
    }
  }, [missions, play])

  const dayPrevRef = useRef(week)
  useEffect(() => {
    const before = dayPrevRef.current
    dayPrevRef.current = week
    if (before === week) return
    week.forEach((d, i) => {
      const b = before[i]
      if (b && scSealed(d) && !scSealed(b)) {
        setAnnounce(`${d.weekdayLong}: día sellado, ${d.done} de ${d.total} misiones.`)
      }
    })
    if (scIsPerfect(week) && !scIsPerfect(before)) {
      setAnnounce('Semana perfecta: sello de asistencia completa.')
    }
  }, [week])

  /* ── Geometría del cordón: centros de casilla medidos en layout. */
  const weekRef = useRef(null)
  const dayRefs = useRef([])
  const [geom, setGeom] = useState(null)

  const measure = useCallback(() => {
    const grid = weekRef.current
    if (!grid) return
    const cells = dayRefs.current.slice(0, 7).filter(Boolean)
    if (cells.length !== 7) return
    const w = grid.scrollWidth
    const h = grid.scrollHeight
    const pts = cells.map((c) => ({
      x: c.offsetLeft + c.offsetWidth / 2,
      y: c.offsetTop + c.offsetHeight * 0.45,
    }))
    setGeom((g) => {
      if (
        g && g.w === w && g.h === h && g.pts.length === pts.length &&
        g.pts.every((p, i) => Math.abs(p.x - pts[i].x) < 0.5 && Math.abs(p.y - pts[i].y) < 0.5)
      ) return g // sin cambios: evita bucle del ResizeObserver
      return { w, h, pts }
    })
  }, [])

  useLayoutEffect(() => {
    measure()
    const grid = weekRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [measure, week.length])

  /* 390 px: hoy centrado en la fila scrolleable (scrollLeft directo). */
  useLayoutEffect(() => {
    const grid = weekRef.current
    if (!grid) return
    if (grid.scrollWidth <= grid.clientWidth + 4) return
    const ti = week.findIndex((d) => d.isToday)
    const cell = dayRefs.current[ti]
    if (!cell) return
    grid.scrollLeft = cell.offsetLeft - (grid.clientWidth - cell.offsetWidth) / 2
  }, [week, geom])

  const run = useMemo(() => scComputeRun(week), [week])
  const perfect = scIsPerfect(week)

  const segs = []
  if (run && geom) {
    for (let i = run.start; i < run.end; i++) {
      const a = geom.pts[i]
      const b = geom.pts[i + 1]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2 + 9 // leve comba del cordón
      segs.push({
        i,
        d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`,
        fresh: freshSegs.has(i),
        order: freshSegs.get(i) || 0,
      })
    }
  }

  return (
    <section className="sc-card" aria-label="Cartilla de sellos de misiones diarias">
      <header className="sc-head">
        <div className="sc-title">
          <h2>Cartilla de verano</h2>
          <p className="sc-title__sub">misiones diarias · {weekLabel}</p>
        </div>
        <div className="sc-meta">
          <p className="sc-streak" aria-label={`Racha actual: ${streak} días`}>
            <span className="sc-streak__kanji" lang="ja" aria-hidden="true">連</span>
            {/* Punto de integración: sustituir por <LiveNumber value={streak} /> */}
            <span className="sc-streak__num">{streak}</span>
            <span className="sc-streak__cap">días de racha</span>
          </p>
          <p className="sc-reset">se renueva en <strong>{resetLabel}</strong></p>
        </div>
      </header>

      <ul className="sc-missions">
        {missions.map((m, idx) => {
          const sealState = m.state === 'completed' ? 'sealed' : m.state
          const wet = wetIds.has(m.id)
          const ariaLabel =
            m.state === 'claimable' ? `Reclamar «${m.label}»: ${m.reward}`
            : m.state === 'completed' ? `${m.label}: sellada`
            : `${m.label}: pendiente`
          return (
            <li key={m.id} className="sc-mission" data-state={m.state}>
              <span className="sc-mission__info">
                <span className="sc-mission__label">{m.label}</span>
                <span className="sc-mission__progress">{m.progress}</span>
              </span>
              <span className="sc-mission__reward">{m.reward}</span>
              {/* Botón-sello: reclamable → tinta fresca → sello seco, SIEMPRE
                  el mismo nodo (criterio 2). */}
              <button
                type="button"
                className="sc-seal"
                data-state={sealState}
                data-wet={wet ? 'true' : undefined}
                disabled={m.state !== 'claimable'}
                style={{ '--sc-rot': `${SC_ROT[idx % SC_ROT.length]}deg` }}
                aria-label={ariaLabel}
                onClick={m.state === 'claimable' ? () => onClaim(m.id) : undefined}
              >
                <span className="sc-seal__bleed" aria-hidden="true"></span>
                <span className="sc-seal__face" aria-hidden="true">
                  <span lang="ja">{m.kanji}</span>
                  <span className="sc-seal__hint">sellar</span>
                </span>
                <span className="sc-seal__fresh" aria-hidden="true"></span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="sc-week-wrap">
        {/* tabIndex=0: en ≤540px la cartilla pasa a flex+overflow-x (riel
            scrolleable) y sus casillas no son interactivas → sin tabindex sería
            una región scrollable sin acceso por teclado (axe serious). */}
        <div className="sc-week" role="list" ref={weekRef} aria-label="Cartilla de la semana" tabIndex={0}>
          {geom !== null && segs.length > 0 && (
            <svg
              className="sc-cord"
              width={geom.w}
              height={geom.h}
              viewBox={`0 0 ${geom.w} ${geom.h}`}
              aria-hidden="true"
            >
              {segs.map((s) => (
                <path
                  key={s.i}
                  className="sc-cord__seg"
                  d={s.d}
                  pathLength="1"
                  data-fresh={s.fresh ? 'true' : undefined}
                  style={s.fresh ? { animationDelay: `${350 + s.order * 300}ms` } : undefined}
                />
              ))}
            </svg>
          )}
          {week.map((d, i) => {
            const sealed = scSealed(d)
            const failed = d.isPast && !sealed
            const future = !d.isPast && !d.isToday
            const stateWord = sealed ? 'sellado' : failed ? 'sin sellar' : d.isToday ? 'en curso' : 'pendiente'
            return (
              <div
                key={d.key}
                role="listitem"
                className="sc-day"
                ref={(el) => { dayRefs.current[i] = el }}
                data-today={d.isToday || undefined}
                data-sealed={sealed || undefined}
                data-failed={failed || undefined}
                data-future={future || undefined}
                data-just-sealed={justSealed.has(d.key) || undefined}
                aria-label={`${d.weekdayLong}: ${d.done} de ${d.total} misiones, ${stateWord}`}
                style={{ '--sc-rot': `${SC_ROT[(i + 3) % SC_ROT.length]}deg` }}
              >
                {d.isToday && <span className="sc-day__today" aria-hidden="true">hoy</span>}
                <span className="sc-day__top" aria-hidden="true">
                  <span className="sc-day__wd">{d.weekdayShort}</span>
                  <span className="sc-day__num">{d.dayNum}</span>
                </span>
                {sealed ? (
                  <span className="sc-day__seal" lang="ja" aria-hidden="true">
                    {SC_WEEKDAY_KANJI[i]}
                  </span>
                ) : (
                  <span className="sc-day__slot" aria-hidden="true"></span>
                )}
                <span className="sc-day__marks" aria-hidden="true">
                  {Array.from({ length: d.total }).map((_, k) => (
                    <span
                      key={k}
                      className="sc-mark"
                      data-done={k < d.done || undefined}
                      data-fresh={(d.isToday && freshMarks.has(k)) || undefined}
                    ></span>
                  ))}
                </span>
                <span className="sc-day__shineclip" aria-hidden="true">
                  <span className="sc-day__shine"></span>
                </span>
              </div>
            )
          })}
        </div>
        {perfect && (
          <div
            className="sc-kaikin"
            data-wet={kaikinWet ? 'true' : undefined}
            role="img"
            aria-label="Sello de semana perfecta: asistencia completa"
          >
            <span className="sc-kaikin__stamp">
              <span className="sc-kaikin__kanji" lang="ja">皆勤</span>
              <span className="sc-kaikin__cap">semana<br />perfecta</span>
            </span>
          </div>
        )}
      </div>

      <footer className="sc-foot">
        <span>reinicio a medianoche · la zona horaria que manda es la del server</span>
        <span lang="ja" aria-hidden="true">印</span>
      </footer>

      <p className="sc-visually-hidden" role="status" aria-live="polite">{announce}</p>
    </section>
  )
}

export default StampCard
