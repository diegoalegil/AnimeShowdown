/**
 * VoteVerdict — "La balanza de tinta": el veredicto de la comunidad tras tu voto.
 *
 * Ubicación sugerida: src/features/votar/components/VoteVerdict.jsx
 * Requiere: ../verdict-timing.js + ../verdict.css (CSS de feature, bundleado).
 *
 * Montar el componente CUANDO el server confirma el voto (t0): el padre ya
 * tiene los % reales. Para re-jugar la pieza, remontar con `key` (el cleanup
 * cancela rAF/animación y timers: replay infinito sin fugas).
 *
 * COREOGRAFÍA (constantes en verdict-timing.js — espejo en verdict.css):
 *   t0       el componente monta con los % reales del server.
 *   t0→600   ambas aguadas avanzan (scaleX/scaleY origin a su extremo,
 *            var(--ease-brush)). El frente irregular (SVG path ESTÁTICO)
 *            viaja con cada capa vía translate. Los odómetros suben LIGADOS
 *            AL MISMO motion value: un solo progress reparte avance y cifras.
 *   t+600    settle ⇒ data-vv-settled. La hairline dorada nace en el punto
 *            de encuentro (scaleY 0→1, 120ms).
 *   t+720    el lado ganador respira UNA vez (1→1.012→1, 250ms) y su %
 *            gana peso (scale 1.12 + gold-bright). Empate: respiran AMBOS.
 *   t+720    destello cian 150ms sobre la hairline — SOLO underdog.
 *   t+800    el sello 票 cae sobre tu lado (--ease-stamp, 350ms).
 *   t+1000   el sangrado del sello aflora (240ms).
 *
 * PERF: 0 re-renders por frame — el progress escribe transform/textContent
 * vía refs; React solo re-renderiza al settle (1 vez). Alturas reservadas
 * en CSS (cero CLS). Sin blur/filters; todo transform/opacity. One-shot:
 * no hay loops que pausar fuera del viewport.
 *
 * A11Y: role=status + aria-live=polite anuncia el resultado textual al
 * settle ("Goku 64% — Vegeta 36%, tu voto a Goku"). reduced-motion pinta
 * el estado final directo, con el sello puesto.
 *
 * SONIDO (lib/sounds.js, ver verdict-sounds.js): lavado grave al avanzar,
 * tick de odómetro cada ~8% del lado líder, golpe seco al caer el sello.
 * Todo vía useSound().play ⇒ respeta el mute global.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { useSound } from '../../../contexts/SoundContext'
import '../verdict.css'
import {
  WASH_MS,
  HAIRLINE_MS,
  BREATH_MS,
  STAMP_MS,
  STAMP_BLEED_MS,
  FLASH_MS,
  SETTLE_DELAYS_MS,
  EASE_BRUSH,
  ODOMETER_TICK_EVERY_PCT,
  visualSplit,
  isUnderdogWin,
} from '../verdict-timing'

/* Frente irregular de tinta — paths ESTÁTICOS (viajan, no se redibujan).
   _H: avance horizontal (viewBox 0 0 16 120). _V: vertical (0 0 120 16). */
const EDGE_A_H =
  'M0 0 L4 0 C 9 7, 2 13, 7 21 C 12 28, 3 34, 8 42 C 13 49, 2 56, 6 63 C 11 70, 3 77, 9 85 C 13 92, 2 99, 7 106 C 10 112, 4 116, 5 120 L0 120 Z'
const EDGE_B_H =
  'M16 0 L12 0 C 7 7, 14 13, 9 21 C 4 28, 13 34, 8 42 C 3 49, 14 56, 10 63 C 5 70, 13 77, 7 85 C 3 92, 14 99, 9 106 C 6 112, 12 116, 11 120 L16 120 Z'
const EDGE_A_V =
  'M0 0 L0 4 C 7 9, 13 2, 21 7 C 28 12, 34 3, 42 8 C 49 13, 56 2, 63 6 C 70 11, 77 3, 85 9 C 92 13, 99 2, 106 7 C 112 10, 116 4, 120 5 L120 0 Z'
