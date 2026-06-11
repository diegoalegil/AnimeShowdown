// OmikujiCylinder — ritual previo del omikuji: cilindro hexagonal CSS 3D
// que se agita (hold/tap/teclado), asienta, suelta la varilla y desenrolla
// el papel antes de entregar al revelado existente vía onRevealed.
//
// Secuencia:  idle → hold (agitado) → settle → drop (varilla) → unroll → onRevealed()
//
// Reglas de perf respetadas:
//  · Solo se anima transform/opacity (jitter, caída, scaleY, cross-fades).
//  · Sin blur, sin backdrop-blur, sin SVG filters; la iluminación de las
//    caras es un sombreado pre-pintado por gradientes sobre tokens.
//  · -webkit-backface-visibility en las 6 caras (gotcha Safari) y ningún
//    nodo preserve-3d lleva filter/overflow/opacity.
//  · Los bucles rAF se pausan fuera del viewport y con la pestaña oculta.
//  · prefers-reduced-motion → botón directo al revelado actual.
//  · Presupuesto tras soltar: 0.3 + 0.62 + 0.6 ≈ 1.5 s < 2.5 s. Tap = skip.
//  · Audio Web Audio sintetizado (rattle de madera) GATEADO por el mute
//    global de SoundContext; todos los timers y animaciones se limpian en
//    el unmount (lección del flake de PackOpening: cero timers fugados).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { useSound } from '../../../contexts/SoundContext'
import { EASE_LIFT } from '../../../lib/motion'

/** AGITADO (hold). Oscilador escrito a mano sobre motion values en rAF.
 *  ω = 21 rad/s (≈3.3 Hz) con wobble lento de ±2.5 rad/s para que no suene
 *  a metrónomo. La amplitud parte de 1.8° y persigue min(6°, 1.8 + 4.2·s)
 *  con un lerp de k = 8/s. Acoples: rotateX = 0.35·θ, translateX = 0.9 px/°. */
const SHAKE = { omega: 21, wobble: 2.5, ampMin: 1.8, ampMax: 6, ampRate: 4.2, ampLerp: 8 }

/** ASENTAMIENTO (al soltar). Decaimiento subamortiguado explícito:
 *  θ(t) = A₀ · e^(−9t) · sin(φ₀ + 21t) → ζ ≈ 0.4, cortado a los 300 ms.
 *  Integrado a mano (no spring de framer) para conservar la FASE del
 *  oscilador del hold — sin salto visible al soltar. */
const SETTLE = { decay: 9, omega: 21, duration: 0.3 }

/** CAÍDA DE LA VARILLA. Gravedad fingida como keyframes pre-integrados de
 *  y(t) con g = 2600 px/s², suelo en 118 px y restitución 0.35 (2 rebotes). */
const DROP = {
  y: [-96, 118, 92, 118, 112, 118],
  times: [0, 0.42, 0.6, 0.78, 0.9, 1],
  duration: 0.62,
  ease: ['easeIn', 'easeOut', 'easeIn', 'easeOut', 'easeIn'],
}

/** DESENROLLADO. scaleY 0→1 con origin-top, 600 ms, curva lift del sistema
 *  (--ease-lift = cubic-bezier(0.16, 1, 0.3, 1)). */
const UNROLL = { duration: 0.6, ease: EASE_LIFT }

// Geometría del prisma hexagonal: 6 caras de 92×210.
// Apotema = (92/2)·√3 ≈ 80 px → cara k = rotateY(k·60°) translateZ(80px).
const FACE_W = 92
const FACE_H = 210
const APOTHEM = 80
/** Sombreado por cara para fingir iluminación sin filtros. */
const FACE_SHADE = [0, 0.22, 0.46, 0.6, 0.46, 0.22]
/** Orden de PINTADO de las caras: de atrás hacia delante para la vista fija
 *  rotateY(-16°) (el agitado solo añade ±6° de rotateZ — nunca cambia qué
 *  caras miran a cámara). El WebKit de Playwright (compositor software)
 *  pinta los hermanos de un preserve-3d en orden DOM, sin ordenar por
 *  profundidad ni respetar el backface culling en el paint: con el orden
 *  natural la cara trasera (180°) pintaba ENCIMA del kanji frontal. En
 *  motores correctos (Chromium, Safari real) el z-sort manda y este orden
 *  es inocuo — cinturón y tirantes para WebKits viejos con el mismo tic. */
