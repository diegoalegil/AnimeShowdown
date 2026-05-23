import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { useMisFavoritos, useToggleFavorito } from '../hooks/useFavoritos'
import { getStatsPersonaje } from '../lib/personajes-core'
import { ocultaImgRota } from '../lib/imgFallback'

/**
 * Card "Mi roster" en /perfil.
 *
 * <p>Lista los personajes que el usuario sigue, ordenados por la fecha
 * en que los siguió (más recientes primero — el orden del backend).
 * Si el roster está vacío, empty state premium con CTA a explorar el
 * catálogo. Cada card permite quitar al personaje del roster en un
 * click (reutiliza useToggleFavorito).
 */
function CardMiRoster() {
  const { data, isLoading, isError } = useMisFavoritos()
  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
            <Heart className="h-3 w-3 fill-current" />
            Mi roster
          </span>
          <h2 className="text-xl font-bold text-fg-strong">
            Personajes que sigues
          </h2>
        </div>
        {data && data.length > 0 && (
          <span className="font-mono text-[13px] font-bold text-fg-strong tabular-nums">
            {data.length}
          </span>
        )}
      </div>
      {isLoading && <RosterSkeleton />}
      {isError && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-[13px] text-rose-200">
          No se pudo cargar tu roster. Recarga la página.
        </p>
      )}
      {!isLoading && !isError && (!data || data.length === 0) && <RosterEmpty />}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((f) => (
            <RosterCard key={f.slug} favorito={f} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RosterCard({ favorito }) {
  const { slug, nombre, anime, imagenUrl } = favorito
  const stats = getStatsPersonaje(slug)
  // Reusar el hook para que el botón X haga rollback correcto y mantenga
  // la cache consistente con el botón Heart de la ficha.
  const { toggle, isPending } = useToggleFavorito(slug)

  const onQuitar = (e) => {
    e.preventDefault()
    e.stopPropagation()
    toggle()
    toast(`Has dejado de seguir a ${nombre}`, { duration: 1800 })
  }

  return (
    <li className="group relative">
      <Link
        to={`/personajes/${slug}`}
        className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-2 transition-all hover:-translate-y-0.5 hover:border-accent/40 sm:p-2.5"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-alt">
          {imagenUrl ? (
            <img
              src={imagenUrl}
              alt={nombre}
              loading="lazy"
              onError={ocultaImgRota}
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-surface-alt" />
          )}
          <button
            type="button"
            onClick={onQuitar}
            disabled={isPending}
            aria-label={`Quitar ${nombre} del roster`}
            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg/80 text-fg-muted backdrop-blur-md transition-colors hover:text-gold disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-[12px] font-bold text-fg-strong group-hover:text-gold sm:text-[13px]">
            {nombre}
          </p>
          <p className="line-clamp-1 text-[10px] text-fg-muted sm:text-[11px]">
            {anime}
          </p>
        </div>
        {stats.elo > 0 && (
          <p className="font-mono text-[11px] font-bold text-gold">
            ELO {stats.elo}
          </p>
        )}
      </Link>
    </li>
  )
}

function RosterSkeleton() {
  return (
    <ul
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex animate-pulse flex-col gap-2 rounded-lg border border-border bg-bg p-2.5"
        >
          <div className="aspect-[2/3] rounded-md bg-surface-alt" />
          <div className="h-3 w-3/4 rounded bg-surface-alt" />
          <div className="h-2.5 w-1/2 rounded bg-surface-alt" />
        </li>
      ))}
    </ul>
  )
}

function RosterEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-bg/40 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <Heart className="h-6 w-6 text-gold" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <p className="text-[15px] font-bold text-fg-strong">
          Sigue personajes para construir tu roster
        </p>
        <p className="text-[12px] leading-relaxed text-fg-muted">
          Cuando sigas a un personaje desde su ficha, aparecerá aquí con
          su ELO. Lo usaremos pronto para destacar tus favoritos cuando
          se muevan en el ranking.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/personajes"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Explorar catálogo
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          to="/ranking"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
        >
          Ver ranking
        </Link>
      </div>
    </div>
  )
}

export default CardMiRoster
