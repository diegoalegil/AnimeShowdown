import { motion } from 'framer-motion'
import { imagenPersonaje } from '../data/personajes'

const cards = [
  { slug: 'momo', top: '5%', left: '3%', rotate: -8 },
  { slug: 'mai_sakurajima', top: '5%', right: '4%', rotate: 7 },
  { slug: 'miku', top: '28%', left: '0%', rotate: -5 },
  { slug: 'shinobu', top: '28%', right: '1%', rotate: 6 },
  { slug: 'makima', top: '56%', left: '1%', rotate: -7 },
  { slug: 'gojo', top: '56%', right: '2%', rotate: 5 },
  { slug: 'kuroneko', bottom: '5%', left: '6%', rotate: 7 },
  { slug: 'toru_hagakure', bottom: '5%', right: '7%', rotate: -6 },
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
          className="absolute h-32 w-auto rounded-lg lg:h-44"
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
            opacity: { duration: 1.4, delay: 0.5 + i * 0.15 },
            scale: { duration: 1.4, delay: 0.5 + i * 0.15 },
            y: {
              duration: 4 + i * 0.35,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: 1,
            },
            rotate: {
              duration: 6 + i * 0.45,
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
