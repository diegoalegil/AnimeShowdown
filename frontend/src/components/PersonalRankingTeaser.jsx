import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Share2, Swords, Trophy } from 'lucide-react'
import PersonajeImg from './PersonajeImg'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { imagenPersonaje } from '../lib/personajes-core'
import {
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'
import { recordDailyShare } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'

function PersonalRankingTeaser({ className = '', compact = false }) {
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const [votes, setVotes] = useState(() => readLocalVotes())

  useEffect(
    () => listenLocalVotes((nextVotes) => setVotes(nextVotes)),
    [],
  )

  const catalogBySlug = useMemo(
    () => new Map(catalogoPersonajes.map((personaje) => [personaje.slug, personaje])),
    [catalogoPersonajes],
  )
  const stats = useMemo(() => getLocalVoteStats(votes), [votes])
  const top = stats.top.slice(0, 3).map((item) => ({
    ...item,
    personaje: catalogBySlug.get(item.slug) || null,
  }))

  const compartir = async () => {
    const text = top.length
      ? [
          'Mi podio personal de AnimeShowdown:',
          ...top.map((item, index) => `${index + 1}. ${item.nombre} x${item.count}`),
          `Total local: ${stats.total} voto${stats.total === 1 ? '' : 's'}.`,
        ].join('\n')
      : 'Estoy creando mi ranking personal de personajes anime en AnimeShowdown.'
    try {
      const result = await shareOrCopy({
        title: 'Mi ranking anime',
        text,
        url: '/mi-ranking',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Ranking compartido' : 'Ranking copiado')
    } catch (error) {
      toast.error('No se pudo compartir', {
        description: error?.message || 'Copia el resultado manualmente.',
      })
    }
  }

  return (
    <section
      aria-labelledby="personal-ranking-teaser-title"
      className={`rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.12] via-surface to-accent/[0.08] p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
            <Trophy className="h-3.5 w-3.5" />
            Tu ranking personal
          </p>
          <h2 id="personal-ranking-teaser-title" className="mt-1 text-2xl font-black tracking-tight text-fg-strong">
            {top.length > 0 ? 'Tu podio local ya tiene forma' : 'Crea tu propio meta'}
          </h2>
          {!compact && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Mientras el ranking global enseña a la comunidad, tu ranking local
              enseña a quién estás defendiendo tú. Es privado, rápido y compartible.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/mi-ranking"
            className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
          >
            Ver mi ranking
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={compartir}
            className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
          >
            <Share2 className="h-4 w-4" />
            Compartir
          </button>
        </div>
      </div>

      {top.length > 0 ? (
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {top.map((item, index) => (
            <PersonalRankingItem key={item.slug} item={item} rank={index + 1} />
          ))}
        </ol>
      ) : (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-border bg-bg/35 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-fg-muted">
            Vota unos cuantos duelos y aquí aparecerá tu top 3 personal.
          </p>
          <Link
            to="/votar"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent-soft px-4 py-2 text-sm font-black text-gold transition-colors hover:bg-accent/20"
          >
            <Swords className="h-4 w-4" />
            Empezar a votar
          </Link>
        </div>
      )}
    </section>
  )
}

function PersonalRankingItem({ item, rank }) {
  const personaje = item.personaje
  const imgSrc = personaje?.imagenUrl ?? personaje?.imagen ?? imagenPersonaje(item.slug)
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-bg/45 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold-soft font-mono text-[12px] font-black text-gold">
        #{rank}
      </span>
      <Link
        to={`/personajes/${item.slug}`}
        className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-bg"
      >
        <PersonajeImg
          slug={item.slug}
          src={imgSrc}
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
          {item.anime || personaje?.anime}
        </p>
      </div>
      <span className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[12px] font-black text-fg-strong">
        x{item.count}
      </span>
    </li>
  )
}

export default PersonalRankingTeaser
