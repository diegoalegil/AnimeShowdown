/**
 * VersusIntro.jsx — intro cinemática del duelo (la pantalla de duelo como
 * un fighting game). Se monta sobre la página de versus al entrar, juega 1,4 s
 * y se retira sola.
 *
 * Stack: React 19 · Tailwind v4 (tokens del proyecto, cero literales de color)
 *        framer-motion 12 · sin WebGL · solo transform/opacity (60 fps).
 *
 * ── Timeline (s) ─────────────────────────────────────────────────────
 *  1 · entrada de cartas   0.00–0.52  rotateY ±25°→0 · scale 1.15→1 (crash)
 *      estela (blur fingido)          misma curva con lag 45 ms, opacity→0
 *  2 · frame de impacto    ~0.52      flash · shake 6 px · onda · speedlines
 *  3 · kanji 決 (decisión) 0.56–0.94  sello scale 1.6→1 + sangrado de tinta
 *  4 · badge VS            0.62–~1.0  caída con peso (spring duro)
 *  5 · name plates         1.00–1.36  fade + rise 12 px
 *  total                   1.40       → onComplete()
 *
 *  prefers-reduced-motion: crossfade único de 200 ms sobre la escena asentada.
 *  skip (tap):             salta a la escena asentada y dispara onSkip + onComplete.
 * ─────────────────────────────────────────────────────────────────────
 *
 * fighter = { slug, name, series, kanji }
 */

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import PersonajeImg from '../../components/PersonajeImg'

/* ── timeline (s) ── */
const T = {
  cardsIn: { delay: 0, dur: 0.52 },
  trailLag: 0.045,
  flash: { delay: 0.5, dur: 0.13 }, // pico al 30% ≈ 40 ms
  shake: { delay: 0.52, dur: 0.14 },
  shock: { delay: 0.52, dur: 0.32 },
  speed: { delay: 0.5, dur: 0.26 },
  kanji: { delay: 0.56, dur: 0.38 },
  badge: { delay: 0.62 },
  plates: { delay: 1.0, dur: 0.3 },
  total: 1.4,
}

/* curvas */
const EASE_CRASH = [0.55, 0.06, 0.68, 0.19] // ease-in: llega al centro a tope de velocidad
const EASE_STAMP = [0.2, 0.9, 0.25, 1]
const EASE_SHOCK = [0.17, 0.84, 0.44, 1]
const SPRING_BADGE = { type: 'spring', stiffness: 900, damping: 32, mass: 1.1 }

/* ── piezas ── */

function CardShell({ fighter }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gold/40 bg-surface shadow-[var(--shadow-elev-2)]">
      <PersonajeImg
        slug={fighter.slug}
        alt={fighter.name}
        className="h-full w-full object-cover"
        sizes="(max-width: 768px) 40vw, 240px"
        loading="eager"
        decoding="async"
        draggable={false}
      />
      <span
        className="absolute left-2 top-1.5 text-lg font-bold leading-none text-gold/50"
        style={{ fontFamily: 'var(--font-kanji-serif)' }}
        aria-hidden="true"
      >
        {fighter.kanji}
      </span>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-accent" />
    </div>
  )
}

function FighterCard({ anim, side, fighter }) {
  const L = side === 'left'
  const hidden = {
    x: L ? '-200%' : '200%',
    y: L ? '-58%' : '58%',
    rotateY: L ? 25 : -25,
    rotate: 0,
    scale: 1.15,
  }
  const settled = { x: '0%', y: '0%', rotateY: 0, rotate: L ? -2.5 : 2.5, scale: 1 }
  const tr = anim
    ? { delay: T.cardsIn.delay, duration: T.cardsIn.dur, ease: EASE_CRASH }
    : { duration: 0 }

  return (
    <div
      className="absolute left-1/2 top-[14%] z-10 aspect-[2/3] h-[64%]"
      style={{ transform: L ? 'translateX(-104%)' : 'translateX(4%)' }}
    >
      {/* estela duplicada al 30% — motion blur fingido */}
      <motion.div
        className="absolute inset-0 rounded-lg border border-accent/50 bg-accent/25"
        style={{ transformPerspective: 1100 }}
        initial={anim ? { ...hidden, opacity: 0.3 } : false}
        animate={{ ...settled, opacity: 0 }}
        transition={
          anim
            ? {
                ...tr,
                delay: T.trailLag,
                opacity: { delay: 0.47, duration: 0.18, ease: 'linear' },
              }
            : { duration: 0 }
        }
        aria-hidden="true"
      />
      <motion.div
        className="relative h-full w-full"
        style={{ transformPerspective: 1100 }}
        initial={anim ? hidden : false}
        animate={settled}
        transition={tr}
      >
        <CardShell fighter={fighter} />
      </motion.div>
    </div>
  )
}

