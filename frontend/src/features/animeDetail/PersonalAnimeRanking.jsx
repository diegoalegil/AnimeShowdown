import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Share2, Sparkles, Swords } from 'lucide-react'
import PersonajeImg from '../../components/PersonajeImg'

function PersonalAnimeRankingItem({ item, rank, personaje }) {
  const imgSlug = personaje?.slug || item.slug
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-bg/45 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold-soft font-mono text-[12px] font-black text-gold">
        #{rank}
      </span>
      <Link
        to={`/personajes/${item.slug}`}
        className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface"
      >
        <PersonajeImg
          slug={imgSlug}
          alt={item.nombre}
          className="h-full w-full object-cover object-top"
          loading={rank === 1 ? 'eager' : 'lazy'}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/personajes/${item.slug}`}
          className="line-clamp-1 text-sm font-black text-fg-strong hover:text-gold"
        >
          {item.nombre}
        </Link>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {personaje?.anime || item.anime}
        </p>
      </div>
      <span className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[12px] font-black text-fg-strong">
        x{item.count}
      </span>
    </li>
  )
}

function PersonalAnimeRanking({ anime, stats, personajes, onShare }) {
  const top = stats.top.slice(0, 3)
  const top5Href = stats.top.length > 0
    ? `/mi-top5?add=${encodeURIComponent(stats.top.slice(0, 5).map((item) => item.slug).join(','))}`
    : '/mi-top5'
  const personajeBySlug = useMemo(
    () => new Map(personajes.map((personaje) => [personaje.slug, personaje])),
    [personajes],
  )

  return (
    <section className="mb-12 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.12] via-surface to-accent/[0.08] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
            <Flame className="h-3.5 w-3.5" />
            Tu top personal
          </p>
          <h2 className="mt-1 text-2xl font-black text-fg-strong">
            {top.length > 0
              ? `Tu meta de ${anime}`
              : `Empieza tu top de ${anime}`}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            {top.length > 0
              ? `Has metido ${stats.total} voto${stats.total === 1 ? '' : 's'} en personajes de ${anime}. Este bloque convierte la ficha del anime en tu mini-ranking personal.`
              : `Todavía no tienes votos locales para personajes de ${anime}. Vota duelos de este universo y aquí aparecerá tu podio personal.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/votar?anime=${encodeURIComponent(anime)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-4 py-2 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            Votar este anime
          </Link>
          <Link
            to="/mi-ranking"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/45 px-4 py-2 text-sm font-bold text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
          >
            Ver mi ranking
          </Link>
          {top.length > 0 && (
            <Link
              to={top5Href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-sm font-bold text-fg-strong transition-colors hover:border-gold/55 hover:text-gold"
            >
              <Sparkles className="h-4 w-4" />
              Crear Top 5
            </Link>
          )}
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
          >
            <Share2 className="h-4 w-4" />
            Compartir
          </button>
        </div>
      </div>

      {top.length > 0 ? (
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {top.map((item, index) => (
            <PersonalAnimeRankingItem
              key={item.slug}
              item={item}
              rank={index + 1}
              personaje={personajeBySlug.get(item.slug)}
            />
          ))}
        </ol>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-bg/35 p-4 text-sm leading-6 text-fg-muted">
          Vota un duelo con personajes de {anime} para desbloquear este podio
          personal. No requiere login y se guarda en este navegador.
        </div>
      )}
    </section>
  )
}

export default PersonalAnimeRanking
