import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Share2,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAnimePorSlug } from '../lib/animes'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { useSeo } from '../hooks/useSeo'
import { animeSeriesSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import PersonajeCard from '../components/PersonajeCard'
import PersonajeImg from '../components/PersonajeImg'
import Skeleton from '../components/Skeleton'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { getAnimeVisual } from '../data/visual-assets'
import NotFoundPage from './NotFoundPage'
import { shareOrCopy } from '../lib/share'
import { recordDailyShare } from '../lib/dailyProgress'
import {
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'

/**
 * Ficha de un universo anime — mini-home del anime con stats agregados,
 * personajes destacados, ranking interno y grid completo.
 */
function AnimeDetailPage() {
  const { slug } = useParams()
  const { personajes: catalogoPersonajes, isLoading } = usePersonajesCatalogo()
  const data = getAnimePorSlug(slug, catalogoPersonajes)
  const [localVotes, setLocalVotes] = useState(() => readLocalVotes())

  useEffect(
    () => listenLocalVotes((nextVotes) => setLocalVotes(nextVotes)),
    [],
  )

  const personalAnimeStats = useMemo(() => {
    if (!data) {
      return { total: 0, uniqueCharacters: 0, top: [], latest: [] }
    }
    const animeSlugs = new Set(data.personajes.map((personaje) => personaje.slug))
    const animeVotes = localVotes.filter((vote) => animeSlugs.has(vote.ganadorSlug))
    return getLocalVoteStats(animeVotes)
  }, [data, localVotes])

  useSeo(
    data
      ? {
          title: `${data.anime} · ${data.total} personajes`,
          description: `Roster, ranking ELO base interno y stats de ${data.anime} en AnimeShowdown. Top ELO base: ${data.topElo.nombre} (${data.topElo.elo}).`,
          image: `/api/og/anime/${slug}.png`,
        }
      : { title: '404 — Anime no encontrado', noindex: true },
  )

  if (!data && isLoading) {
    return (
      <VisualPageShell visual={getAnimeVisual(slug, slug)} lateralKanji={{ left: '界', right: '界' }}>
        <div className="mx-auto max-w-6xl py-16 text-center text-sm text-fg-muted">
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
          Cargando universo…
        </div>
      </VisualPageShell>
    )
  }

  if (!data) return <NotFoundPage />

  const { anime, total, topElo, eloPromedio, porElo, porPopularidad, personajes } = data
  const totalVotos = personajes.reduce((acc, p) => {
    const s = porElo.find((x) => x.slug === p.slug)
    return acc + (s ? s.wins + s.losses : 0)
  }, 0)
  // Personajes destacados: top 6 por popularidad (no por ELO) — la
  // propuesta del usuario habla de "personajes principales", que es más
  // narrativa que competición.
  const destacados = porPopularidad.slice(0, 6)
  const top10 = porElo.slice(0, 10)
  const dueloDestacado = top10.length >= 2 ? [top10[0], top10[1]] : null
  const visual = getAnimeVisual(slug, anime)
  const top5AnimeHref = top10.length > 0
    ? `/mi-top5?add=${encodeURIComponent(top10.slice(0, 5).map((p) => p.slug).join(','))}`
    : '/mi-top5'
  const compartirRankingAnime = async () => {
    const resumen = top10
      .slice(0, 5)
      .map((p, index) => `${index + 1}. ${p.nombre} · ${p.elo} ELO base`)
      .join('\n')
    try {
      const result = await shareOrCopy({
        title: `Top personajes de ${anime}`,
        text: `Mi top 5 de ${anime} en AnimeShowdown:\n${resumen}\n\n¿A quién subirías votando?`,
        url: `/animes/${slug}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Ranking compartido' : 'Ranking copiado')
    } catch (error) {
      toast.error('No se pudo compartir el ranking', {
        description: error?.message || 'Copia el enlace manualmente.',
      })
    }
  }
  const compartirTopPersonalAnime = async () => {
    const resumen = personalAnimeStats.top
      .slice(0, 5)
      .map((p, index) => `${index + 1}. ${p.nombre} x${p.count}`)
      .join('\n')
    try {
      const result = await shareOrCopy({
        title: `Mi top personal de ${anime}`,
        text: resumen
          ? `Mi top personal de ${anime} en AnimeShowdown:\n${resumen}\n\n¿A quién subirías tú?`
          : `Estoy creando mi top personal de ${anime} en AnimeShowdown. ¿A quién votarías tú?`,
        url: `/animes/${slug}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Top personal compartido' : 'Top personal copiado')
    } catch (error) {
      toast.error('No se pudo compartir tu top', {
        description: error?.message || 'Copia el enlace manualmente.',
      })
    }
  }
  const compartirDueloDestacado = async () => {
    if (!dueloDestacado) return
    const [a, b] = dueloDestacado
    try {
      const result = await shareOrCopy({
        title: `${a.nombre} vs ${b.nombre}`,
        text: [
          `Duelo destacado de ${anime}: ${a.nombre} vs ${b.nombre}.`,
          `${a.nombre} lidera por ${Math.abs(a.elo - b.elo)} puntos de ELO base.`,
          '¿A quién subirías votando?',
        ].join('\n'),
        url: `/duelos/${a.slug}-vs-${b.slug}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Duelo compartido' : 'Duelo copiado')
    } catch (error) {
      toast.error('No se pudo compartir el duelo', {
        description: error?.message || 'Copia el enlace manualmente.',
      })
    }
  }

  return (
    <VisualPageShell visual={visual} lateralKanji={{left: visual?.kanji ?? "界", right: "界"}}>
      <JsonLd
        id="anime-series"
        schema={animeSeriesSchema({ ...data, slug })}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Animes', path: '/animes' },
          { label: anime, path: `/animes/${slug}` },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <Link
          to="/animes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a animes
        </Link>

        <CinematicHero
          visual={visual}
          icon={Sparkles}
          eyebrow="Universo anime"
          title={anime}
          subtitle={`Explora el roster de ${anime}, revisa sus personajes mejor posicionados y descubre quién domina su ranking interno.`}
          actions={
            <>
            <Link
              to={`/votar?anime=${encodeURIComponent(anime)}`}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_0_34px_-14px_var(--color-accent)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              <Swords className="h-4 w-4" />
              Votar personajes de {anime}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to={`/animes/${slug}/ranking`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
            >
              <TrendingUp className="h-4 w-4" />
              Ranking de {anime}
            </Link>
            <Link
              to={top5AnimeHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/55 hover:text-gold"
            >
              <Sparkles className="h-4 w-4" />
              Crear Top 5
            </Link>
            <button
              type="button"
              onClick={compartirRankingAnime}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
            >
              <Share2 className="h-4 w-4" />
              Compartir top
            </button>
            </>
          }
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)] backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                Dossier del universo
              </p>
              <p className="mt-3 text-sm leading-7 text-fg-muted">
                Portada editorial propia: {visual.mood || 'atmósfera cinematográfica de marca'}.
              </p>
              <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
                {total}
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">
                personajes listos para competir
              </p>
            </div>
          }
        >
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Users} label="Personajes" value={total} />
            <StatTile
              icon={Trophy}
              label="Top ELO base"
              value={topElo.elo}
              hint={topElo.nombre}
              accent
            />
            <StatTile
              icon={TrendingUp}
              label="ELO base promedio"
              value={eloPromedio}
            />
            <StatTile
              icon={Swords}
              label="Combates base"
              value={totalVotos.toLocaleString('es-ES')}
            />
          </div>
        </CinematicHero>

        {dueloDestacado && (
          <FeaturedAnimeDuel
            anime={anime}
            a={dueloDestacado[0]}
            b={dueloDestacado[1]}
            onShare={compartirDueloDestacado}
          />
        )}

        <PersonalAnimeRanking
          anime={anime}
          stats={personalAnimeStats}
          personajes={personajes}
          onShare={compartirTopPersonalAnime}
        />

        {/* Personajes destacados — top 6 por popularidad */}
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              Roster principal
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              Personajes destacados
            </h2>
            <p className="text-[13px] text-fg-muted">
              Los más reconocibles del universo {anime}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {destacados.map((p) => (
              <PersonajeCard
                key={p.slug}
                slug={p.slug}
                nombre={p.nombre}
                anime={p.anime}
              />
            ))}
          </div>
        </section>

        {/* Ranking interno del anime */}
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
              Top 10 · ELO base
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              Ranking interno de {anime}
            </h2>
            <p className="text-[13px] text-fg-muted">
              Orden estimado dentro del universo {anime}. El ranking competitivo
              con votos reales vive en el ranking filtrado de este anime.
            </p>
          </div>
          <ol className="flex flex-col gap-2">
            {top10.map((p, i) => (
              <RankingRow
                key={p.slug}
                rank={i + 1}
                slug={p.slug}
                nombre={p.nombre}
                elo={p.elo}
                wins={p.wins}
                losses={p.losses}
              />
            ))}
          </ol>
        </section>

        {/* Grid completo de personajes */}
        {personajes.length > destacados.length && (
          <section>
            <div className="mb-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                Todos
              </span>
              <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
                Los {total} personajes de {anime}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {personajes.map((p) => (
                <PersonajeCard
                  key={p.slug}
                  slug={p.slug}
                  nombre={p.nombre}
                  anime={p.anime}
                />
              ))}
            </div>
          </section>
        )}

        <p className="mt-12 text-center text-[13px] text-fg-muted">
          Tu personaje favorito no sube solo.{' '}
          <Link to={`/votar?anime=${encodeURIComponent(anime)}`} className="text-gold hover:underline">
            Entra a votar
          </Link>{' '}
          y cambia el ranking de {anime}.
        </p>
      </div>
    </VisualPageShell>
  )
}

function FeaturedAnimeDuel({ anime, a, b, onShare }) {
  const diferencia = Math.abs(a.elo - b.elo)
  const lider = a.elo >= b.elo ? a : b
  return (
    <section className="mb-12 overflow-hidden rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,rgb(159_29_44_/_0.18),rgb(197_161_90_/_0.08),rgb(7_10_18_/_0.82))] p-5 shadow-[0_24px_90px_-58px_rgb(0_0_0)] sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            <Flame className="h-3.5 w-3.5" />
            Duelo destacado
          </p>
          <h2 className="mt-2 text-2xl font-black text-fg-strong">
            El choque fuerte de {anime}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            {a.nombre} y {b.nombre} son el 1 contra 2 del ranking interno. Es
            el duelo perfecto para pasar de mirar la ficha a mover el ranking.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-bg/55 px-4 py-3 text-sm text-fg-muted">
          <span className="font-bold text-gold">{lider.nombre}</span> llega con{' '}
          <span className="font-mono font-bold text-fg-strong">{diferencia}</span>{' '}
          puntos de ventaja.
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <FeaturedDuelCard personaje={a} rank={1} />
        <div className="flex items-center justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/50 bg-accent-soft font-black text-gold shadow-[0_0_38px_rgb(159_29_44_/_0.25)]">
            VS
          </span>
        </div>
        <FeaturedDuelCard personaje={b} rank={2} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to={`/duelos/${a.slug}-vs-${b.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        >
          <Swords className="h-4 w-4" />
          Comparar duelo
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(a.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="truncate">Retar a {a.nombre}</span>
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(b.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="truncate">Retar a {b.nombre}</span>
        </Link>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:text-gold"
        >
          <Share2 className="h-4 w-4" />
          Compartir duelo
        </button>
      </div>
    </section>
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
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
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

function FeaturedDuelCard({ personaje, rank }) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-white/10 bg-bg/70">
      <div className="grid gap-4 p-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:p-5">
        <Link
          to={`/personajes/${personaje.slug}`}
          className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface"
        >
          <PersonajeImg
            slug={personaje.slug}
            alt={personaje.nombre}
            className="h-full w-full object-cover object-top transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        </Link>
        <div className="min-w-0 self-center">
          <p className="font-mono text-sm font-black text-gold">#{rank}</p>
          <h3 className="mt-1 truncate text-2xl font-black text-fg-strong">
            {personaje.nombre}
          </h3>
          <p className="mt-1 text-sm text-fg-muted">{personaje.anime}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniDuelStat label="ELO" value={personaje.elo} accent />
            <MiniDuelStat label="V" value={personaje.wins} />
            <MiniDuelStat label="D" value={personaje.losses} />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniDuelStat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface/70 p-2">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm font-black ${accent ? 'text-gold' : 'text-fg-strong'}`}>
        {value}
      </p>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${accent ? 'text-yellow-400' : 'text-fg-muted'}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {label}
        </span>
      </div>
      <p
        className={`font-mono text-2xl font-extrabold tabular-nums ${accent ? 'text-gold' : 'text-fg-strong'}`}
      >
        {value}
      </p>
      {hint && (
        <p className="line-clamp-1 text-[11px] text-fg-muted">{hint}</p>
      )}
    </div>
  )
}

function RankingRow({ rank, slug, nombre, elo, wins, losses }) {
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
  const tone =
    rank === 1
      ? 'border-yellow-400/50 bg-yellow-500/5'
      : rank <= 3
        ? 'border-amber-400/40 bg-amber-500/5'
        : 'border-border bg-surface'
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className={`group flex items-center gap-4 rounded-lg border px-3 py-2.5 transition-all hover:-translate-x-1 hover:border-accent/40 sm:px-5 ${tone}`}
      >
        <span
          className={`w-8 shrink-0 font-mono text-base font-extrabold tabular-nums ${
            rank === 1
              ? 'text-yellow-300'
              : rank <= 3
                ? 'text-amber-300'
                : 'text-fg-muted'
          }`}
        >
          #{rank}
        </span>
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading="lazy"
          className="h-12 w-9 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
            {nombre}
          </p>
          {winRate != null && (
            <p className="text-[11px] text-fg-muted">
              {wins}V · {losses}D ·{' '}
              <span className="text-emerald-300/80">{winRate}% WR</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-gold">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO base
          </p>
        </div>
      </Link>
    </li>
  )
}

export default AnimeDetailPage