const EDGE_B_V =
  'M0 16 L0 12 C 7 7, 13 14, 21 9 C 28 4, 34 13, 42 8 C 49 3, 56 14, 63 10 C 70 5, 77 13, 85 7 C 92 3, 99 14, 106 9 C 112 6, 116 12, 120 11 L120 16 Z'

/** Fases válidas para replays parciales (demo/QA). */
const START_BASE_MS = {
  wash: 0,
  hairline: SETTLE_DELAYS_MS.hairline,
  flash: SETTLE_DELAYS_MS.flash,
  breath: SETTLE_DELAYS_MS.breath,
  stamp: SETTLE_DELAYS_MS.stamp,
}

/**
 * @param {object} props
 * @param {{ nombre: string, pct: number }} props.ladoA Lado izquierdo (arriba en vertical). pct REAL 0–100.
 * @param {{ nombre: string, pct: number }} props.ladoB Lado derecho (abajo en vertical).
 * @param {'A'|'B'} [props.miLado='A'] Dónde cae tu sello 票.
 * @param {number|null} [props.totalVotos] Total de votos del duelo (votosGanador+votosPerdedor del backend). Si falta, no se muestra — no se inventa.
 * @param {number|null} [props.expectedWinnerPct] % ESPERADO (prior, p. ej. ELO) del lado que ganó. ≤35 ⇒ destello cian. Si el producto no lo aporta, omitir: sin dato no hay destello.
 * @param {boolean} [props.primerVoto=false] Eres el primero en juzgar este duelo: mensaje en mono, sin aguadas falsas.
 * @param {boolean} [props.error=false] Error de red post-voto: estado honesto con reintento, jamás % inventados.
 * @param {() => void} [props.onRetry] Handler del reintento (estado error).
 * @param {boolean} [props.vertical=false] 390px: aguadas apiladas + hairline horizontal. El padre decide (matchMedia 639px / useSyncExternalStore).
 * @param {number} [props.timeScale=1] Multiplicador de tiempos (QA/cámara lenta). 1 en producción.
 * @param {'wash'|'hairline'|'breath'|'stamp'|'flash'} [props.startPhase='wash'] Replay parcial: fases anteriores quedan pintadas como resueltas.
 * @param {() => void} [props.onSettled] Callback al asentarse el veredicto (t+600), p. ej. para soltar las CTAs del panel.
 */
