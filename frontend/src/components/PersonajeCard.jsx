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
import { getStatsPersonaje } from '../data/personajes'

function PersonajeCard({ slug, nombre, anime, rank }) {
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

  const { elo, wins, losses } = getStatsPersonaje(slug)
  const totalCombates = wins + losses
  const winRate = totalCombates > 0 ? Math.round((wins / totalCombates) * 100) : null

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
        className="relative overflow-hidden rounded-xl border border-border bg-surface transition-all group-hover:border-accent/60 group-hover:shadow-[0_0_30px_-10px_rgba(255,46,99,0.45)]"
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

        {/* Badge esquina superior izquierda: rank si está en top 10 */}
        {rank && rank <= 10 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md border border-yellow-400/50 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-yellow-300 backdrop-blur-sm">
            #{rank}
          </span>
        )}

        {/* Badge esquina superior derecha: ELO */}
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-accent backdrop-blur-sm">
          {elo}
        </span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3.5 pt-10">
          <h3 className="line-clamp-1 text-sm font-bold text-fg-strong">
            {nombre}
          </h3>
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-1 text-[12px] text-fg-muted">{anime}</p>
            {winRate != null && (
              <span className="shrink-0 font-mono text-[10px] font-semibold text-emerald-300/90">
                {winRate}% WR
              </span>
            )}
          </div>
        </div>
      </motion.article>
    </Link>
  )
}

export default PersonajeCard