const FACE_PAINT_ORDER = [3, 4, 2, 5, 1, 0]

/** Madera y laca sobre tokens — cero hex (guard de CI). */
const wood = (pct) => `color-mix(in oklab, var(--color-gold) ${pct}%, var(--color-bg))`
const lacquer = (alpha) => `color-mix(in srgb, var(--color-accent) ${alpha}%, transparent)`
/** Papel washi: marfil del sistema (fg-strong), no white puro. */
const washi = (pct) => `color-mix(in srgb, var(--color-gold) ${pct}%, var(--color-fg-strong))`

const faceBackground = (shade) =>
  [
    shade > 0
      ? `linear-gradient(0deg, color-mix(in srgb, var(--color-bg) ${shade * 100}%, transparent), color-mix(in srgb, var(--color-bg) ${shade * 100}%, transparent))`
      : null,
    // aros de laca carmesí arriba y abajo
    `linear-gradient(180deg, ${lacquer(50)} 0px, ${lacquer(50)} 13px, transparent 13px, transparent calc(100% - 24px), ${lacquer(50)} calc(100% - 24px), ${lacquer(50)} 100%)`,
    // veta vertical
    'repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-bg) 55%, transparent) 0px 2px, transparent 2px 7px)',
    // madera base
    `linear-gradient(102deg, ${wood(30)} 0%, ${wood(46)} 36%, ${wood(36)} 62%, ${wood(24)} 100%)`,
  ]
    .filter(Boolean)
    .join(', ')

/** Rattle seco de madera sintetizado (sin samples). Respeta el mute global. */
function useWoodRattle(muted) {
  const ref = useRef(null)
  // El mute global puede cambiar a mitad de ritual: se lee por ref desde los
  // callbacks. La escritura va en effect (react-hooks/refs: no en render).
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])
  const ensure = useCallback(() => {
    if (mutedRef.current) return
    if (ref.current) {
      if (ref.current.ctx.state === 'suspended') ref.current.ctx.resume()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const len = Math.floor(ctx.sampleRate * 0.1)
    const noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1
    ref.current = { ctx, noise }
  }, [])
  const hit = useCallback((freq, q, vol, dur, thumpHz) => {
    const a = ref.current
    if (!a || mutedRef.current) return
    if (a.ctx.state === 'suspended') a.ctx.resume()
    const t = a.ctx.currentTime
    const src = a.ctx.createBufferSource()
    src.buffer = a.noise
    const bp = a.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = a.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(a.ctx.destination)
    src.start(t)
    src.stop(t + dur + 0.02)
    // golpe de parche: triangular grave con caída de pitch
    const o = a.ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(thumpHz, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(40, thumpHz * 0.45), t + dur * 1.4)
    const g2 = a.ctx.createGain()
    g2.gain.setValueAtTime(vol * 0.6, t)
    g2.gain.exponentialRampToValueAtTime(0.0008, t + dur * 1.4)
    o.connect(g2)
    g2.connect(a.ctx.destination)
    o.start(t)
    o.stop(t + dur * 1.4 + 0.02)
  }, [])
  // El hook gestiona su propio teardown (cierre idempotente del contexto).
  useEffect(
    () => () => {
      ref.current?.ctx.close().catch(() => {})
      ref.current = null
    },
    [],
  )
  // API memoizada: un objeto nuevo por render convertiría a quien lo tenga
  // en deps de un effect en un re-run por CADA cambio de fase — el cleanup
  // cancelaba el rAF del settle a mitad de ritual y cerraba el AudioContext
  // dos veces (el bug que congelaba la secuencia).
  return useMemo(
    () => ({
      ensure,
      rattle: (k) => hit(1500 + Math.random() * 800, 9, 0.1 + 0.16 * k, 0.055, 150 + Math.random() * 40),
      clack: (k) => hit(620 + Math.random() * 180, 7, 0.16 + 0.18 * k, 0.09, 95),
    }),
    [ensure, hit],
  )
}

/**
 * @param {object} props
 * @param {string} props.fortuna Kanji de la fortuna del día (大吉, 中吉, …).
 * @param {number} props.numero Número real de la varilla (第 N 番), derivado
 *   del mismo seed diario que la suerte.
 * @param {() => void} props.onRevealed Entrega al revelado existente.
 */
