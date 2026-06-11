import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const SPEEDLINES = Array.from({ length: 12 }, (_, index) => index)

/**
 * Capa de impacto arcade sobre la carta votada — el "golpe conectado" de un
 * juego de lucha en tres tiempos: flash de hit-stop (t=0), onda expansiva
 * desde el punto de pulsación (t≈40ms) y speedlines radiales (t≈60ms).
 * En empate, solo un pulso dorado breve sobre ambas cartas.
 *
 * Toda la capa es decorativa (aria-hidden + pointer-events-none), anima solo
 * transform/opacity y se desmonta entera bajo prefers-reduced-motion: el
 * estado final de la carta (escala 1.05, borde, "✓ Tu voto") no depende de
 * ella. Vive < 600ms, muy por debajo de la ventana de auto-next (~900ms).
 */
const VoteImpactEffects = memo(function VoteImpactEffects({ variant = 'winner', origin = null }) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null

  if (variant === 'tie') {
    return (
      <div
        aria-hidden="true"
        data-vote-impact="tie"
        className="pointer-events-none absolute inset-0"
      >
        <motion.div
          className="absolute inset-0"
          style={{ backgroundColor: 'var(--color-gold-aura-soft)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 0.5, times: [0, 0.3, 1], ease: 'easeOut' }}
        />
      </div>
    )
  }

  const originX = origin?.x ?? 50
  const originY = origin?.y ?? 50

  return (
    <div
      aria-hidden="true"
      data-vote-impact="winner"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--aura-color)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.26, times: [0, 0.3, 1], ease: 'easeOut' }}
      />
      <span
        className="absolute -ml-12 -mt-12 h-24 w-24"
        style={{ left: `${originX}%`, top: `${originY}%` }}
      >
        <motion.span
          className="block h-full w-full rounded-full border-2 will-change-transform"
          style={{ borderColor: 'var(--aura-color)' }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.45, delay: 0.04, ease: 'easeOut' }}
        />
      </span>
      {SPEEDLINES.map((line) => (
        <motion.span
          key={line}
          className="absolute left-1/2 top-0 h-1/2 w-0.5 origin-bottom will-change-transform"
          style={{
            rotate: line * 30,
            backgroundImage:
              line % 3 === 0
                ? 'linear-gradient(to top, transparent 30%, var(--color-gold-bright))'
                : 'linear-gradient(to top, transparent 30%, var(--aura-color))',
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: [0, 1, 0], opacity: [0, 0.85, 0] }}
          transition={{
            duration: 0.38,
            delay: 0.06 + line * 0.012,
            times: [0, 0.45, 1],
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
})

export default VoteImpactEffects
