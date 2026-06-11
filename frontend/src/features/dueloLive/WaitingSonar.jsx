import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Avatar from '../../components/Avatar'
import { useSound } from '../../contexts/SoundContext'

/**
 * WaitingSonar — la espera de matchmaking como sonar de combate.
 *
 * Sustituye el spinner del WaitingArena: anillos concéntricos expandiéndose
 * desde el avatar REAL del usuario a cadencia de latido (~52 bpm), cada
 * pulso sincronizado con un golpe grave de taiko sintetizado (Web Audio,
 * sin samples). El kanji 戦 de marca queda como marca de agua estática.
 *
 * Perf y reglas:
 *  - Solo transform/opacity (anillos y latido del avatar), cero filtros.
 *  - El scheduler de audio usa el reloj del AudioContext con lookahead de
 *    200 ms (anillo y golpe no derivan) y se pausa con la pestaña oculta y
 *    fuera del viewport; al volver se re-ancla sin ráfaga de golpes.
 *  - Taiko GATEADO por el mute global de SoundContext (cambia en vivo).
 *  - prefers-reduced-motion: anillo estático tenue, sin animación ni audio.
 *  - El AudioContext se cierra de forma idempotente en el unmount.
 */

const PULSE_MS = 1150
const RING_MS = 1800
const RINGS = [0, 1, 2]

/** Golpe grave de taiko sintetizado en `when` (tiempo de AudioContext). */
function taikoHit(ctx, when) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(86, when)
  o.frequency.exponentialRampToValueAtTime(46, when + 0.16)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.55, when + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.42)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(when)
  o.stop(when + 0.45)
  // slap del parche: ráfaga de ruido de 40 ms por bandpass
  const len = Math.floor(ctx.sampleRate * 0.04)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const n = ctx.createBufferSource()
  n.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 190
  bp.Q.value = 0.8
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.18, when)
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  n.connect(bp)
  bp.connect(ng)
  ng.connect(ctx.destination)
  n.start(when)
}

export default function WaitingSonar({ user }) {
  const reduced = useReducedMotion()
  const { muted } = useSound()
  const rootRef = useRef(null)
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Scheduler del taiko: lookahead sobre el reloj del AudioContext, gates
  // por visibilidad de pestaña + viewport + mute leídos por ref.
  useEffect(() => {
    if (reduced) return undefined
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return undefined
    const ctx = new AC()
    let next = ctx.currentTime + 0.05
    let visible = document.visibilityState !== 'hidden'
    let onScreen = true
    const pump = () => {
      if (!visible || !onScreen || mutedRef.current) return
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
        return
      }
      while (next < ctx.currentTime + 0.2) {
        taikoHit(ctx, next)
        next += PULSE_MS / 1000
      }
    }
    const iv = setInterval(pump, 100)
    const onVis = () => {
      visible = document.visibilityState !== 'hidden'
      if (visible) next = Math.max(next, ctx.currentTime + 0.05) // re-ancla sin ráfaga
    }
    document.addEventListener('visibilitychange', onVis)
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            onScreen = e.isIntersecting
            if (onScreen) next = Math.max(next, ctx.currentTime + 0.05)
          })
        : null
    if (rootRef.current && io) io.observe(rootRef.current)
    return () => {
      clearInterval(iv)
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      ctx.close().catch(() => {})
    }
  }, [reduced])

  return (
    <div ref={rootRef} className="relative mx-auto grid size-[240px] place-items-center" aria-hidden="true">
      {/* kanji de marca como marca de agua estática */}
      <span
        lang="ja"
        className="pointer-events-none absolute text-[10rem] font-black leading-none text-gold/5"
        style={{ fontFamily: 'var(--font-kanji-serif)' }}
      >
        戦
      </span>
      {RINGS.map((i) =>
        reduced ? (
          i === 0 && <span key={i} className="absolute size-52 rounded-full border border-electric/20" />
        ) : (
          <motion.span
            key={i}
            className="absolute size-56 rounded-full border-2 border-electric/60"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1], opacity: [0.55, 0] }}
            transition={{
              duration: RING_MS / 1000,
              delay: (i * PULSE_MS) / 1000,
              repeat: Infinity,
              repeatDelay: (RINGS.length * PULSE_MS - RING_MS) / 1000,
              ease: 'easeOut',
            }}
          />
        ),
      )}
      {/* el avatar late a la misma cadencia (solo transform) */}
      <motion.div
        animate={reduced ? undefined : { scale: [1, 1.07, 1, 1] }}
        transition={
          reduced
            ? undefined
            : { duration: PULSE_MS / 1000, times: [0, 0.06, 0.16, 1], repeat: Infinity, ease: 'easeOut' }
        }
      >
        <Avatar user={user} size={80} className="border border-gold/60" />
      </motion.div>
    </div>
  )
}
