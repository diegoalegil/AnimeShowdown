import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const PARTICLES = Array.from({ length: 10 }, (_, index) => index)

function AnimatedNumber({ value, delta, animate = true }) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (!Number.isFinite(value)) return undefined
    if (!animate || reduceMotion || !Number.isFinite(delta)) return undefined
    const from = value - delta
    const start = performance.now()
    const duration = 520
    let raf = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, delta, reduceMotion, animate])

  if (!Number.isFinite(value)) return null
  const shown = !animate || reduceMotion || !Number.isFinite(delta) ? value : display
  return <span className="tabular-nums">{shown}</span>
}

function VoteFeedbackBurst({
  active,
  delta,
  value,
  label = 'Voto registrado',
  animateValue = true,
  particles = true,
}) {
  const reduceMotion = useReducedMotion()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.92 }}
        animate={{ opacity: [0, 1, 1, 0], scale: reduceMotion ? 1 : [0.92, 1.08, 1.02, 1] }}
        transition={{ duration: reduceMotion ? 0.22 : 0.58, times: [0, 0.18, 0.72, 1] }}
        className="rounded-full border border-gold/70 bg-black/75 px-4 py-2 text-center font-mono text-sm font-black text-gold shadow-[0_0_44px_-10px_rgba(245,197,92,0.9)] backdrop-blur"
      >
        <span className="block text-[10px] uppercase tracking-[0.18em] text-gold/80">
          {label}
        </span>
        <span className="text-lg">
          {Number.isFinite(delta) && delta >= 0 ? '+' : ''}
          {Number.isFinite(delta) ? delta : ''}
          {Number.isFinite(value) && (
            <>
              {' · '}
              <AnimatedNumber value={value} delta={delta} animate={animateValue} />
            </>
          )}
        </span>
      </motion.div>
      {particles && !reduceMotion && PARTICLES.map((particle) => {
        const angle = (Math.PI * 2 * particle) / PARTICLES.length
        const distance = particle % 2 === 0 ? 54 : 38
        return (
          <motion.span
            key={particle}
            className="absolute h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_rgba(245,197,92,0.9)]"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              scale: [0.4, 1, 0.2],
            }}
            transition={{ duration: 0.58, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

export default VoteFeedbackBurst
