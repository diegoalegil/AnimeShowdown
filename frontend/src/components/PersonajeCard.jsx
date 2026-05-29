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

// Detector singleton de hover capability. Cada
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
  // El tilt (motionValues + springs + transforms de framer-motion) es caro y
  // antes se montaba en TODAS las cards a la vez (~600 suscriptores con 60+
  // cards). Lo diferimos al PRIMER hover: hasta entonces la card es plana, con
  // cero coste de motion. Al entrar el puntero, armamos el tilt y se monta solo
  // esa card. El hover lift/glow funciona vía CSS aunque el tilt no esté armado.
  const [tiltArmado, setTiltArmado] = useState(false)

  // Solo usamos el ELO base (estimado por popularidad). Las W/L y el win rate
  // de getStatsPersonaje son sintéticos y se ocultan para no mostrar métricas
  // de combate falsas (ver decisión "ocultar W/L sintéticos").
  const { elo } = getStatsPersonaje(slug)
  const priorityImage = Boolean(rank && rank <= 12)
  const imageLoading = priorityImage ? 'eager' : 'lazy'
  const imageFetchPriority = priorityImage ? 'high' : 'auto'
  const puedeTilt = hoverEnabled && !reduceMotion

  if (puedeTilt && tiltArmado) {
    return (
      <CardWithTilt
        slug={slug}
        nombre={nombre}
        anime={anime}
        rank={rank}
        elo={elo}
        imageLoading={imageLoading}
        imageFetchPriority={imageFetchPriority}
        onClick={() => play('playWhoosh')}
      />
    )
  }
  // Render plano sin motion (móvil/touch siempre; desktop hasta el primer
  // hover). Mantiene aspecto, badges y hover por CSS. Tap dispara sonido + nav.
  return (
    <Link
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      onMouseEnter={puedeTilt ? () => setTiltArmado(true) : undefined}
      className="group block"
    >
      <article className="as-ssr-card relative overflow-hidden rounded-xl transition-all motion-safe:group-hover:-translate-y-1 group-hover:border-gold/45 group-hover:shadow-lift [--aura-color:rgb(197_161_90_/_0.55)]">
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading={imageLoading}
          fetchPriority={imageFetchPriority}
          className="aspect-[2/3] w-full object-cover"
        />
        <CardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} />
      </article>
    </Link>
  )
}

// Versión hover-only con tilt y spotlight. Mismo coste que antes pero
// solo se monta cuando hay puntero fino (mouse) — móvil queda fuera.
function CardWithTilt({
  slug,
  nombre,
  anime,
  rank,
  elo,
  imageLoading,
  imageFetchPriority,
  onClick,
}) {
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
        /* Se monta al primer hover, así que NO animamos entrada (la card ya
           estaba visible como versión plana); evita un flicker al armar el tilt. */
        initial={false}
        style={{
          rotateX,
          rotateY,
          transformPerspective: 800,
        }}
        className="as-ssr-card relative overflow-hidden rounded-xl transition-all group-hover:border-gold/50 group-hover:shadow-lift [--aura-color:rgb(197_161_90_/_0.58)]"
      >
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading={imageLoading}
          fetchPriority={imageFetchPriority}
          className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlight }}
        />
        <CardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} />
      </motion.article>
    </Link>
  )
}

function CardBadges({ rank, elo, nombre, anime }) {
  return (
    <>
      {rank && rank <= 10 && (
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-lg border border-medal-gold/50 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-medal-gold backdrop-blur-sm"
          title="Posición en el ranking del catálogo por ELO base estimado. El ranking competitivo real se mueve con votos en /ranking."
        >
          #{rank}
        </span>
      )}
      {/* El ELO y WR de esta card son estimaciones derivadas de
          getStatsPersonaje, no métricas reales calculadas con votos.
          Tooltip + sufijo "·b"/"·e" aclaran el dato sin saturar la card. */}
      <span
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-gold backdrop-blur-sm"
        title="ELO base estimado por popularidad. El ranking competitivo real está en /ranking."
        aria-label={`${elo} ELO base estimado`}
      >
        {elo}
        <span className="ml-0.5 text-[8px] font-bold text-gold">·b</span>
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3.5 pt-10">
        <h3 className="line-clamp-1 text-sm font-bold text-fg-strong">
          {nombre}
        </h3>
        <p className="line-clamp-1 text-[12px] text-fg-muted">{anime}</p>
      </div>
    </>
  )
}

export default PersonajeCard
