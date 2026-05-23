import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useSound } from '../contexts/SoundContext'
import PersonajeImg from './PersonajeImg'
import { getStatsPersonaje } from '../lib/personajes-core'

// Detector singleton de hover capability. Revisión (2026-05-17): cada
// PersonajeCard creaba 2 motionValues + 2 springs + 4 transforms +
// motionTemplate + handlers de mouse, INCLUSO en móvil donde no hay
// hover y todo ese trabajo se desperdicia. Con 60 cards visibles eso
// son ~600 motion subscribers innecesarios.
let hoverCache = null
function detectHover() {
  if (hoverCache != null) return hoverCache
  if (typeof window === 'undefined' || !window.matchMedia) {
    hoverCache = false
    return false
  }
  hoverCache = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  return hoverCache
}

function PersonajeCard({ slug, nombre, anime, rank }) {
  const { play } = useSound()
  const reduceMotion = useReducedMotion()
  // Lazy initializer: detecta una sola vez al mount (sin useEffect, que
  // dispara linter react-hooks/set-state-in-effect). detectHover() ya
  // guarda contra SSR retornando false.
  const [hoverEnabled] = useState(detectHover)

  const { elo, wins, losses } = getStatsPersonaje(slug)
  const totalCombates = wins + losses
  const winRate = totalCombates > 0 ? Math.round((wins / totalCombates) * 100) : null

  if (hoverEnabled && !reduceMotion) {
    return (
      <CardWithTilt
        slug={slug}
        nombre={nombre}
        anime={anime}
        rank={rank}
        elo={elo}
        winRate={winRate}
        onClick={() => play('playWhoosh')}
      />
    )
  }
  // Móvil/touch: render plano sin motion. Mantiene aspecto y badges,
  // sin coste de framer-motion. Tap dispara sonido + nav igual.
  return (
    <Link
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      className="group block"
    >
      <article className="as-ssr-card relative overflow-hidden rounded-xl transition-all motion-safe:group-hover:-translate-y-1 group-hover:border-gold/45 group-hover:shadow-[0_24px_70px_-38px_rgba(197,161,90,0.55)]">
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover"
        />
        <CardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} winRate={winRate} />
      </article>
    </Link>
  )
}

// Versión hover-only con tilt y spotlight. Mismo coste que antes pero
// solo se monta cuando hay puntero fino (mouse) — móvil queda fuera.
function CardWithTilt({ slug, nombre, anime, rank, elo, winRate, onClick }) {
  const cardRef = useRef(null)
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
      onClick={onClick}
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
        className="as-ssr-card relative overflow-hidden rounded-xl transition-all group-hover:border-gold/50 group-hover:shadow-[0_28px_80px_-38px_rgba(197,161,90,0.58)]"
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
        <CardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} winRate={winRate} />
      </motion.article>
    </Link>
  )
}

function CardBadges({ rank, elo, nombre, anime, winRate }) {
  return (
    <>
      {rank && rank <= 10 && (
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md border border-yellow-400/50 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-yellow-300 backdrop-blur-sm"
          title="Posición en el ranking del catálogo por ELO base estimado. El ranking competitivo real se mueve con votos en /ranking."
        >
          #{rank}
        </span>
      )}
      {/* Revisión AS-010 (2026-05-23): el ELO y WR de esta card son
          estimaciones derivadas de getStatsPersonaje (determinístico por
          slug + popularidad hardcoded). No son métricas reales calculadas
          con votos. Tooltip + sufijo "·b"/"·e" hacen el dato no engañoso
          sin saturar el visual de las cards. */}
      <span
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-gold backdrop-blur-sm"
        title="ELO base estimado por popularidad. El ranking competitivo real está en /ranking."
        aria-label={`${elo} ELO base estimado`}
      >
        {elo}
        <span className="ml-0.5 text-[8px] font-bold text-gold/55">·b</span>
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3.5 pt-10">
        <h3 className="line-clamp-1 text-sm font-bold text-fg-strong">
          {nombre}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <p className="line-clamp-1 text-[12px] text-fg-muted">{anime}</p>
          {winRate != null && (
            <span
              className="shrink-0 font-mono text-[10px] font-semibold text-emerald-300/90"
              title="Win rate estimado a partir del ELO base. No es un win rate real con votos."
              aria-label={`${winRate}% win rate estimado`}
            >
              {winRate}% WR<span className="ml-0.5 text-emerald-300/55">·e</span>
            </span>
          )}
        </div>
      </div>
    </>
  )
}

export default PersonajeCard
