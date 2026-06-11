import { memo, useRef } from 'react'
import { useSound } from '../contexts/SoundContext'
import { AppLink } from './AppLink'
import PersonajeImg from './PersonajeImg'
import { getStatsPersonaje } from '../lib/personajes-core'
import { markPersonajeHero } from '../lib/viewTransitions'

function PersonajeCard({
  slug,
  nombre,
  anime,
  rank,
  elo: eloProp,
  imagen,
  imagenUrl,
  imagenColorDominante,
}) {
  const { play } = useSound()
  const cardRef = useRef(null)

  // Solo usamos el ELO base (estimado por popularidad). Las W/L y el win rate
  // de getStatsPersonaje son sintéticos y se ocultan para no mostrar métricas
  // de combate falsas (ver decisión "ocultar W/L sintéticos").
  const elo = eloProp ?? getStatsPersonaje(slug).elo
  // Eager solo para las ~2 primeras filas y fetchpriority=high solo para
  // las above-the-fold reales: 24 imágenes high simultáneas (~1MB) competían
  // con el propio LCP. El hueco de scroll rápido que motivó subir a 24 ya
  // no es blanco: el placeholder de color dominante + content-visibility
  // (fix pantallas-blancas) pintan el hueco coloreado mientras carga.
  const eagerImage = Boolean(rank && rank <= 12)
  const imageLoading = eagerImage ? 'eager' : 'lazy'
  const imageFetchPriority = rank && rank <= 6 ? 'high' : 'auto'
  const imageSrc = imagenUrl ?? imagen

  return (
    <AppLink
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      // Justo antes de capturar el estado viejo (y solo si la transición
      // arranca de verdad): esta carta es el origen del morph hacia el hero
      // del detalle (mismo aspect 2/3 y radio).
      onViewTransitionStart={() => markPersonajeHero(cardRef.current)}
      className="group block"
    >
      {/* contentVisibility: el navegador se salta layout/paint de las cartas
          fuera de viewport y reserva el alto (intrinsic 300px), así el scroll
          rápido no deja huecos blancos sin medida. La carta clickada está en
          viewport (pintada), así que la captura del morph no se ve afectada. */}
      <article
        ref={cardRef}
        className="as-ssr-card relative overflow-hidden rounded-2xl transition-[border-color,box-shadow] group-hover:border-gold/45 group-hover:shadow-lift [--aura-color:var(--color-gold-aura)]"
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 300px' }}
      >
        <PersonajeImg
          slug={slug}
          src={imageSrc}
          alt={nombre}
          colorDominante={imagenColorDominante ?? 'var(--color-surface)'}
          loading={imageLoading}
          fetchPriority={imageFetchPriority}
          className="aspect-[2/3] w-full object-cover"
        />
        <CardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} />
      </article>
    </AppLink>
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

// memo: las props son primitivas (slug/nombre/anime/rank/elo/
// imagenColorDominante), así que la comparación shallow por defecto corta el
// re-render cuando el padre (PersonajesPage) se re-renderiza por motivos
// ajenos a esta card (filtros, orden, búsqueda) — hasta 60 cards
// reconciliadas por interacción. El color dominante ya viajaba en el spread
// {...p}; antes se ignoraba (se forzaba surface), ahora se usa de fondo.
export default memo(PersonajeCard)