function VoteVerdict({
  ladoA,
  ladoB,
  miLado = 'A',
  totalVotos = null,
  expectedWinnerPct = null,
  primerVoto = false,
  error = false,
  onRetry,
  vertical = false,
  timeScale = 1,
  startPhase = 'wash',
  onSettled,
}) {
  const { play } = useSound()
  const reduce = useReducedMotion()

  const bandRef = useRef(null)
  const washARef = useRef(null)
  const washBRef = useRef(null)
  const edgeARef = useRef(null)
  const edgeBRef = useRef(null)
  const numARef = useRef(null)
  const numBRef = useRef(null)

  // Inicializadores PUROS (StrictMode monta doble sin efectos colaterales).
  const skipMotion = reduce === true
  const [settled, setSettled] = useState(skipMotion)
  const pA = ladoA.pct
  const pB = ladoB.pct
  const tie = pA === pB
  const winner = tie ? null : pA > pB ? 'A' : 'B'
  const miNombre = miLado === 'A' ? ladoA.nombre : ladoB.nombre
  const captionText = `${ladoA.nombre} ${pA}% — ${ladoB.nombre} ${pB}%, tu voto a ${miNombre}${
    totalVotos != null ? ` · ${totalVotos.toLocaleString('es')} votos` : ''
  }`
  const [announced, setAnnounced] = useState(skipMotion ? captionText : '')

  const split = visualSplit(pA)
  const underdog = !tie && isUnderdogWin(expectedWinnerPct)
  const startBase = START_BASE_MS[startPhase] ?? 0
  const ts = timeScale

  // Delays relativos al settle. Fases anteriores al startPhase ⇒ -9999ms
  // (con fill both, el navegador las pinta directamente en su estado final).
  const d = (ms) => `${ms < startBase ? -9999 : Math.round((ms - startBase) * ts)}ms`
  const stampOffset = 52
  const stampPos =
    miLado === 'A'
      ? `clamp(34px, calc(${split}% - ${stampOffset}px), calc(100% - 34px))`
      : `clamp(34px, calc(${split}% + ${stampOffset}px), calc(100% - 34px))`
  const styleVars = {
    '--vv-split': `${split}%`,
    '--vv-stamp-pos': stampPos,
    '--vv-d-hairline': d(SETTLE_DELAYS_MS.hairline),
    '--vv-d-flash': d(SETTLE_DELAYS_MS.flash),
    '--vv-d-breath': d(SETTLE_DELAYS_MS.breath),
    '--vv-d-stamp': d(SETTLE_DELAYS_MS.stamp),
    '--vv-d-bleed': d(SETTLE_DELAYS_MS.bleed),
    '--vv-ms-hairline': `${HAIRLINE_MS * ts}ms`,
    '--vv-ms-breath': `${BREATH_MS * ts}ms`,
    '--vv-ms-stamp': `${STAMP_MS * ts}ms`,
    '--vv-ms-flash': `${FLASH_MS * ts}ms`,
    '--vv-ms-bleed': `${STAMP_BLEED_MS * ts}ms`,
  }

  useLayoutEffect(() => {
    if (primerVoto || error) return undefined
    const timers = []
    let controls = null

    /* UN solo progress reparte avance Y cifras: nunca desincronizados. */
    const apply = (p) => {
      const band = bandRef.current
      if (!band || !washARef.current) return
      const size = vertical ? band.offsetHeight : band.offsetWidth
      const fn = vertical ? 'scaleY' : 'scaleX'
      const tr = vertical ? 'translateY' : 'translateX'
      washARef.current.style.transform = `${fn}(${p})`
      washBRef.current.style.transform = `${fn}(${p})`
      edgeARef.current.style.transform = `${tr}(${-(1 - p) * (split / 100) * size}px)`
      edgeBRef.current.style.transform = `${tr}(${(1 - p) * ((100 - split) / 100) * size}px)`
      if (numARef.current) numARef.current.textContent = String(Math.round(pA * p))
      if (numBRef.current) numBRef.current.textContent = String(Math.round(pB * p))
    }

    const settle = (withSound) => {
      setSettled(true)
      setAnnounced(captionText)
      onSettled?.()
      if (withSound) {
        const stampDelay = Math.max(0, SETTLE_DELAYS_MS.stamp - startBase) * ts + 210 * ts
        timers.push(setTimeout(() => play('playVerdictStamp'), stampDelay))
      }
    }

    if (skipMotion) {
      apply(1)
      return undefined // settled ya nació true; sin sonido en reduce
    }

    if (startPhase !== 'wash') {
      apply(1)
      timers.push(setTimeout(() => settle(true), 20))
    } else {
      apply(0)
      play('playVerdictWash')
      let lastTick = 0
      const leaderPct = Math.max(pA, pB)
      controls = animate(0, 1, {
        duration: (WASH_MS / 1000) * ts,
        ease: EASE_BRUSH,
        onUpdate: (p) => {
          apply(p)
          const bucket = Math.floor((leaderPct * p) / ODOMETER_TICK_EVERY_PCT)
          if (bucket > lastTick) {
            lastTick = bucket
            play('playVerdictTick')
          }
        },
        onComplete: () => settle(true),
      })
    }

    return () => {
      controls?.stop()
      timers.forEach(clearTimeout)
    }
    // Mount-only a propósito: la pieza es one-shot; replay = remount con key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ——— primer voto del duelo: sin aguadas falsas ——— */
  if (primerVoto) {
    return (
      <section className={`vv${vertical ? ' vv--vertical' : ''}`} data-vv-settled="1" aria-label="Veredicto de la comunidad">
        <div className="vv-void">
          <span className="vv-stamp vv-stamp--inline" aria-hidden="true">
            <span className="vv-stamp-glyph" lang="ja">票</span>
          </span>
          <p>
            <span className="vv-void-kicker">eres el primero en juzgar este duelo</span>
            <br />
            tu voto a {miNombre} abre el marcador
          </p>
        </div>
        <p className="vv-caption" role="status" aria-live="polite">primer voto registrado — tu voto a {miNombre}</p>
      </section>
    )
  }

  /* ——— error de red post-voto: honesto, jamás % inventados ——— */
  if (error) {
    return (
      <section className={`vv${vertical ? ' vv--vertical' : ''}`} aria-label="Veredicto de la comunidad">
        <div className="vv-void">
          <p>
            <span className="vv-void-kicker">no pudimos leer el veredicto</span>
            <br />
            tu voto quedó guardado — los % llegarán al reconectar
          </p>
          <button type="button" className="vv-retry" onClick={onRetry}>reintentar</button>
        </div>
        <p className="vv-caption" role="status" aria-live="polite">error de red al leer el resultado; tu voto está guardado</p>
      </section>
    )
  }

  const edgeAPath = vertical ? EDGE_A_V : EDGE_A_H
  const edgeBPath = vertical ? EDGE_B_V : EDGE_B_H
  const edgeViewBox = vertical ? '0 0 120 16' : '0 0 16 120'

  return (
    <section
      className={`vv${vertical ? ' vv--vertical' : ''}`}
      data-vv-settled={settled ? '1' : undefined}
      data-vv-underdog={underdog ? '1' : undefined}
      data-vv-tie={tie ? '1' : undefined}
      style={styleVars}
      aria-label="Veredicto de la comunidad"
    >
      <header className="vv-heads">
        <div
          className="vv-side vv-side--a"
          data-vv-winner={winner === 'A' ? '1' : undefined}
          data-vv-loser={winner === 'B' ? '1' : undefined}
          data-vv-breathe={winner === 'A' || tie ? '1' : undefined}
        >
          <span className="vv-name">{ladoA.nombre}</span>
          <span className="vv-pct">
            <span className="vv-pct-num" ref={numARef}>{settled ? pA : 0}</span>
            <span className="vv-pct-sym">%</span>
          </span>
        </div>
        <div
          className="vv-side vv-side--b"
          data-vv-winner={winner === 'B' ? '1' : undefined}
          data-vv-loser={winner === 'A' ? '1' : undefined}
          data-vv-breathe={winner === 'B' || tie ? '1' : undefined}
        >
          <span className="vv-name">{ladoB.nombre}</span>
          <span className="vv-pct">
            <span className="vv-pct-num" ref={numBRef}>{settled ? pB : 0}</span>
            <span className="vv-pct-sym">%</span>
          </span>
        </div>
      </header>

      <div className="vv-band" ref={bandRef}>
        <div className="vv-ink">
          <div className="vv-wash vv-wash--a" ref={washARef} data-vv-breathe={winner === 'A' || tie ? '1' : undefined}></div>
          <div className="vv-wash vv-wash--b" ref={washBRef} data-vv-breathe={winner === 'B' || tie ? '1' : undefined}></div>
          <span className="vv-edge vv-edge--a" ref={edgeARef}>
            <svg viewBox={edgeViewBox} preserveAspectRatio="none" aria-hidden="true"><path d={edgeAPath} fill="currentColor"></path></svg>
          </span>
          <span className="vv-edge vv-edge--b" ref={edgeBRef}>
            <svg viewBox={edgeViewBox} preserveAspectRatio="none" aria-hidden="true"><path d={edgeBPath} fill="currentColor"></path></svg>
          </span>
        </div>
        <span className="vv-watermark" aria-hidden="true" lang="ja">決</span>
        <span className="vv-hairline"><span className="vv-flash"></span></span>
        <span className="vv-stamp" aria-hidden="true">
          <span className="vv-stamp-glyph" lang="ja">票</span>
        </span>
      </div>

      <p className="vv-caption" role="status" aria-live="polite">{announced}</p>
    </section>
  )
}

export default VoteVerdict
