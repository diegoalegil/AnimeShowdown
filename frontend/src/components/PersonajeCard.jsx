import { useRef } from 'react'
import { Link } from 'react-router-dom'
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
  const cardRef = useRef(null)

  // Solo usamos el ELO base (estimado por popularidad). Las W/L y el win rate
  // de getStatsPersonaje son sintéticos y se ocultan para no mostrar métricas
  // de combate falsas (ver decisión "ocultar W/L sintéticos").
  const { elo } = getStatsPersonaje(slug)
  const priorityImage = Boolean(rank && rank <= 12)
  const imageLoading = priorityImage ? 'eager' : 'lazy'
  const imageFetchPriority = priorityImage ? 'high' : 'auto'
  const puedeTilt = detectHover()

  const resetTilt = () => {
    if (!cardRef.current) return
    cardRef.current.style.setProperty('--as-card-tilt-x', '0deg')
    cardRef.current.style.setProperty('--as-card-tilt-y', '0deg')
    cardRef.current.style.setProperty('--as-card-spotlight-x', '50%')
    cardRef.current.style.setProperty('--as-card-spotlight-y', '50%')
  }

  const handleMouseMove = puedeTilt
    ? (e) => {
        const node = cardRef.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        node.style.setProperty('--as-card-tilt-y', `${(x - 0.5) * 16}deg`)
        node.style.setProperty('--as-card-tilt-x', `${(0.5 - y) * 12}deg`)
        node.style.setProperty('--as-card-spotlight-x', `${x * 100}%`)
        node.style.setProperty('--as-card-spotlight-y', `${y * 100}%`)
      }
    : undefined

  const handleMouseLeave = puedeTilt ? resetTilt : undefined

  const cardStyle = {
    '--as-card-tilt-x': '0deg',
    '--as-card-tilt-y': '0deg',
    '--as-card-spotlight-x': '50%',
    '--as-card-spotlight-y': '50%',
  }

  return (
    <Link
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      className="group block"
    >
      <article
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={cardStyle}
        className="as-ssr-card relative overflow-hidden rounded-2xl transition-all motion-safe:[transform:perspective(800px)_rotateX(var(--as-card-tilt-x))_rotateY(var(--as-card-tilt-y))] motion-safe:group-hover:[transform:perspective(800px)_translateY(-0.25rem)_rotateX(var(--as-card-tilt-x))_rotateY(var(--as-card-tilt-y))] group-hover:border-gold/45 group-hover:shadow-lift [--aura-color:rgb(197_161_90_/_0.55)]"
      >
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading={imageLoading}
          fetchPriority={imageFetchPriority}
          className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(220px circle at var(--as-card-spotlight-x) var(--as-card-spotlight-y), rgba(255, 255, 255, 0.18), transparent 70%)',
          }}
        />
        <CardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} />
      </article>
    </Link>
  )
}

function CardBadges({ rank, elo, nombre, anime }) {
  return (
    <>
      {rank && rank <= 10 && (
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md border border-medal-gold/50 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-medal-gold backdrop-blur-sm"
          title="Posición en el ranking del catálogo por ELO base estimado. El ranking competitivo real se mueve con votos en /ranking."
        >
          #{rank}
        </span>
      )}
      {/* El ELO y WR de esta card son estimaciones derivadas de
          getStatsPersonaje, no métricas reales calculadas con votos.
          Tooltip + sufijo "·b"/"·e" aclaran el dato sin saturar la card. */}
      <span
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-gold backdrop-blur-sm"
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