function KanjiStamp({ anim }) {
  const face = {
    fontFamily: 'var(--font-kanji-serif)',
    fontSize: 'clamp(160px, 34vw, 300px)',
  }
  return (
    <div className="absolute left-1/2 top-[48%] z-0 -translate-x-1/2 -translate-y-1/2">
      {/* sangrado de tinta */}
      <motion.span
        className="absolute inset-0 grid place-items-center font-black leading-none text-accent-text"
        style={face}
        initial={anim ? { scale: 1.35, opacity: 0 } : false}
        animate={{ scale: 1.07, opacity: 0.14 }}
        transition={anim ? { delay: T.kanji.delay, duration: 0.42, ease: EASE_STAMP } : { duration: 0 }}
        aria-hidden="true"
      >
        決
      </motion.span>
      <motion.span
        className="block font-black leading-none text-accent-text"
        style={face}
        initial={anim ? { scale: 1.6, opacity: 0, rotate: 3 } : false}
        animate={{ scale: 1, opacity: 0.5, rotate: -1.5 }}
        transition={anim ? { delay: T.kanji.delay, duration: T.kanji.dur, ease: EASE_STAMP } : { duration: 0 }}
        aria-hidden="true"
      >
        決
      </motion.span>
    </div>
  )
}

function BadgeVS() {
  const crest = 'polygon(50% 0%, 100% 28%, 84% 100%, 16% 100%, 0% 28%)'
  return (
    <div className="grid h-[88px] w-[88px] place-items-center bg-gold" style={{ clipPath: crest }}>
      <div className="grid h-[80px] w-[80px] place-items-center bg-accent" style={{ clipPath: crest }}>
        <span
          className="text-[34px] font-black italic leading-none text-gold"
          style={{ transform: 'skewX(-6deg)' }}
        >
          VS
        </span>
      </div>
    </div>
  )
}

function BadgeDrop({ anim }) {
  return (
    <div className="absolute left-1/2 top-[46%] z-30 -translate-x-1/2 -translate-y-1/2">
      <motion.div
        initial={anim ? { y: -180, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={
          anim
            ? {
                y: { ...SPRING_BADGE, delay: T.badge.delay },
                opacity: { delay: T.badge.delay, duration: 0.08 },
              }
            : { duration: 0 }
        }
      >
        <BadgeVS />
      </motion.div>
    </div>
  )
}

function Shockwave() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2">
      <motion.div
        className="relative h-28 w-28 rounded-full border-2 border-gold/90"
        initial={{ scale: 0.15, opacity: 0.9 }}
        animate={{ scale: 3.4, opacity: 0 }}
        transition={{ delay: T.shock.delay, duration: T.shock.dur, ease: EASE_SHOCK }}
      >
        {/* señal puntual en cian eléctrico */}
        <div className="absolute inset-2 rounded-full border border-electric/70" />
      </motion.div>
    </div>
  )
}

function Speedlines() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        backgroundImage:
          'repeating-conic-gradient(from 0deg, transparent 0deg 5deg, color-mix(in srgb, white 16%, transparent) 5deg 6deg)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 46%, transparent 22%, black 60%)',
        maskImage: 'radial-gradient(circle at 50% 46%, transparent 22%, black 60%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.5, 0.4, 0] }}
      transition={{ delay: T.speed.delay, duration: T.speed.dur, times: [0, 0.15, 0.7, 1], ease: 'linear' }}
      aria-hidden="true"
    />
  )
}

