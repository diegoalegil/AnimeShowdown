import { useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'

const cards = [
  { id: 'duel-left', kanji: '戦', top: '10%', left: '4%', rotate: -10, tone: 'crimson' },
  { id: 'rank-right', kanji: '冠', top: '9%', right: '5%', rotate: 8, tone: 'gold' },
  { id: 'event-left', kanji: '祭', top: '36%', left: '1%', rotate: -6, tone: 'electric' },
  { id: 'shadow-right', kanji: '影', top: '36%', right: '1%', rotate: 7, tone: 'violet' },
  { id: 'arena-left', kanji: '闘', bottom: '12%', left: '6%', rotate: 8, tone: 'gold' },
  { id: 'meta-right', kanji: '決', bottom: '12%', right: '7%', rotate: -7, tone: 'crimson' },
]

const tones = {
  crimson: {
    border: 'border-accent/40',
    text: 'text-accent',
    glow: 'rgb(159 29 44 / 0.45)',
    bg: 'from-accent/18 via-bg/35 to-bg/80',
  },
  gold: {
    border: 'border-gold/40',
    text: 'text-gold',
    glow: 'rgb(197 161 90 / 0.38)',
    bg: 'from-gold/16 via-bg/35 to-bg/80',
  },
  electric: {
    border: 'border-electric/35',
    text: 'text-electric',
    glow: 'rgb(36 198 220 / 0.34)',
    bg: 'from-electric/14 via-bg/35 to-bg/80',
  },
  violet: {
    border: 'border-violet-500/35',
    text: 'text-violet-300',
    glow: 'rgb(139 92 246 / 0.35)',
    bg: 'from-violet-500/14 via-bg/35 to-bg/80',
  },
}

function FloatingCards() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    const handle = (e) => {
      mouseX.set((e.clientX / window.innerWidth) * 2 - 1)
      mouseY.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [mouseX, mouseY])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 hidden md:block"
    >
      {cards.map((card, i) => (
        <FloatingCard
          key={card.id}
          card={card}
          index={i}
          mouseX={mouseX}
          mouseY={mouseY}
        />
      ))}
    </div>
  )
}

function FloatingCard({ card, index, mouseX, mouseY }) {
  const depth = (index % 3) + 1
  const parallaxX = useTransform(mouseX, (v) => v * 18 * depth)
  const parallaxY = useTransform(mouseY, (v) => v * 12 * depth)
  const tone = tones[card.tone] ?? tones.crimson

  return (
    <motion.div
      className={`absolute h-40 w-28 overflow-hidden rounded-2xl border bg-gradient-to-br ${tone.border} ${tone.bg} shadow-2xl backdrop-blur-sm lg:h-56 lg:w-40`}
      style={{
        top: card.top,
        left: card.left,
        right: card.right,
        bottom: card.bottom,
        x: parallaxX,
        y: parallaxY,
        boxShadow: `0 24px 64px ${tone.glow}, inset 0 1px 0 rgb(255 255 255 / 0.08)`,
      }}
      initial={{ opacity: 0, scale: 0.85, rotate: card.rotate }}
      animate={{
        opacity: 0.72,
        scale: 1,
        y: [0, -12],
        rotate: [card.rotate, card.rotate + 2.5],
      }}
      transition={{
        opacity: { duration: 1.4, delay: 0.5 + index * 0.15 },
        scale: { duration: 1.4, delay: 0.5 + index * 0.15 },
        y: {
          duration: 4 + index * 0.35,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
          delay: 1,
        },
        rotate: {
          duration: 6 + index * 0.45,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
          delay: 1,
        },
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgb(255_255_255_/_0.12),transparent_34%),linear-gradient(180deg,transparent,rgb(0_0_0_/_0.42))]" />
      <div className="absolute inset-x-3 top-3 h-px bg-white/20" />
      <div className="absolute inset-x-3 bottom-3 h-px bg-white/10" />
      <motion.span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center font-mono text-6xl font-black ${tone.text} lg:text-8xl`}
        style={{ textShadow: `0 0 44px ${tone.glow}` }}
        initial={{ opacity: 0, scale: 0.85, rotate: card.rotate }}
        animate={{
          opacity: [0.55, 0.82],
          scale: [1, 1.04],
        }}
        transition={{
          duration: 3.6 + index * 0.2,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      >
        {card.kanji}
      </motion.span>
      <motion.div
        className="absolute left-1/2 top-0 h-full w-px bg-white/15"
        animate={{ opacity: [0.12, 0.38, 0.12] }}
        transition={{
          duration: 3 + index * 0.3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-y-8 left-4 w-px bg-current opacity-40"
        animate={{ y: [-14, 14] }}
        transition={{
          duration: 4.2 + index * 0.25,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-5 right-4 h-10 w-10 rounded-full border border-current opacity-30"
        animate={{ scale: [0.85, 1.15], opacity: [0.15, 0.4] }}
        transition={{
          duration: 4.8 + index * 0.2,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ x: '-120%' }}
        animate={{ x: '120%' }}
        transition={{
          duration: 6 + index * 0.5,
          delay: 1.2 + index * 0.3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  )
}

export default FloatingCards
