import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Swords } from 'lucide-react'

const VsBadge = memo(function VsBadge({ votedFor, compact = false }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      animate={
        votedFor
          ? reduceMotion
            ? { scale: 1.1 }
            : { scale: [1, 1.25, 1], rotate: [0, 8, -8, 0] }
          : { scale: 1 }
      }
      transition={{
        duration: votedFor ? 0.5 : 0,
        repeat: 0,
        ease: 'easeInOut',
      }}
      className={`relative flex items-center justify-center justify-self-center rounded-full border-2 border-accent bg-accent-soft text-gold shadow-[0_0_40px_-10px_rgba(159,29,44,0.7)] ${
        compact ? 'h-11 w-11' : 'h-14 w-14 sm:h-20 sm:w-20'
      }`}
    >
      <Swords className={compact ? 'h-[18px] w-[18px]' : 'h-5 w-5 sm:h-7 sm:w-7'} />
      <span className={`absolute font-mono font-extrabold uppercase tracking-[0.25em] text-gold ${
        compact ? '-bottom-5 text-[9px]' : '-bottom-6 text-[10px]'
      }`}>
        VS
      </span>
    </motion.div>
  )
})

export default VsBadge
