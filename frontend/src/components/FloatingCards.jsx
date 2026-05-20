import { useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'

/**
 * Tarjetas decorativas flotando alrededor del hero de la home.
 *
 * Audit producto (2026-05-20, peticion explicita user): antes mostraban
 * UN KANJI gigante en cada card como decoracion abstracta. Eso "vendia"
 * la idea de torneo japones pero no contaba nada de lo que hay dentro.
 * Ahora cada card es un mini-poster real de un anime iconico de la
 * plataforma — luce los banners cinematicos generados por el bot
 * ChatGPT en batches 1 y 2, da preview de lo que el visitante va a
 * encontrar.
 *
 * Las 6 cards son aria-hidden y pointer-events-none — decorativas,
 * no CTA. El CTA principal sigue siendo el boton "Empieza a votar"
 * del hero central.
 */
const cards = [
  {
    id: 'demon-slayer-tl',
    slug: 'demon-slayer',
    title: 'Demon Slayer',
    top: '10%',
    left: '4%',
    rotate: -10,
    tone: 'crimson',
  },
  {
    id: 'one-piece-tr',
    slug: 'one-piece',
    title: 'One Piece',
    top: '9%',
    right: '5%',
    rotate: 8,
    tone: 'gold',
  },
  {
    id: 'jjk-ml',
    slug: 'jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    top: '36%',
    left: '1%',
    rotate: -6,
    tone: 'electric',
  },
  {
    id: 'tokyo-ghoul-mr',
    slug: 'tokyo-ghoul',
    title: 'Tokyo Ghoul',
    top: '36%',
    right: '1%',
    rotate: 7,
    tone: 'violet',
  },
  {
    id: 'mha-bl',
    slug: 'my-hero-academia',
    title: 'My Hero Academia',
    bottom: '12%',
    left: '6%',
    rotate: 8,
    tone: 'gold',
  },
  {
    id: 'aot-br',
    slug: 'attack-on-titan',
    title: 'Attack on Titan',
    bottom: '12%',
    right: '7%',
    rotate: -7,
    tone: 'crimson',
  },
]

const tones = {
  crimson: {
    border: 'border-accent/40',
    glow: 'rgb(159 29 44 / 0.45)',
    labelText: 'text-accent',
    labelBg: 'bg-accent/15 border-accent/35',
  },
  gold: {
    border: 'border-gold/40',
    glow: 'rgb(197 161 90 / 0.38)',
    labelText: 'text-gold',
    labelBg: 'bg-gold/15 border-gold/35',
  },
  electric: {
    border: 'border-electric/35',
    glow: 'rgb(36 198 220 / 0.34)',
    labelText: 'text-electric',
    labelBg: 'bg-electric/14 border-electric/30',
  },
  violet: {
    border: 'border-violet-500/35',
    glow: 'rgb(139 92 246 / 0.35)',
    labelText: 'text-violet-300',
    labelBg: 'bg-violet-500/14 border-violet-500/30',
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
  const bannerUrl = `/assets/anime-banners/${card.slug}.webp`

  return (
    <motion.div
      className={`absolute h-40 w-28 overflow-hidden rounded-2xl border ${tone.border} bg-bg shadow-2xl lg:h-56 lg:w-40`}
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
        opacity: 0.85,
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
      {/* Banner como background. object-cover + object-center recorta
          bien la composicion 16:9 al formato vertical 7:10 de las
          mini-cards. El banner es decorativo (aria-hidden en el contenedor
          padre), no necesita alt descriptivo. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${bannerUrl}")` }}
      />
      {/* Vignette inferior para legibilidad del label */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-transparent" />
      {/* Borde decorativo arriba y abajo — recuerda al estilo de
          trading-card holografico */}
      <div className="absolute inset-x-3 top-3 h-px bg-white/20" />
      <div className="absolute inset-x-3 bottom-3 h-px bg-white/10" />

      {/* Label inferior con el nombre del anime */}
      <span
        className={`absolute inset-x-2 bottom-2 truncate rounded-md border px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm lg:text-[11px] ${tone.labelBg} ${tone.labelText}`}
        style={{ textShadow: '0 1px 4px rgb(0 0 0 / 0.6)' }}
      >
        {card.title}
      </span>

      {/* Shimmer holografico que pasa cada ~6s */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent"
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
