import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { getAnimePorSlug } from '../lib/animes'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { useSeo } from '../hooks/useSeo'
import { animeSeriesSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import Skeleton from '../components/Skeleton'
import { VisualPageShell } from '../components/VisualSystem'
import { getAnimeVisual } from '../data/visual-assets'
import { hexToRgbChannels } from '../lib/color'
import NotFoundPage from './NotFoundPage'
import { listenLocalVotes, readLocalVotes } from '../lib/localVoteRanking'
import AnimeHero from '../features/animeDetail/AnimeHero'
import AnimeRosterSections from '../features/animeDetail/AnimeRosterSections'
import FeaturedAnimeDuel from '../features/animeDetail/FeaturedAnimeDuel'
import PersonalAnimeRanking from '../features/animeDetail/PersonalAnimeRanking'
import AnimeHubModules from '../features/animeDetail/AnimeHubModules'
import {
  buildTop5AnimeHref,
  getAnimeTotalVotes,
  getPersonalAnimeStats,
} from '../features/animeDetail/anime-detail-utils'
import {
  shareAnimeRanking,
  shareFeaturedAnimeDuel,
  sharePersonalAnimeTop,
} from '../features/animeDetail/anime-detail-share'

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

  const personalAnimeStats = useMemo(
    () => getPersonalAnimeStats(data, localVotes),
    [data, localVotes],
  )

  useSeo(
    data
      ? {
          title: `${data.anime} · ${data.total} personajes`,
          description: `Roster, ranking ELO base interno y stats de ${data.anime} en AnimeShowdown. Top ELO base: ${data.topElo.nombre} (${data.topElo.elo}).`,
          image: `/api/og/anime/${slug}.png`,
        }
      : isLoading
        ? {
            title: 'Cargando anime',
            description: 'Cargando ficha de anime en AnimeShowdown.',
            noindex: true,
          }
        : { title: '404 — Anime no encontrado', noindex: true },
  )

  if (!data && isLoading) {
    const loadingVisual = getAnimeVisual(slug, slug)
    return (
      <VisualPageShell
        visual={loadingVisual}
        lateralKanji={{
          left: loadingVisual?.kanji ?? '界',
          right: loadingVisual?.identity?.sideKanji ?? loadingVisual?.kanji ?? '界',
        }}
      >
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
  const totalVotos = getAnimeTotalVotes(personajes, porElo)
  // Personajes destacados: top 6 por popularidad (no por ELO) — la
  // propuesta del usuario habla de "personajes principales", que es más
  // narrativa que competición.
  const destacados = porPopularidad.slice(0, 6)
  const top10 = porElo.slice(0, 10)
  const dueloDestacado = top10.length >= 2 ? [top10[0], top10[1]] : null
  const visual = getAnimeVisual(slug, anime)
  const top5AnimeHref = buildTop5AnimeHref(top10)
  const compartirRankingAnime = () => shareAnimeRanking({ anime, slug, top10 })
  const compartirTopPersonalAnime = () =>
    sharePersonalAnimeTop({ anime, slug, stats: personalAnimeStats })
  const compartirDueloDestacado = () =>
    shareFeaturedAnimeDuel({ anime, dueloDestacado })
  const lateralKanji = {
    left: visual?.kanji ?? '界',
    right: visual?.identity?.sideKanji ?? visual?.kanji ?? '界',
  }

  if (visual?.identityFallback) {
    return (
      <VisualPageShell visual={visual} lateralKanji={lateralKanji}>
        <div className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center py-16">
          <div className="rounded-2xl border border-danger/35 bg-surface/90 p-6 text-center shadow-elev-2 backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-danger/35 bg-danger/10 text-danger">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-danger">
              Identity-pack requerido
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-fg-strong">
              {anime} esta pendiente de identidad visual
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-fg-muted">
              El hub de este universo queda cerrado hasta que tenga kanji,
              emblema, motivos y slots propios. Asi evitamos publicar una ficha
              con fallback generico.
            </p>
            <Link
              to="/animes"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/60 px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a animes
            </Link>
          </div>
        </div>
      </VisualPageShell>
    )
  }

  return (
    <VisualPageShell
      visual={{
        ...visual,
        // V-1.1: tinte por universo — el fondo toma el color dominante del
        // personaje más popular del anime; fallback al accent del visual.
        accentRgb: hexToRgbChannels(porPopularidad?.[0]?.imagenColorDominante) ?? visual?.accentRgb,
      }}
      lateralKanji={lateralKanji}
    >
      <JsonLd
        id="anime-series"
        schema={animeSeriesSchema({ ...data, image: visual?.image, slug })}
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

        <AnimeHero
          anime={anime}
          eloPromedio={eloPromedio}
          onShareTop={compartirRankingAnime}
          slug={slug}
          top5AnimeHref={top5AnimeHref}
          topElo={topElo}
          total={total}
          totalVotos={totalVotos}
          visual={visual}
        />

        <AnimeRosterSections
          anime={anime}
          destacados={destacados}
          personajes={personajes}
          top10={top10}
          total={total}
        />

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

        <AnimeHubModules
          anime={anime}
          personajes={personajes}
          porElo={porElo}
          slug={slug}
          topElo={topElo}
        />
      </div>
    </VisualPageShell>
  )
}

export default AnimeDetailPage
