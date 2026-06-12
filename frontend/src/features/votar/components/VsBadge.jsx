import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Swords } from 'lucide-react'

const TIE_SPARKS = Array.from({ length: 8 }, (_, index) => index)

/**
 * Badge VS central. Al registrarse un voto hace un slam estilo juego de
 * lucha (overshoot de escala + giro corto, arrancando ~100ms después del
 * golpe en la carta). En empate no rota: pulso simétrico + chispa de choque
 * dorada radiando desde el centro (decorativa, solo transform/opacity).
 */
const VsBadge = memo(function VsBadge({ votedFor, isTie = false, compact = false, caption = true }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      animate={
        votedFor
          ? reduceMotion
            ? { scale: 1.1 }
            : isTie
              ? { scale: [1, 1.18, 1] }
              : { scale: [1, 1.28, 1], rotate: [0, -10, 6, 0] }
          : { scale: 1 }
      }
      transition={{
        duration: votedFor ? 0.45 : 0,
        delay: votedFor && !reduceMotion ? 0.1 : 0,
        repeat: 0,
        ease: 'easeInOut',
      }}
      className={`relative flex items-center justify-center justify-self-center rounded-full border-2 border-accent bg-accent-soft text-gold shadow-aura ${
        compact ? 'h-11 w-11' : 'h-14 w-14 sm:h-20 sm:w-20'
      }`}
    >
      <Swords className={compact ? 'h-[18px] w-[18px]' : 'h-5 w-5 sm:h-7 sm:w-7'} />
      {isTie && !reduceMotion && (
        <span
          aria-hidden="true"
          data-vs-tie-spark
          className="pointer-events-none absolute inset-0"
        >
          {TIE_SPARKS.map((spark) => {
            const angle = (Math.PI * 2 * spark) / TIE_SPARKS.length
            const distance = spark % 2 === 0 ? 34 : 24
            return (
              <motion.span
                key={spark}
                className="absolute left-1/2 top-1/2 -ml-0.5 -mt-0.5 h-1 w-1 rounded-full bg-gold will-change-transform"
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  scale: [0.4, 1, 0.2],
                }}
                transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
              />
            )
          })}
        </span>
      )}
      {caption && (
        <span className={`absolute font-mono font-extrabold text-gold ${
          compact ? '-bottom-5 text-[9px]' : '-bottom-6 text-[10px]'
        }`}>
          VS
        </span>
      )}
    </motion.div>
  )
})

export default VsBadge
