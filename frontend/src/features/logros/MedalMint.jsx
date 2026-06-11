import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RARITY } from './medal-rarity'

/**
 * MedalMint — acuñación de medalla al desbloquear un logro.
 * Sustituye al canvas-confetti genérico (el último efecto "de stock").
 *
 * COREOGRAFÍA
 *   0.00 s  coin-spin de entrada: rotateY 540° → 0° decelerando, con grosor
 *           real (9 capas apiladas con translateZ formando el canto) y motion
 *           blur fingido (2 copias fantasma que se disuelven en opacity).
 *   0.95 s  GOLPE: squash con rebote, onStrike() en el frame exacto (el
 *           listener dispara ahí el sonido), barrido especular de UNA pasada
 *           y estallido de tinta sumi-e: manchas SVG pre-horneadas que
 *           escalan desde 0 con stagger y se disuelven. Solo transform y
 *           opacity; cero filters en runtime.
 *   1.45 s  toast (título + rareza) y latido idle del halo: dos capas de
 *           gradiente pre-renderizadas en cross-fade de opacity, pausadas
 *           con la pestaña oculta y fuera del viewport.
 *   3.55 s  fade de salida y onDone().
 *
 * La cara de la medalla acuña el KANJI REAL del badge (lib/badgeKanji por
 * código); no hay arte por logro en el banco, así que no se finge ninguno.
 * Variantes por rareza en ./medal-rarity (módulo hermano).
 *
 * GUARDARRAÍLES: paleta leída de tokens vía color-mix() — cero hex; el nodo
 * preserve-3d solo lleva transform; -webkit-backface-visibility en ambas
 * caras; prefers-reduced-motion → toast estático sin ceremonia.
 */

const T = {
  spin: 0.95,
  squash: 0.34,
  inkLife: 0.9,
  inkStagger: 0.055,
  wave2: 0.26,
  settle: 2.6,
  exit: 0.35,
}

const COIN = 180 // diámetro en px
const LAYERS = 9 // capas del canto
const THICK = 20 // grosor total en px

const EASE_IN_SPIN = [0.16, 0.6, 0.2, 1]
const EASE_POP = [0.2, 0.8, 0.3, 1]

/* Manchas sumi-e pre-horneadas: paths cerrados con gotas satélite.
   Se escalan desde 0 — nunca se redibujan ni se filtran en runtime. */
const INK_PATHS = [
  'M50 14c11-7 26-3 31 8 11 1 18 13 13 23 7 10 1 24-11 26-4 11-19 15-28 8-12 4-25-4-26-16-10-5-12-20-3-27-1-10 6-19 16-20l8-2zM87 13a4 6 25 1 0 .2 0zM12 64a3 4 -15 1 0 .2 0z',
  'M44 20c14-9 32-1 35 13 9 4 12 16 5 24 4 13-8 25-21 22-9 8-24 4-28-7-11-1-17-13-11-22-6-11 2-25 14-26l6-4zM90 56a5 4 0 1 0 .2 0zM26 90a3 3 0 1 0 .2 0z',
  'M52 10c9-4 21 0 25 9 12 0 21 12 16 23 8 9 3 23-9 26-2 12-17 18-27 11-12 5-26-3-26-15-11-4-14-19-5-26-2-11 7-21 18-21l8-7zM14 28a4 5 40 1 0 .2 0z',
  'M46 16c12-8 29-2 32 11 10 3 14 15 8 23 5 12-5 25-18 24-7 9-22 8-28-2-12 0-20-12-15-23-7-10-1-24 11-26l10-7zM84 86a4 4 0 1 0 .2 0zM92 30a3 5 20 1 0 .2 0z',
  'M50 18c10-6 24-2 28 8 10 2 15 13 10 22 6 10 0 23-12 24-5 10-19 12-27 4-11 2-21-7-19-18-8-6-8-18 1-24 2-9 10-16 19-16zM18 80a4 4 0 1 0 .2 0z',
  'M48 12c13-6 28 2 30 14 9 5 10 17 3 24 3 12-9 22-21 19-8 8-22 5-26-5-11 0-18-11-13-21-5-10 1-22 12-24 4-4 9-7 15-7zM78 84a5 4 -30 1 0 .2 0zM10 44a3 4 0 1 0 .2 0z',
]

