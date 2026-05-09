import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { imagenPersonaje } from '../data/personajes'

function PersonajeCard({ slug, nombre, anime }) {
  const cardRef = useRef(null)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const springX = useSpring(mouseX, { stiffness: 250, damping: 25 })
  const springY = useSpring(mouseY, { stiffness: 250, damping: 25 })

  const rotateY = useTransform(springX, [0, 1], [-8, 8])
  const rotateX = useTransform(springY, [0, 1], [6, -6])

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
    <Link to={`/personajes/${slug}`} className="group block">
      <motion.article
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformPerspective: 800,
        }}
        className="relative overflow-hidden rounded-xl border border-border bg-surface transition-colors group-hover:border-accent/40"
      >
        <img
          src={imagenPersonaje(slug)}
          alt={nombre}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
