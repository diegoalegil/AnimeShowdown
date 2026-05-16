import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useSound } from '../contexts/SoundContext'
import PersonajeImg from './PersonajeImg'

function PersonajeCard({ slug, nombre, anime }) {
  const cardRef = useRef(null)
  const { play } = useSound()
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const springX = useSpring(mouseX, { stiffness: 250, damping: 25 })
  const springY = useSpring(mouseY, { stiffness: 250, damping: 25 })

  const rotateY = useTransform(springX, [0, 1], [-8, 8])
  const rotateX = useTransform(springY, [0, 1], [6, -6])

  const spotlightX = useTransform(mouseX, (v) => `${v * 100}%`)
  const spotlightY = useTransform(mouseY, (v) => `${v * 100}%`)
  const spotlight = useMotionTemplate`radial-gradient(220px circle at ${spotlightX} ${spotlightY}, rgba(255, 255, 255, 0.18), transparent 70%)`

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  const handleMouseLeave = () => {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

  return (
    <Link
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      className="group block"
    >
      <motion.article
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          rotateX,
          rotateY,
          transformPerspective: 800,
        }}
        className="relative overflow-hidden rounded-xl border border-border bg-surface transition-colors group-hover:border-accent/40"
      >
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlight }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3.5 pt-10">
          <h3 className="text-sm font-bold text-fg-strong">{nombre}</h3>
          <p className="text-[12px] text-fg-muted">{anime}</p>
        </div>
      </motion.article>
    </Link>
  )
}

export default PersonajeCard
