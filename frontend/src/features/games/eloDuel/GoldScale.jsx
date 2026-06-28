/**
 * GoldScale — el pesaje del higher/lower de ELO.
 *
 * Una balanza de platillos SVG (brazo, fiel y cadenas como hairlines doradas)
 * con los dos retratos 2:3 colgando de los platillos. La racha es física:
 * cada acierto apila una pesa de oro con su número grabado en la fila de pesas.
 *
 * CONTRATO (no negociable):
 *  - El reveal SIEMPRE espera al server. Este componente es 100% controlado:
 *    el usuario elige → onPick(side) → el padre habla con el server → el padre
 *    pasa `result` (+ los ELO revelados). Cero reveal especulativo.
 *  - La espera es cancelable: el vaivén decae limpio en cuanto llega `result`,
 *    venga a los 80ms o a los 8s.
 *  - El vuelco del fallo corre UNA vez (keyed por resultId), nunca re-anima
 *    en re-renders.
 *
 * Coreografía (timings exactos en GoldScale.notas.md):
 *  pick    → el platillo elegido se hunde 2px (~80ms, vía rAF).
 *  waiting → tras 450ms sin respuesta, vaivén de ±1px en el tip (periodo 2.2s).
 *  reveal  → odómetro mono 500ms → brazo rota ±6° (spring corto, UN rebote,
 *            cadenas con 1 frame de retardo — secondary motion).
 *  acierto → clink + pesa nueva cae a la fila (translateY, ease-stamp, 300ms).
 *  fallo   → brazo se desploma 8° en 200ms hacia el lado contrario + golpe
 *            sordo; las pesas se vuelcan en cascada (stagger 40ms, una vez).
 *  récord  → la fila brilla UNA pasada (600ms).
 *  empate  → brazo PLANO (320ms ease-lift) + sello "empate técnico".
 *
 * Reduced motion: números y resultado directos — sin rotación, sin vuelco,
 * sin vaivén. Perf: SVG único animado por transform de grupos; los valores
 * que cambian >1×/frame se escriben vía ref (React Compiler-safe); el rAF se
 * pausa fuera del viewport y con la pestaña oculta; cero blur/filter nuevos.
 *
 * @param {object} props
 * @param {{slug: string, nombre: string, anime: string}} props.left
 *   Personaje del platillo izquierdo (retrato vía <PersonajeImg slug/>).
 * @param {{slug: string, nombre: string, anime: string}} props.right
 *   Personaje del platillo derecho.
 * @param {number|null} [props.leftElo]
 *   ELO visible del lado izquierdo al empezar la ronda (null = oculto "????").
 * @param {number|null} [props.rightElo]
 *   ELO visible del lado derecho al empezar la ronda (null = oculto).
 * @param {{outcome: 'win'|'lose'|'tie', leftElo: number, rightElo: number,
 *          streakAfter: number, recordAfter: number, recordBeaten: boolean,
 *          resultId: string}|null} props.result
 *   Respuesta del server. null mientras se espera. resultId DEBE ser único por
 *   ronda: es la llave que evita re-animar el vuelco en re-renders.
 * @param {'left'|'right'|null} props.picked
 *   Lado elegido (controlado por el padre; se fija en onPick y no cambia
 *   hasta la siguiente ronda).
 * @param {(side: 'left'|'right') => void} props.onPick
 *   El usuario eligió un platillo. El padre dispara la petición al server.
 * @param {number} props.streak  Racha actual (pesas apiladas al montar).
 * @param {string} [props.tieRuleLabel]
 *   Texto de la regla de empate del server (p.ej. "la racha se mantiene").
 *   NO existe en el prompt del producto: el padre debe pasar la regla real.
 * @param {boolean} [props.disabled]  Bloquea la elección (p.ej. fin de partida).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './goldscale.css'
import { useReducedMotion } from 'framer-motion'
import { useSound } from '../../../contexts/SoundContext'
import PersonajeImg from '../../../components/PersonajeImg'

const ARM_HALF = 232 // px en coordenadas del viewBox (tips en x=108/572, pivote 340)
const SWAY_DELAY_MS = 450
const SWAY_PERIOD_MS = 2200
const ODO_MS = 500
const SPRING_MS = 620
const SLAM_MS = 200
const TIE_MS = 320

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)
const easeLiftFn = (p) => 1 - Math.pow(1 - p, 4)
// UN rebote (~+7% de overshoot), asentado en ~620ms.
const spring1 = (p) => 1 - Math.exp(-6.2 * p) * Math.cos(7.4 * p)
const slamFn = (p) => p * p

function GoldScale({
  left,
  right,
  leftElo = null,
  rightElo = null,
  result,
  picked,
  onPick,
  streak,
  tieRuleLabel,
  disabled = false,
}) {
  const reduced = useReducedMotion()
  const { play } = useSound()

  // Fase derivada del contrato: pick → waiting (picked && !result) → reveal/result.
  const waiting = picked != null && result == null

  // 'reveal' arranca cuando result cambia de null a payload; el resto de la
  // coreografía avanza por timers (no por rAF: si la pestaña está oculta el
  // resultado debe quedar aplicado igual y el rAF solo se pone al día al volver).
  const [shownLeftElo, setShownLeftElo] = useState(leftElo)
  const [shownRightElo, setShownRightElo] = useState(rightElo)
  const [landedId, setLandedId] = useState(null) // resultId ya coreografiado
  const [announcement, setAnnouncement] = useState('')
  const [shineId, setShineId] = useState(null)

  // — refs de escena (todo lo que cambia >1×/frame se escribe aquí, no en estado)
  const armRef = useRef(null)
  const hangLRef = useRef(null)
  const hangRRef = useRef(null)
  const eloLRef = useRef(null)
  const eloRRef = useRef(null)
  const rootRef = useRef(null)
  const stageFrameRef = useRef(null)

  // — motor de animación (ángulo, vaivén, hundimiento) en un solo rAF pausable
  const engine = useRef({
    angle: 0, anglePrev: 0, tween: null,
    swayOn: false, swayAmp: 0, waitStart: 0,
    sinkL: 0, sinkR: 0, sinkLT: 0, sinkRT: 0,
    raf: 0, visible: true, onScreen: true,
  })

  const tick = useCallback(function step(now) {
    const e = engine.current
    e.raf = 0
    const lerp = (c, t, f) => c + (t - c) * f
    e.sinkL = lerp(e.sinkL, e.sinkLT, 0.35)
    e.sinkR = lerp(e.sinkR, e.sinkRT, 0.35)
    let active =
      Math.abs(e.sinkL - e.sinkLT) > 0.05 || Math.abs(e.sinkR - e.sinkRT) > 0.05
    let swayDeg = 0
    if (e.swayOn) {
      e.swayAmp = lerp(e.swayAmp, now - e.waitStart > SWAY_DELAY_MS ? 1 : 0, 0.06)
      active = true
    } else {
      e.swayAmp = lerp(e.swayAmp, 0, 0.25) // cancelación limpia de la espera
    }
    if (e.swayAmp > 0.01) {
      // ±1px en el tip ≈ 0.25° con ARM_HALF=232
      swayDeg = 0.25 * e.swayAmp *
        Math.sin(((now - e.waitStart) / SWAY_PERIOD_MS) * Math.PI * 2)
      active = true
    }
    let base = e.angle
    if (e.tween) {
      const t = e.tween
      const p = Math.min(1, (now - t.start) / t.dur)
      const f = t.type === 'spring' ? spring1(p)
        : t.type === 'slam' ? slamFn(p)
        : easeLiftFn(p)
      base = t.from + (t.to - t.from) * f
      e.angle = base
      active = true
      if (p >= 1) { e.angle = t.to; base = t.to; e.tween = null }
    }
    const theta = base + swayDeg
    if (Math.abs(e.anglePrev - theta) > 0.005) active = true
    if (armRef.current) armRef.current.style.transform = `rotate(${theta.toFixed(3)}deg)`
    // Secondary motion: cadenas/platillos siguen el ángulo del FRAME ANTERIOR.
    const rad = (e.anglePrev * Math.PI) / 180
    const ty = Math.sin(rad) * ARM_HALF
    if (hangLRef.current) {
      hangLRef.current.style.transform = `translate3d(0, ${(-ty + e.sinkL).toFixed(2)}px, 0)`
    }
    if (hangRRef.current) {
      hangRRef.current.style.transform = `translate3d(0, ${(ty + e.sinkR).toFixed(2)}px, 0)`
    }
    e.anglePrev = theta
    if (active && e.visible && e.onScreen) e.raf = requestAnimationFrame(step)
  }, [])

  const ensureRaf = useCallback(() => {
    const e = engine.current
    if (!e.raf && e.visible && e.onScreen) e.raf = requestAnimationFrame(tick)
  }, [tick])

  // Pausa fuera del viewport y con pestaña oculta (al volver, el tick se pone al día).
  useEffect(() => {
    const e = engine.current
    const onVis = () => {
      e.visible = !document.hidden
      if (e.visible) ensureRaf()
      else if (e.raf) { cancelAnimationFrame(e.raf); e.raf = 0 }
    }
    document.addEventListener('visibilitychange', onVis)
    let io
    if (rootRef.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        e.onScreen = entries[0] ? entries[0].isIntersecting : true
        if (e.onScreen) ensureRaf()
      })
      io.observe(rootRef.current)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (io) io.disconnect()
      if (e.raf) cancelAnimationFrame(e.raf)
    }
  }, [ensureRaf])

  // — escala fluida del escenario: el sistema de coordenadas es fijo (680×470,
  // el rAF posiciona los platillos en px), así que en pantallas estrechas hay
  // que escalar TODO el escenario para que no se recorte. Medimos el ancho del
  // marco y escribimos --gs-scale = ancho/680 (tope 1, nunca agranda).
  useLayoutEffect(() => {
    const frame = stageFrameRef.current
    if (!frame) return
    const aplicar = () => {
      frame.style.setProperty('--gs-scale', String(Math.min(1, frame.clientWidth / 680)))
    }
    aplicar()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(aplicar)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  // — pick: hundimiento inmediato + vaivén de espera
  useEffect(() => {
    const e = engine.current
    e.sinkLT = waiting && picked === 'left' ? 2 : 0
    e.sinkRT = waiting && picked === 'right' ? 2 : 0
    if (waiting && !reduced) {
      e.waitStart = performance.now()
      e.swayOn = true
    } else {
      e.swayOn = false
    }
    ensureRaf()
  }, [waiting, picked, reduced, ensureRaf])

  // — odómetro: escribe textContent vía ref (nunca estado por frame)
  const odoTimers = useRef([])
  const runOdometer = useCallback((el, target) => {
    if (!el) return
    const start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / ODO_MS)
      const text = String(Math.round(target * easeOutCubic(p))).padStart(4, '0')
      // nodeValue sobre el text node existente: con textContent, React pierde
      // su text node y sus updates posteriores a ese span no pintan.
      if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = text
      else el.textContent = text
      if (p < 1) odoTimers.current.push(requestAnimationFrame(step))
    }
    odoTimers.current.push(requestAnimationFrame(step))
  }, [])

  // — reveal + resultado: dispara UNA vez por resultId
  useEffect(() => {
    if (!result || result.resultId === landedId) return undefined
    const e = engine.current
    e.swayOn = false
    const timers = []
    const heavier = result.leftElo > result.rightElo ? 'left'
      : result.rightElo > result.leftElo ? 'right' : null
    const sign = heavier === 'right' ? 1 : heavier === 'left' ? -1 : 0
    const target = result.outcome === 'tie' ? 0
      : sign * (result.outcome === 'lose' ? 8 : 6)

    const announce = () => {
      const heavy = heavier === 'right' ? right : left
      const light = heavier === 'right' ? left : right
      if (result.outcome === 'win') {
        setAnnouncement(
          `correcto: ${heavy.nombre} ${Math.max(result.leftElo, result.rightElo)} ` +
          `sobre ${light.nombre} ${Math.min(result.leftElo, result.rightElo)}`
        )
      } else if (result.outcome === 'lose') {
        setAnnouncement(
          `fallo: ${heavy.nombre} ${Math.max(result.leftElo, result.rightElo)} ` +
          `sobre ${light.nombre} ${Math.min(result.leftElo, result.rightElo)}`
        )
      } else {
        setAnnouncement(
          `empate técnico: ambos ${result.leftElo}. ${tieRuleLabel ?? ''}`
        )
      }
    }

    const land = () => {
      e.sinkLT = 0
      e.sinkRT = 0
      setLandedId(result.resultId)
      announce()
      if (result.outcome === 'win') {
        timers.push(setTimeout(() => play('playClink'), reduced ? 0 : 260))
        if (result.recordBeaten) {
          timers.push(setTimeout(() => setShineId(result.resultId), reduced ? 0 : 460))
        }
      } else if (result.outcome === 'lose') {
        play('playImpact')
      }
      ensureRaf()
    }

    if (reduced) {
      setShownLeftElo(result.leftElo)
      setShownRightElo(result.rightElo)
      e.tween = null
      e.angle = target
      land()
      return () => timers.forEach(clearTimeout)
    }

    if (leftElo == null) runOdometer(eloLRef.current, result.leftElo)
    if (rightElo == null) runOdometer(eloRRef.current, result.rightElo)
    const anyHidden = leftElo == null || rightElo == null
    timers.push(setTimeout(() => {
      setShownLeftElo(result.leftElo)
      setShownRightElo(result.rightElo)
      const dur = result.outcome === 'lose' ? SLAM_MS
        : result.outcome === 'tie' ? TIE_MS : SPRING_MS
      e.tween = {
        from: e.angle, to: target, start: performance.now(), dur,
        type: result.outcome === 'lose' ? 'slam'
          : result.outcome === 'tie' ? 'lift' : 'spring',
      }
      ensureRaf()
      timers.push(setTimeout(land, dur + 30))
    }, anyHidden ? ODO_MS : 140))

    const pendingOdos = odoTimers.current
    return () => {
      timers.forEach(clearTimeout)
      pendingOdos.forEach(cancelAnimationFrame)
      // Reset del array: sin esto los rAF ids (ya cancelados) se acumulan en
      // odoTimers.current en cada resultId → fuga de memoria en sesión larga.
      odoTimers.current = []
    }
  }, [result, landedId, reduced, leftElo, rightElo, left, right, tieRuleLabel,
      play, runOdometer, ensureRaf])

  const landed = result != null && result.resultId === landedId
  const canPick = !disabled && picked == null && result == null

  // — fila de pesas: derivada, las animaciones van keyed por resultId (una vez)
  const weights = useMemo(() => {
    const base = Array.from({ length: streak }, (_, i) => i + 1)
    if (landed && result.outcome === 'win') base.push(result.streakAfter)
    return base
  }, [streak, landed, result])
  const toppled = landed && result.outcome === 'lose'

  const handlePick = useCallback((side) => {
    if (!canPick) return
    onPick(side)
  }, [canPick, onPick])

  const pan = (side, char, shownElo, eloRef, hangRef) => (
    <div ref={hangRef} className="gs-hang" data-side={side}>
      <svg width="170" height="72" viewBox="0 0 170 72" aria-hidden="true" className="block">
        <circle cx="85" cy="5" r="3" fill="none" className="stroke-gold" strokeWidth="1.2" />
        <line x1="85" y1="8" x2="22" y2="58" className="stroke-gold/80" strokeWidth="1" />
        <line x1="85" y1="8" x2="148" y2="58" className="stroke-gold/80" strokeWidth="1" />
        <path d="M12,58 Q85,88 158,58" className="fill-surface stroke-gold" strokeWidth="1.4" />
      </svg>
      <button
        type="button"
        onClick={() => handlePick(side)}
        disabled={!canPick}
        aria-disabled={!canPick}
        aria-label={`Elegir a ${char.nombre} de ${char.anime}${shownElo == null ? '' : `, ELO ${shownElo}`}`}
        className="gs-pan-btn focus-visible:outline-2 focus-visible:outline-electric"
      >
        <span className={`gs-card ${picked === side && !landed ? 'gs-card--picked' : ''}`}>
          <PersonajeImg slug={char.slug} alt={char.nombre} className="h-full w-full" />
          <span className="gs-card-scrim">
            <span className="block text-[13px] font-bold text-fg-strong">{char.nombre}</span>
            <span className="block text-[11px] text-fg-muted">{char.anime}</span>
          </span>
        </span>
        <span
          ref={eloRef}
          className="gs-elo font-mono text-gold"
          aria-label={shownElo == null ? 'ELO oculto' : `ELO ${shownElo}`}
        >
          {shownElo == null ? '????' : String(shownElo)}
        </span>
      </button>
    </div>
  )

  return (
    <div ref={rootRef} className="gs-root">
      <div ref={stageFrameRef} className="gs-stage-frame">
      <div className="gs-stage">
        <svg viewBox="0 0 680 470" className="gs-armature" aria-hidden="true">
          <defs>
            <linearGradient id="gs-beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--color-gold)" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="var(--color-gold-bright)" />
              <stop offset="1" stopColor="var(--color-gold)" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <rect x="339" y="72" width="2" height="356" className="fill-gold/55" />
          <rect x="250" y="428" width="180" height="9" rx="2.5" className="fill-surface-alt" />
          <rect x="250" y="427.4" width="180" height="1.2" className="fill-gold/60" />
          <path d="M340,50 L326,73 L354,73 Z" className="fill-surface-alt stroke-gold/55" strokeWidth="1" />
          <g ref={armRef} className="gs-arm">
            <rect x="108" y="66.6" width="464" height="2.8" rx="1.4" fill="url(#gs-beam)" />
            <rect x="339.3" y="34" width="1.4" height="34" className="fill-gold-bright" />
            <path d="M340,25 l5,9 -5,9 -5,-9 Z" fill="none" className="stroke-gold-bright" strokeWidth="1.2" />
            <circle cx="108" cy="68" r="4" className="fill-gold" />
            <circle cx="572" cy="68" r="4" className="fill-gold" />
          </g>
          <circle cx="340" cy="68" r="5.5" className="fill-surface stroke-gold" strokeWidth="1.5" />
        </svg>
        {pan('left', left, shownLeftElo, eloLRef, hangLRef)}
        {pan('right', right, shownRightElo, eloRRef, hangRRef)}
        {landed && result.outcome === 'tie' && (
          <div className="gs-tie" key={result.resultId}>
            <div className={`gs-tie-stamp ${reduced ? '' : 'gs-tie-stamp--anim'}`}>
              <span lang="ja" className="gs-tie-kanji">同</span>
              <span className="block text-[13px] font-bold text-accent-text">Empate técnico</span>
              {tieRuleLabel && (
                <span className="block font-mono text-2xs text-fg-muted">{tieRuleLabel}</span>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      <p role="status" aria-live="polite" className="gs-live font-mono text-[13px] text-gold-pale">
        {announcement}
      </p>

      <div className="gs-weights-wrap">
        {shineId != null && !reduced && (
          <div aria-hidden="true" className="gs-shine-clip" key={shineId}>
            <div className="gs-shine" />
          </div>
        )}
        <div className="gs-weights" key={toppled ? `t-${result.resultId}` : 'row'}>
          {weights.map((n, i) => (
            <div
              key={n}
              className={`gs-weight ${
                toppled && !reduced ? 'gs-weight--topple' : ''
              } ${toppled && reduced ? 'gs-weight--tipped' : ''} ${
                landed && result.outcome === 'win' && n === result.streakAfter && !reduced
                  ? 'gs-weight--drop'
                  : ''
              }`}
              style={toppled && !reduced ? { animationDelay: `${i * 40}ms` } : undefined}
            >
              <span className="gs-weight-knob" />
              <span className="gs-weight-body font-mono">{n}</span>
            </div>
          ))}
        </div>
        <div className="gs-shelf" />
      </div>
    </div>
  )
}

export default GoldScale