const SUMI = 'color-mix(in oklab, var(--color-accent) 55%, black)'
const DEEP = 'color-mix(in oklab, var(--color-accent) 75%, black)'

/* Onda base: carmesí tonal (la 6.ª mancha solo entra a partir de "rare"). */
const BASE_BLOBS = [
  { p: 0, x: -118, y: -54, s: 96, rot: -18, fill: 'var(--color-accent)' },
  { p: 1, x: 112, y: -72, s: 80, rot: 24, fill: SUMI },
  { p: 2, x: 128, y: 46, s: 104, rot: 8, fill: 'var(--color-accent)' },
  { p: 3, x: -126, y: 60, s: 88, rot: 160, fill: DEEP },
  { p: 4, x: -10, y: -120, s: 72, rot: 80, fill: SUMI },
  { p: 5, x: 22, y: 120, s: 84, rot: -60, fill: 'var(--color-accent)' },
]

/* Épica: dos señales puntuales en cian eléctrico. */
const ELECTRIC_BLOBS = [
  { p: 1, x: -152, y: -4, s: 62, rot: 40, fill: 'var(--color-electric)', delay: 0.16 },
  { p: 4, x: 152, y: -20, s: 58, rot: -30, fill: 'var(--color-electric)', delay: 0.22 },
]

/* Legendaria: segunda onda dorada, más amplia, a +260 ms. */
const WAVE2_BLOBS = [
  { p: 2, x: -94, y: -96, s: 70, rot: 12, fill: 'var(--color-gold)' },
  { p: 0, x: 96, y: 96, s: 76, rot: -140, fill: 'var(--color-gold)' },
  { p: 3, x: 104, y: -104, s: 62, rot: 60, fill: 'var(--color-gold)' },
  { p: 5, x: -110, y: 88, s: 66, rot: -12, fill: 'var(--color-gold)' },
]

function blobsFor(rarity) {
  const R = RARITY[rarity] ?? RARITY.common
  const out = BASE_BLOBS.slice(0, R.blobs).map((b, i) => ({ ...b, delay: i * T.inkStagger }))
  if (R.electric) out.push(...ELECTRIC_BLOBS)
  if (R.wave2) out.push(...WAVE2_BLOBS.map((b, i) => ({ ...b, delay: T.wave2 + i * T.inkStagger })))
  return out
}

const CHIP = {
  common: 'var(--color-accent)',
  rare: 'var(--color-gold)',
  epic: 'var(--color-electric)',
  legendary: 'var(--color-gold)',
}

