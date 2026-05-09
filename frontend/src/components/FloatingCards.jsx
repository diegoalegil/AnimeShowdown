import { motion } from 'framer-motion'
import { imagenPersonaje } from '../data/personajes'

const cards = [
  { slug: 'naruto', top: '8%', left: '4%', rotate: -8 },
  { slug: 'mikasa', top: '5%', right: '6%', rotate: 7 },
  { slug: 'gojo', top: '40%', left: '1%', rotate: -5 },
  { slug: 'nezuko', top: '42%', right: '3%', rotate: 8 },
  { slug: 'luffy', bottom: '6%', left: '7%', rotate: 6 },
  { slug: 'zerotwo', bottom: '5%', right: '8%', rotate: -7 },
]

function FloatingCards() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 hidden md:block"
    >
      {cards.map((card, i) => (
        <motion.img
          key={card.slug}
          src={imagenPersonaje(card.slug)}
          alt=""
          className="absolute h-36 w-auto rounded-lg lg:h-48"
          style={{
            top: card.top,
            left: card.left,
            right: card.right,
            bottom: card.bottom,
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
            opacity: { duration: 1.4, delay: 0.5 + i * 0.18 },
            scale: { duration: 1.4, delay: 0.5 + i * 0.18 },
            y: {
              duration: 4 + i * 0.4,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: 1,
            },
            rotate: {
              duration: 6 + i * 0.5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: 1,
            },
          }}
        />
      ))}
    </div>
  )
}

export default FloatingCards