function Flash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-40 bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.95, 0] }}
      transition={{ delay: T.flash.delay, duration: T.flash.dur, times: [0, 0.3, 1], ease: 'linear' }}
      aria-hidden="true"
    />
  )
}

function Shake({ anim, children }) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ perspective: 1100 }}
      animate={anim ? { x: [0, -6, 5, -3, 2, 0], y: [0, 3, -4, 2, -1, 0] } : { x: 0, y: 0 }}
      transition={anim ? { delay: T.shake.delay, duration: T.shake.dur, ease: 'linear' } : { duration: 0 }}
    >
      {children}
    </motion.div>
  )
}

function NamePlate({ anim, side, fighter }) {
  const L = side === 'left'
  return (
    <motion.div
      className={`absolute bottom-0 z-30 min-w-[38%] px-4 pb-3 pt-8 ${
        L
          ? 'left-0 bg-gradient-to-r from-bg/90 to-transparent text-left'
          : 'right-0 bg-gradient-to-l from-bg/90 to-transparent text-right'
      }`}
      initial={anim ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        anim
          ? { delay: T.plates.delay + (L ? 0 : 0.06), duration: T.plates.dur, ease: 'easeOut' }
          : { duration: 0 }
      }
    >
      <div className="text-lg font-extrabold leading-tight md:text-xl">{fighter.name}</div>
      <div className="font-mono text-[11px] text-gold">
        <span style={{ fontFamily: 'var(--font-jp)' }}>{fighter.kanji}</span> · {fighter.series}
      </div>
    </motion.div>
  )
}

/* ── escena (anim=true: intro · anim=false: pose asentada para skip/reduced) ── */
function Scene({ anim, left, right }) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, transparent 40%, color-mix(in srgb, black 55%, transparent) 100%)',
        }}
      />
      {anim ? <Speedlines /> : null}
      <Shake anim={anim}>
        <KanjiStamp anim={anim} />
        <FighterCard anim={anim} side="left" fighter={left} />
        <FighterCard anim={anim} side="right" fighter={right} />
        {anim ? <Shockwave /> : null}
        <BadgeDrop anim={anim} />
      </Shake>
      {anim ? <Flash /> : null}
      <NamePlate anim={anim} side="left" fighter={left} />
      <NamePlate anim={anim} side="right" fighter={right} />
    </>
  )
}

/* ── componente principal ── */
export default function VersusIntro({
  left,
  right,
  skippable = true,
  onSkip,
  onComplete,
  className = '',
}) {
  const reduce = useReducedMotion()
  const [skipped, setSkipped] = React.useState(false)
  const doneRef = React.useRef(false)

  const finish = React.useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    if (onComplete) onComplete()
  }, [onComplete])

  React.useEffect(() => {
    if (reduce || skipped) return undefined
    const t = setTimeout(finish, T.total * 1000)
    return () => clearTimeout(t)
  }, [reduce, skipped, finish])

  const handleSkip = () => {
    if (!skippable || skipped) return
    setSkipped(true)
    if (onSkip) onSkip()
    finish()
  }

  const rootCls = `relative isolate aspect-video w-full min-h-[220px] select-none overflow-hidden rounded-xl bg-bg text-white ${
    skippable ? 'cursor-pointer' : ''
  } ${className}`

  /* reduced-motion: crossfade simple de 200 ms sobre la escena final */
  if (reduce) {
    return (
      <motion.div
        className={rootCls}
        onPointerDown={handleSkip}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onAnimationComplete={finish}
        aria-label="Duelo a punto de empezar"
      >
        <Scene anim={false} left={left} right={right} />
      </motion.div>
    )
  }

  return (
    <div
      className={rootCls}
      onPointerDown={handleSkip}
      role={skippable ? 'button' : undefined}
      tabIndex={skippable ? 0 : undefined}
      onKeyDown={
        skippable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSkip()
              }
            }
          : undefined
      }
      aria-label={skippable ? 'Intro del duelo — toca para saltar' : 'Intro del duelo'}
    >
      <Scene anim={!skipped} left={left} right={right} />
    </div>
  )
}
