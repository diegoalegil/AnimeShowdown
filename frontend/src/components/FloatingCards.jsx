import { useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { imagenPersonaje } from '../data/personajes'
import { ocultaImgRota } from '../lib/imgFallback'

const cards = [
  { slug: 'momo_ayase', top: '5%', left: '3%', rotate: -8 },
  { slug: 'mai_sakurajima', top: '5%', right: '4%', rotate: 7 },
  { slug: 'miku', top: '28%', left: '0%', rotate: -5 },
  { slug: 'shinobu', top: '28%', right: '1%', rotate: 6 },
  { slug: 'makima', top: '56%', left: '1%', rotate: -7 },
  { slug: 'satoru_gojo', top: '56%', right: '2%', rotate: 5 },
  { slug: 'kuroneko', bottom: '5%', left: '6%', rotate: 7 },
  { slug: 'toru_hagakure', bottom: '5%', right: '7%', rotate: -6 },
]

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
          key={card.slug}
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

  return (
    <motion.div
      className="absolute"
      style={{
        top: card.top,
        left: card.left,
        right: card.right,
        bottom: card.bottom,
        x: parallaxX,
        y: parallaxY,
      }}
    >
      <motion.img
        src={imagenPersonaje(card.slug)}
        alt=""
        onError={ocultaImgRota}
        className="h-32 w-auto rounded-lg lg:h-44"
        style={{
          filter: 'drop-shadow(0 18px 36px rgb(255 46 99 / 0.25))',
        }}
        initial={{ opacity: 0, scale: 0.85, rotate: card.rotate }}
        animate={{
          opacity: 0.7,
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
      />
    </motion.div>
  )
}

export default FloatingCards
