import { Link } from 'react-router-dom'
import { useSound } from '../contexts/SoundContext'
import PersonajeImg from './PersonajeImg'
import { getStatsPersonaje } from '../lib/personajes-core'

function PersonajeCard({ slug, nombre, anime, rank }) {
  const { play } = useSound()

  // Solo usamos el ELO base (estimado por popularidad). Las W/L y el win rate
  // de getStatsPersonaje son sintéticos y se ocultan para no mostrar métricas
  // de combate falsas (ver decisión "ocultar W/L sintéticos").
  const { elo } = getStatsPersonaje(slug)
  const priorityImage = Boolean(rank && rank <= 12)
  const imageLoading = priorityImage ? 'eager' : 'lazy'
  const imageFetchPriority = priorityImage ? 'high' : 'auto'

  return (
    <Link
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      className="group block"
    >
      <article
        className="as-ssr-card relative overflow-hidden rounded-2xl transition-[border-color,box-shadow] group-hover:border-gold/45 group-hover:shadow-lift [--aura-color:rgb(197_161_90_/_0.55)]"
      >
        <PersonajeImg
          slug={slug}
          alt={nombre}
          colorDominante="var(--color-surface)"
          loading={imageLoading}
          fetchPriority={imageFetchPriority}
          className="aspect-[2/3] w-full object-cover"
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
