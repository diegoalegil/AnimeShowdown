import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

/**
 * Tarjetas decorativas flotando alrededor del hero de la home.
 *
 * Sustituyen kanjis abstractos por mini-posters reales de animes icónicos
 * de la plataforma, dando una preview visual de lo que el visitante va a
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
    labelText: 'text-gold',
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
  const reduceMotion = useReducedMotion()
  const [canFloat, setCanFloat] = useState(false)
  const rafRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    const media = window.matchMedia(
      '(min-width: 1280px) and (hover: hover) and (pointer: fine)',
    )
    const update = () => setCanFloat(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reduceMotion || !canFloat) return undefined
    const handle = (e) => {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }

      if (rafRef.current) return

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        mouseX.set(pointerRef.current.x)
        mouseY.set(pointerRef.current.y)
      })
    }
    window.addEventListener('mousemove', handle)
    return () => {
      window.removeEventListener('mousemove', handle)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [canFloat, mouseX, mouseY, reduceMotion])

  if (reduceMotion || !canFloat) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
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
        rotate: card.rotate,
      }}
      transition={{
        opacity: { duration: 1.4, delay: 0.5 + index * 0.15 },
        scale: { duration: 1.4, delay: 0.5 + index * 0.15 },
        rotate: { duration: 1.4, delay: 0.5 + index * 0.15 },
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
        className={`absolute inset-x-2 bottom-2 truncate rounded-md border px-2 py-1 text-center text-[12px] font-bold uppercase tracking-wider backdrop-blur-sm ${tone.labelBg} ${tone.labelText}`}
        style={{ textShadow: '0 1px 4px rgb(0 0 0 / 0.6)' }}
      >
        {card.title}
      </span>
    </motion.div>
  )
}

export default FloatingCards