export default function MedalMint({ title, rarity = 'common', kanji = '章', onStrike, onDone }) {
  const R = RARITY[rarity] ?? RARITY.common
  const reduced = useReducedMotion()
  const [struck, setStruck] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [paused, setPaused] = useState(false)
  const rootRef = useRef(null)

  /* El latido del halo se pausa fuera del viewport y con pestaña oculta
     (callbacks de observers: setState permitido ahí). */
  useEffect(() => {
    const sync = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', sync)
    let io
    if (rootRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((e) => setPaused(document.hidden || !e[0].isIntersecting))
      io.observe(rootRef.current)
    }
    return () => {
      document.removeEventListener('visibilitychange', sync)
      io?.disconnect()
    }
  }, [])

  /* Cierre: lectura → fade → onDone. */
  useEffect(() => {
    if (!struck) return undefined
    const t1 = setTimeout(() => setLeaving(true), T.settle * 1000)
    const t2 = setTimeout(() => onDone?.(), (T.settle + T.exit) * 1000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [struck, onDone])

  /* Frame del golpe = fin del spin. El sonido lo dispara el listener aquí. */
  const handleStrike = useCallback(() => {
    setStruck(true)
    onStrike?.()
  }, [onStrike])

  if (reduced) return <ReducedToast title={title} rarity={rarity} kanji={kanji} onDone={onDone} />

  return (
    <motion.div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: T.exit }}
      role="status"
      aria-live="polite"
    >
      {/* Scrim de legibilidad SOLO bajo la zona con contenido */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 52%, color-mix(in oklab, var(--color-bg) 72%, transparent) 0%, transparent 58%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-7">
        <div className="relative" style={{ width: COIN, height: COIN }}>
          {/* Latido idle: dos capas pre-renderizadas en cross-fade de opacity */}
          {struck && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute"
              style={{ inset: -80, zIndex: 0 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              {[0, 1].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    inset: i * 26,
                    background: `radial-gradient(circle, color-mix(in oklab, var(--color-gold) ${i ? 26 : 16}%, transparent) 0%, transparent 70%)`,
                  }}
                  animate={paused ? { opacity: 0.28 } : { opacity: [0.14, 0.42, 0.14] }}
                  transition={
                    paused
                      ? { duration: 0.2 }
                      : { duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 1.3 }
                  }
                />
              ))}
            </motion.div>
          )}

          {/* Estallido de tinta sumi-e — arranca en el frame del golpe */}
          {struck &&
            blobsFor(rarity).map((b, i) => (
              <motion.svg
                key={i}
                aria-hidden
                viewBox="0 0 100 100"
                className="pointer-events-none absolute"
                style={{
                  left: `calc(50% + ${b.x}px)`,
                  top: `calc(50% + ${b.y}px)`,
                  width: b.s,
                  height: b.s,
                  x: '-50%',
                  y: '-50%',
                  rotate: b.rot,
                  zIndex: 1,
                }}
                initial={{ scale: 0, opacity: 0.95 }}
                animate={{ scale: [0, 1.14, 1.02, 1.24], opacity: [0.95, 0.9, 0.7, 0] }}
                transition={{ duration: T.inkLife, delay: b.delay, times: [0, 0.32, 0.58, 1], ease: EASE_POP }}
              >
                <path d={INK_PATHS[b.p]} fill={b.fill} />
              </motion.svg>
            ))}

          {/* Squash del golpe — envoltorio plano con la perspectiva (NO preserve-3d) */}
          <motion.div
            className="absolute inset-0"
            style={{ perspective: 900, zIndex: 2 }}
            animate={
              struck
                ? { scaleX: [1, 1.07, 0.985, 1], scaleY: [1, 0.86, 1.05, 1] }
                : { scaleX: 1, scaleY: 1 }
            }
            transition={{ duration: T.squash, times: [0, 0.3, 0.7, 1], ease: 'easeOut' }}
          >
            {/* Moneda 3D — el nodo preserve-3d SOLO lleva transform */}
            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
              initial={{ rotateY: 540, y: -46, scale: 0.6 }}
              animate={{ rotateY: 0, y: 0, scale: 1 }}
              transition={{ duration: T.spin, ease: EASE_IN_SPIN }}
              onAnimationComplete={handleStrike}
            >
              {/* Canto: 9 discos apilados con translateZ (visibles por ambos lados) */}
              {Array.from({ length: LAYERS }, (_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    transform: `translateZ(${(i / (LAYERS - 1) - 0.5) * THICK}px)`,
                    background: 'color-mix(in oklab, var(--color-gold) 42%, black)',
                  }}
                />
              ))}

              <Face front kanji={kanji} fullGoldRing={R.fullGoldRing} />
              <Face front={false} kanji={kanji} fullGoldRing={R.fullGoldRing} />

              {/* Motion blur fingido: 2 copias fantasma planas, solo opacity */}
              {[-26, 26].map((deg) => (
                <motion.div
                  key={deg}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    transform: `rotateY(${deg}deg)`,
                    background:
                      'radial-gradient(circle at 40% 34%, color-mix(in oklab, var(--color-gold) 60%, transparent) 0%, color-mix(in oklab, var(--color-gold) 18%, transparent) 70%, transparent 100%)',
                  }}
                  initial={{ opacity: 0.22 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: T.spin, ease: 'easeIn' }}
                />
              ))}
            </motion.div>

            {/* Barrido especular: gradiente recortado por el círculo, UNA pasada */}
            {struck && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <motion.div
                  className="absolute"
                  style={{
                    top: '-15%',
                    bottom: '-15%',
                    left: 0,
                    width: '46%',
                    skewX: -14,
                    background:
                      'linear-gradient(100deg, transparent 0%, color-mix(in oklab, var(--color-gold) 80%, white) 50%, transparent 100%)',
                  }}
                  initial={{ x: '-160%', opacity: 0 }}
                  animate={{ x: '170%', opacity: [0, 0.95, 0] }}
                  transition={{ duration: R.sweep, ease: 'easeOut', times: [0, 0.15, 1] }}
                />
              </div>
            )}
          </motion.div>
        </div>

        {/* Toast de la ceremonia */}
        {struck && (
          <motion.div
            className="flex flex-col items-center gap-1.5 px-4 text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.55, ease: EASE_POP }}
          >
            <p className="m-0 text-sm text-gold">Logro desbloqueado</p>
            <p className="m-0 text-xl font-semibold text-fg-strong">{title}</p>
            <p className="m-0 flex items-center gap-1.5 font-mono text-xs opacity-70">
              <span className="inline-block size-2 rounded-full" style={{ background: CHIP[rarity] }} />
              rareza · {R.label}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

/* Cara de la medalla: el kanji REAL del badge acuñado sobre carmesí.
   Ambas caras llevan backface-visibility:hidden (gotcha Safari). */
function Face({ front, kanji, fullGoldRing }) {
  const ring = fullGoldRing
    ? 'var(--color-gold)'
    : 'color-mix(in oklab, var(--color-gold) 72%, black)' // anillo envejecido (común)
  return (
    <div
      aria-hidden
      className="absolute inset-0 grid place-items-center rounded-full"
      style={{
        transform: front
          ? `translateZ(${THICK / 2 + 0.5}px)`
          : `rotateY(180deg) translateZ(${THICK / 2 + 0.5}px)`,
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        background: `radial-gradient(circle at 34% 30%, color-mix(in oklab, var(--color-gold) 88%, white) 0%, ${ring} 40%, color-mix(in oklab, var(--color-gold) 50%, black) 100%)`,
      }}
    >
      <div
        className="absolute grid place-items-center overflow-hidden rounded-full"
        style={{
          inset: 12,
          background:
            'radial-gradient(circle at 36% 30%, color-mix(in oklab, var(--color-accent) 70%, black) 0%, color-mix(in oklab, var(--color-accent) 26%, black) 78%)',
          border: '1px solid color-mix(in oklab, var(--color-gold) 55%, transparent)',
        }}
      >
        <span
          lang="ja"
          style={{
            fontFamily: 'var(--font-kanji-serif)',
            fontWeight: 900,
            fontSize: front ? 76 : 56,
            lineHeight: 1,
            color: 'var(--color-gold)',
          }}
        >
          {front ? kanji : '章'}
        </span>
      </div>
    </div>
  )
}

/* prefers-reduced-motion → toast estático con la medalla, sin ceremonia. */
function ReducedToast({ title, rarity, kanji, onDone }) {
  const R = RARITY[rarity] ?? RARITY.common
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 2800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 grid place-items-center" role="status" aria-live="polite">
      <div
        className="flex items-center gap-4 rounded-2xl border bg-surface px-5 py-4"
        style={{ borderColor: 'color-mix(in oklab, var(--color-gold) 30%, transparent)' }}
      >
        <div
          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full"
          style={{
            background:
              'radial-gradient(circle at 34% 30%, color-mix(in oklab, var(--color-gold) 88%, white) 0%, var(--color-gold) 40%, color-mix(in oklab, var(--color-gold) 50%, black) 100%)',
          }}
        >
          <span
            lang="ja"
            style={{ fontFamily: 'var(--font-kanji-serif)', fontWeight: 900, fontSize: 26, color: 'color-mix(in oklab, var(--color-accent) 45%, black)' }}
          >
            {kanji}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 text-left">
          <p className="m-0 text-xs text-gold">Logro desbloqueado</p>
          <p className="m-0 text-base font-semibold text-fg-strong">{title}</p>
          <p className="m-0 font-mono text-xs opacity-70">rareza · {R.label}</p>
        </div>
      </div>
    </div>
  )
}