export default function OmikujiCylinder({ fortuna, numero, onRevealed }) {
  const [phase, setPhase] = useState('idle') // idle | hold | settle | drop | unroll
  const prefersReduced = useReducedMotion()
  const { muted } = useSound()
  const audio = useWoodRattle(muted)

  const rootRef = useRef(null)
  const inView = useRef(true)
  const raf = useRef(0)
  const timers = useRef([])
  const anims = useRef([])
  // Toda transición pasa por go(), que sincroniza phaseRef ANTES del
  // setState: los bucles rAF leen la fase en el siguiente frame sin esperar
  // al re-render (y sin escribir el ref durante el render — regla
  // react-hooks/refs del compilador).
  const phaseRef = useRef('idle')
  const go = useCallback((p) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  // Motion values: el jitter escribe SOLO transform, nunca layout.
  const rotZ = useMotionValue(0)
  const rotX = useMotionValue(0)
  const shakeX = useMotionValue(0)
  const stickY = useMotionValue(DROP.y[0])
  const stickRot = useMotionValue(0)
  const paperScaleY = useMotionValue(0)
  const force = useMotionValue(SHAKE.ampMin / SHAKE.ampMax)

  const hold = useRef({ t0: 0, amp: SHAKE.ampMin, theta: 0, lastDir: 0, lastT: 0, auto: 0, type: 'mouse' })

  const stop = useCallback(() => cancelAnimationFrame(raf.current), [])

  // Gates de los loops + limpieza TOTAL en unmount (rAF, timers, animate(),
  // AudioContext) — un timer fugado tras el teardown es el flake clásico.
  useEffect(() => {
    const el = rootRef.current
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            inView.current = entry.isIntersecting
          }, { threshold: 0 })
        : null
    if (el && io) io.observe(el)
    const onVis = () => {
      if (document.hidden && (phaseRef.current === 'hold' || phaseRef.current === 'settle')) {
        stop()
        go('idle')
        rotZ.set(0)
        rotX.set(0)
        shakeX.set(0)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    const pendingTimers = timers.current
    const pendingAnims = anims.current
    return () => {
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      stop()
      pendingTimers.forEach(clearTimeout)
      pendingAnims.forEach((a) => a?.stop?.())
    }
  }, [go, rotX, rotZ, shakeX, stop])

  // ── fase 3+4: caída y desenrollado ──
  const dropAndUnroll = useCallback(() => {
    go('drop')
    const drop = animate(stickY, DROP.y, {
      duration: DROP.duration,
      times: DROP.times,
      ease: DROP.ease,
      onUpdate: (v) => stickRot.set((v - 118) * -0.06), // cabeceo ∝ distancia al suelo
    })
    anims.current.push(drop)
    drop.then(() => {
      if (phaseRef.current !== 'drop') return
      audio.clack(0.3)
      go('unroll')
      const unroll = animate(paperScaleY, 1, UNROLL)
      anims.current.push(unroll)
      unroll.then(() => {
        if (phaseRef.current === 'unroll') onRevealed?.()
      })
    })
    // clacks de los rebotes, sincronizados con los keyframes 2.º y 4.º
    timers.current.push(setTimeout(() => audio.clack(0.8), DROP.times[1] * DROP.duration * 1000))
    timers.current.push(setTimeout(() => audio.clack(0.45), DROP.times[3] * DROP.duration * 1000))
  }, [audio, go, onRevealed, paperScaleY, stickRot, stickY])

  // ── fase 2: asentamiento ──
  const release = useCallback(() => {
    stop()
    const h = hold.current
    const A0 = h.amp
    const ph0 = h.theta
    const t0 = performance.now()
    go('settle')
    const loop = () => {
      if (phaseRef.current !== 'settle') return
      const t = (performance.now() - t0) / 1000
      const ang = A0 * Math.exp(-SETTLE.decay * t) * Math.sin(ph0 + SETTLE.omega * t)
      rotZ.set(ang)
      rotX.set(ang * 0.35)
      shakeX.set(ang * 0.9)
      if (t < SETTLE.duration) {
        raf.current = requestAnimationFrame(loop)
        return
      }
      rotZ.set(0)
      rotX.set(0)
      shakeX.set(0)
      dropAndUnroll()
    }
    raf.current = requestAnimationFrame(loop)
  }, [dropAndUnroll, go, rotX, rotZ, shakeX, stop])

  // ── fase 1: agitado ──
  const beginShake = useCallback(
    (pointerType) => {
      audio.ensure()
      audio.rattle(0.4)
      const h = hold.current
      h.t0 = performance.now()
      h.lastT = h.t0
      h.amp = SHAKE.ampMin
      h.theta = 0
      h.lastDir = 0
      h.auto = 0
      h.type = pointerType
      go('hold')
      const loop = () => {
        if (phaseRef.current !== 'hold' || !inView.current) return
        const now = performance.now()
        const dt = Math.min(0.05, (now - h.lastT) / 1000)
        h.lastT = now
        const heldS = (now - h.t0) / 1000
        const target = Math.min(SHAKE.ampMax, SHAKE.ampMin + heldS * SHAKE.ampRate)
        h.amp += (target - h.amp) * Math.min(1, dt * SHAKE.ampLerp)
        h.theta += (SHAKE.omega + Math.sin(now * 0.0013) * SHAKE.wobble) * dt
        const ang = h.amp * Math.sin(h.theta)
        const dir = Math.sign(Math.cos(h.theta))
        if (dir !== h.lastDir && h.lastDir !== 0) audio.rattle(h.amp / SHAKE.ampMax) // rattle por vaivén
        h.lastDir = dir
        rotZ.set(ang)
        rotX.set(ang * 0.35)
        shakeX.set(ang * 0.9)
        force.set(h.amp / SHAKE.ampMax)
        if (h.auto && now > h.auto) {
          release()
          return
        }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)
    },
    [audio, force, go, release, rotX, rotZ, shakeX],
  )

  /** Agitado autónomo (tap táctil y teclado): 900 ms y suelta solo. */
  const autoShake = useCallback(
    (type) => {
      beginShake(type)
      hold.current.auto = performance.now() + 900
    },
    [beginShake],
  )

  const skipping = phase === 'settle' || phase === 'drop' || phase === 'unroll'

  // ── entrada: hold en desktop, tap en táctil, tap = skip durante la secuencia ──
  const onPointerDown = (e) => {
    if (skipping) {
      stop()
      onRevealed?.()
      return
    }
    if (phase !== 'idle' || prefersReduced) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    beginShake(e.pointerType)
  }
  const onPointerUp = () => {
    const h = hold.current
    if (phase !== 'hold' || h.auto) return
    // tap corto en táctil → pasa a agitado autónomo (no exigimos hold fino)
    if (h.type === 'touch' && performance.now() - h.t0 < 240) {
      h.auto = performance.now() + 900
      return
    }
    release()
  }
  // Teclado: el ritual es operable sin puntero (Enter/Space agita y suelta).
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (skipping) {
      stop()
      onRevealed?.()
      return
    }
    if (phase === 'idle' && !prefersReduced) autoShake('key')
  }

  // ── reduced-motion: botón directo al revelado actual ──
  if (prefersReduced) {
    return (
      <div ref={rootRef} className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-fg-muted">El cilindro descansa. Tu fortuna te espera.</p>
        <button
          type="button"
          onClick={onRevealed}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
        >
          Revelar la fortuna
        </button>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Cilindro omikuji: mantén pulsado (o pulsa Enter) para agitarlo y recibir la varilla"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="relative mx-auto h-[620px] w-full max-w-[390px] touch-none select-none"
      style={{ cursor: phase === 'hold' ? 'grabbing' : 'grab' }}
    >
      {/* conjunto del cilindro: la perspective vive FUERA del nodo preserve-3d */}
      <div className="absolute left-1/2 top-6 w-[184px] -translate-x-1/2" style={{ perspective: 950, perspectiveOrigin: '50% 28%' }}>
        <div style={{ transform: 'rotateX(24deg) rotateY(-16deg)', transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}>
          {/* nodo de agitado: solo motion values de transform */}
          <motion.div style={{ rotateZ: rotZ, rotateX: rotX, x: shakeX, transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}>
            <div className="relative h-[210px] w-[184px]" style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}>
              {/* tapas primero (detrás): superior cerrada e inferior con la
                  boca (normal vertical → sin backface) */}
              <div
                className="absolute left-1/2 top-1/2 h-[160px] w-[184px] -ml-[92px] -mt-[80px]"
                style={{
                  transform: 'rotateX(90deg) translateZ(105px)',
                  clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                  background: `radial-gradient(circle at 50% 45%, ${wood(38)} 0%, ${wood(28)} 100%)`,
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-[160px] w-[184px] -ml-[92px] -mt-[80px]"
                style={{
                  transform: 'rotateX(-90deg) translateZ(105px)',
                  clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                  background: `radial-gradient(ellipse 34% 26% at 50% 50%, var(--color-bg) 0%, var(--color-bg) 96%, transparent 100%), radial-gradient(circle at 50% 50%, ${wood(20)} 0%, ${wood(14)} 70%, ${wood(10)} 100%)`,
                }}
              />
              {FACE_PAINT_ORDER.map((i) => (
                <div
                  key={i}
                  className="absolute left-[46px] top-0 flex flex-col items-center justify-center gap-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
                  style={{
                    width: FACE_W,
                    height: FACE_H,
                    transform: `rotateY(${i * 60}deg) translateZ(${APOTHEM}px)`,
                    background: faceBackground(FACE_SHADE[i]),
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden', // gotcha Safari: SIEMPRE en las 6 caras
                  }}
                >
                  {i === 0 && (
                    <>
                      <span lang="ja" className="text-[44px] leading-none text-gold opacity-90" style={{ fontFamily: 'var(--font-kanji-serif)' }}>御</span>
                      <span lang="ja" className="text-[22px] leading-none text-gold opacity-80" style={{ fontFamily: 'var(--font-kanji-serif)' }}>神</span>
                      <span lang="ja" className="text-[22px] leading-none text-gold opacity-80" style={{ fontFamily: 'var(--font-kanji-serif)' }}>籤</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* medidor de fuerza: barra con scaleX (nunca width), texto en mono */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[252px] flex w-[140px] -translate-x-1/2 flex-col items-center gap-1.5"
        animate={{ opacity: phase === 'hold' ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="h-0.5 w-full overflow-hidden bg-[color-mix(in_srgb,var(--color-gold)_18%,transparent)]">
          <motion.div className="h-full w-full origin-left bg-gold" style={{ scaleX: force }} />
        </div>
        <span className="font-mono text-[11px] text-[color-mix(in_srgb,var(--color-gold)_55%,var(--color-bg))]">fuerza</span>
      </motion.div>

      {/* ventana de recorte: la varilla emerge por la boca */}
      <div className="pointer-events-none absolute left-1/2 top-[268px] h-[260px] w-[140px] -translate-x-1/2 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-0 h-[92px] w-3 -ml-1.5 rounded-md"
          style={{
            y: stickY,
            rotate: stickRot,
            background: `linear-gradient(180deg, var(--color-accent) 0px, var(--color-accent) 14px, ${wood(70)} 19px, ${wood(58)} 55%, ${wood(44)} 100%)`,
            boxShadow: 'inset -3px 0 4px color-mix(in srgb, var(--color-bg) 60%, transparent)',
            opacity: phase === 'unroll' ? 0 : 1,
            transition: 'opacity 180ms ease',
          }}
        />
      </div>

      {/* pergamino: varilla horizontal + papel que se desenrolla (scaleY, origin-top) */}
      {phase === 'unroll' && (
        <div className="absolute left-1/2 top-[388px] w-44 -translate-x-1/2">
          <div
            className="h-3 rounded-md"
            style={{
              background: `linear-gradient(90deg, var(--color-accent) 0 12px, ${wood(58)} 16px, ${wood(70)} 50%, ${wood(58)} calc(100% - 16px), var(--color-accent) calc(100% - 12px))`,
            }}
          />
          <motion.div
            className="relative mx-auto mt-0.5 flex h-[212px] w-[152px] origin-top flex-col items-center rounded-sm px-2.5 pb-2.5 pt-3.5"
            style={{
              scaleY: paperScaleY,
              background: `linear-gradient(180deg, ${washi(26)} 0%, ${washi(36)} 100%)`,
            }}
          >
            <span lang="ja" className="pl-1.5 text-sm font-bold tracking-[6px] text-[color-mix(in_srgb,var(--color-gold)_70%,var(--color-bg))]" style={{ fontFamily: 'var(--font-kanji-serif)' }}>
              御神籤
            </span>
            <div className="my-2.5 h-px w-[70%] bg-[color-mix(in_srgb,var(--color-gold)_55%,var(--color-bg))] opacity-50" />
            <span lang="ja" className="text-[52px] leading-none text-accent-text" style={{ fontFamily: 'var(--font-kanji-serif)', fontWeight: 700 }}>
              {fortuna}
            </span>
            <span className="mt-auto font-mono text-[11px] text-[color-mix(in_srgb,var(--color-gold)_60%,var(--color-bg))]">第 {numero} 番</span>
          </motion.div>
        </div>
      )}
    </div>
  )
}
