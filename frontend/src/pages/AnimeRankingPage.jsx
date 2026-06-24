import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  HelpCircle,
  Medal,
  Share2,
  Swords,
  Trophy,
  Vote,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAnimePorSlug } from '../lib/animes'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import {
  useRankingDeltaSubscription,
  useRankingSegmentado,
} from '../hooks/useRanking'
import { useSeo } from '../hooks/useSeo'
import {
  breadcrumbsSchema,
  faqPageSchema,
  rankingItemListSchema,
} from '../lib/schema'
import JsonLd from '../components/JsonLd'
import PersonajeImg from '../components/PersonajeImg'
import EmptyState from '../components/EmptyState'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { getAnimeVisual } from '../data/anime-visual'
import { shareWithToast } from '../lib/shareWithToast'
import NotFoundPage from './NotFoundPage'

function AnimeRankingPage() {
  const { slug } = useParams()
  useRankingDeltaSubscription()
  const { personajes: catalogoPersonajes, isLoading: isCatalogLoading } = usePersonajesCatalogo()
  const data = getAnimePorSlug(slug, catalogoPersonajes)
  const anime = data?.anime ?? ''
  const visual = getAnimeVisual(slug, anime || slug)
  const {
    data: rankingComunidad,
    isLoading: isRankingLoading,
    isError,
  } = useRankingSegmentado({
    anime,
    limit: 100,
    enabled: Boolean(anime),
  })

  const communityRows = useMemo(() => {
    if (!Array.isArray(rankingComunidad)) return []
    return rankingComunidad
      .filter((item) => item?.personaje?.slug)
      .map((item) => ({
        ...item.personaje,
        score: item.votos ?? 0,
        scoreAux: item.pesoVotos,
        scoreLabel: 'votos',
        source: 'community',
      }))
  }, [rankingComunidad])

  const baseRows = data
    ? data.porElo.map((personaje) => ({
      ...personaje,
      score: personaje.elo,
      scoreAux: personaje.wins + personaje.losses,
      scoreLabel: 'ELO base',
      source: 'base',
    }))
    : []

  const rows = communityRows.length > 0 ? communityRows : baseRows
  const top3 = rows.slice(0, 3)
  const top5Text = rows
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} · ${personaje.score} ${personaje.scoreLabel}`)
    .join('\n')
  const rankingMode = communityRows.length > 0 ? 'comunitario' : 'ELO base'
  const totalVotes = communityRows.reduce((acc, item) => acc + Number(item.score || 0), 0)

  useSeo(
    data
      ? {
          title: `Ranking de ${anime}`,
          description: `Top personajes de ${anime} en AnimeShowdown. Ranking ${rankingMode}, podio, votos y acceso directo para votar personajes de ${anime}.`,
          canonical: `https://animeshowdown.dev/animes/${slug}/ranking`,
          image: `/api/og/anime/${slug}.png`,
        }
      : isCatalogLoading
        ? {
            title: 'Cargando ranking de anime',
            description: 'Cargando ranking del universo en AnimeShowdown.',
            noindex: true,
          }
        : { title: '404 — Ranking de anime no encontrado', noindex: true },
  )

  if (!data && isCatalogLoading) {
    return (
      <VisualPageShell visual={visual} lateralKanji={{ left: '順', right: '位' }}>
        <div className="mx-auto max-w-6xl py-16 text-center text-sm text-fg-muted">
          Cargando ranking del universo…
        </div>
      </VisualPageShell>
    )
  }

  if (!data) return <NotFoundPage />

  const compartirRanking = async () => {
    if (!top5Text) {
      toast.error('El ranking todavía está cargando')
      return
    }
    await shareWithToast(
      {
        title: `Ranking de ${anime}`,
        text: `Ranking de ${anime} en AnimeShowdown:\n${top5Text}\n\nVota y mueve la tabla.`,
        url: `/animes/${slug}/ranking`,
      },
      {
        nativeSuccess: 'Ranking compartido',
        clipboardSuccess: 'Ranking copiado',
        errorTitle: 'No se pudo compartir el ranking',
      },
    )
  }

  const faqs = [
    {
      pregunta: `¿Qué mide el ranking de ${anime}?`,
      respuesta:
        communityRows.length > 0
          ? `Ordena personajes de ${anime} por señales de voto reales dentro de AnimeShowdown. No es canon oficial ni power scaling absoluto.`
          : `Todavía no hay suficientes votos comunitarios para ${anime}; por eso se muestra el ELO base del catálogo como punto de partida.`,
    },
    {
      pregunta: `¿Cómo puedo mover el ranking de ${anime}?`,
      respuesta: `Votando duelos de personajes de ${anime}. Cada duelo añade actividad y puede cambiar el orden del ranking comunitario.`,
    },
    {
      pregunta: '¿ELO base y ranking comunitario son lo mismo?',
      respuesta:
        'No. El ELO base es una estimación inicial del catálogo; el ranking comunitario se alimenta de votos reales y puede cambiar con la actividad.',
    },
  ]

  return (
    <VisualPageShell visual={visual} lateralKanji={{ left: visual?.kanji ?? '順', right: '位' }}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Animes', path: '/animes' },
          { label: anime, path: `/animes/${slug}` },
          { label: 'Ranking', path: `/animes/${slug}/ranking` },
        ])}
      />
      <JsonLd id="faq-anime-ranking" schema={faqPageSchema(faqs)} />
      <JsonLd
        id="ranking-item-list"
        schema={rankingItemListSchema({
          name: `Ranking de personajes de ${anime}`,
          path: `/animes/${slug}/ranking`,
          description: `Ranking de personajes de ${anime} en AnimeShowdown.`,
          items: rows.slice(0, 20).map((personaje) => ({
            name: personaje.nombre,
            path: `/personajes/${personaje.slug}`,
            image: personaje.imagenUrl ?? personaje.imagen,
            score: personaje.score,
            scoreLabel: personaje.scoreLabel,
          })),
        })}
      />
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/animes/${slug}`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a {anime}
        </Link>

        <CinematicHero
          visual={visual}
          icon={Trophy}
          eyebrow={`Ranking de ${anime}`}
          title={
            <>
              Top personajes de <span className="as-title-gradient">{anime}</span>
            </>
          }
          subtitle={
            communityRows.length > 0
              ? `La tabla comunitaria de ${anime}: votos reales, podio visible y acceso directo para seguir moviendo el ranking.`
              : `Aún falta actividad comunitaria para ${anime}; mientras tanto, este ranking usa el ELO base como punto de partida transparente.`
          }
          actions={
            <>
              <Link
                to={`/votar?anime=${encodeURIComponent(anime)}`}
                className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Votar {anime}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to={`/animes/${slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
              >
                Ver ficha
              </Link>
              <button
                type="button"
                onClick={compartirRanking}
                disabled={rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                Compartir ranking
              </button>
            </>
          }
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 inset-shadow-hairline backdrop-blur-md">
              <p className="text-[11px] font-black text-gold">
                Estado del ranking
              </p>
              <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
                {communityRows.length > 0 ? communityRows.length : data.total}
              </p>
              <p className="text-[11px] text-fg-muted">
                personajes ordenados
              </p>
              <div className="mt-4 rounded-lg border border-border bg-bg/45 p-3 text-[12px] leading-5 text-fg-muted">
                Modo actual:{' '}
                <span className="font-bold text-gold">
                  {communityRows.length > 0 ? 'votos comunitarios' : 'ELO base'}
                </span>
              </div>
            </div>
          }
        >
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Medal} label="Top actual" value={rows[0]?.nombre ?? '—'} compact />
            <StatTile icon={BarChart3} label="Métrica" value={communityRows.length > 0 ? 'Votos' : 'ELO base'} />
            <StatTile icon={Vote} label="Votos visibles" value={totalVotes || '—'} />
            <StatTile icon={Trophy} label="Roster" value={data.total} />
          </div>
        </CinematicHero>

        <RankingModeNotice mode={rankingMode} anime={anime} hasError={isError} />

        {isRankingLoading && communityRows.length === 0 && baseRows.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState scene
            icon={Trophy}
            title={`Todavía no hay ranking para ${anime}`}
            action={{ to: `/votar?anime=${encodeURIComponent(anime)}`, label: `Votar ${anime}` }}
          >
            El ranking aparecerá cuando el catálogo tenga personajes o cuando
            entren votos suficientes para construir la tabla.
          </EmptyState>
        ) : (
          <>
            {top3.length === 3 && <AnimePodium top3={top3} />}
            <section className="mt-8">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-black text-gold">
                    Tabla completa
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-fg-strong">
                    Ranking {rankingMode} de {anime}
                  </h2>
                </div>
                <Link
                  to="/metodologia-elo"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
                >
                  <HelpCircle className="h-4 w-4" />
                  Entender métricas
                </Link>
              </div>
              <ol className="flex flex-col gap-2">
                {rows.slice(0, 100).map((personaje, index) => (
                  <AnimeRankingRow
                    key={personaje.slug}
                    rank={index + 1}
                    personaje={personaje}
                  />
                ))}
              </ol>
            </section>
          </>
        )}

        <section className="mt-10 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <p className="text-[11px] font-black text-gold">
            FAQ del ranking
          </p>
          <h2 className="mt-1 text-2xl font-black text-fg-strong">
            Cómo leer el ranking de {anime}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {faqs.map((item) => (
              <article key={item.pregunta} className="rounded-2xl border border-border bg-bg/45 p-4">
                <h3 className="text-base font-bold text-fg-strong">{item.pregunta}</h3>
                <p className="mt-2 text-[13px] leading-6 text-fg-muted">{item.respuesta}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent-soft p-5 sm:p-6">
          <h2 className="text-2xl font-black text-fg-strong">
            Tu voto puede cambiar este top
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-fg-muted">
            Si falta actividad comunitaria, {anime} necesita duelos. Si ya hay
            ranking por votos, cada ronda ayuda a separar favoritos reales de
            personajes inflados por fama.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={`/votar?anime=${encodeURIComponent(anime)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              <Swords className="h-4 w-4" />
              Abrir duelos de {anime}
            </Link>
            <Link
              to={`/ranking?tab=anime&anime=${encodeURIComponent(anime)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
            >
              Ver en ranking global
            </Link>
          </div>
        </div>
      </div>
    </VisualPageShell>
  )
}

function RankingModeNotice({ mode, anime, hasError }) {
  if (hasError) {
    return (
      <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-warning">
        No se pudo cargar el ranking comunitario de {anime}. Mostramos el ELO
        base del catálogo como fallback para que la página siga siendo útil.
      </div>
    )
  }
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-fg-muted">
      Esta página prioriza el ranking comunitario cuando ya hay votos para{' '}
      {anime}. Si no hay actividad suficiente, usa <strong className="text-gold">{mode}</strong>{' '}
      como lectura inicial y lo declara de forma visible.
    </div>
  )
}

function AnimePodium({ top3 }) {
  const [first, second, third] = top3
  return (
    <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
      <PodiumCard personaje={first} rank={1} className="col-span-2 sm:order-2 sm:col-span-1" featured />
      <PodiumCard personaje={second} rank={2} className="sm:order-1" />
      <PodiumCard personaje={third} rank={3} className="sm:order-3" />
    </section>
  )
}

function PodiumCard({ personaje, rank, featured = false, className = '' }) {
  const tone =
    rank === 1
      ? 'border-medal-gold/65 bg-medal-gold/10 text-medal-gold'
      : rank === 2
        ? 'border-medal-silver/45 bg-medal-silver/10 text-medal-silver'
        : 'border-medal-bronze/45 bg-medal-bronze/10 text-medal-bronze'
  return (
    <Link
      to={`/personajes/${personaje.slug}`}
      className={`group rounded-2xl border-2 p-3 transition-all hover:-translate-y-1 ${tone} ${className}`}
    >
      <span className="inline-flex rounded-full border border-current/35 px-2.5 py-0.5 font-mono text-[11px] font-black">
        #{rank}
      </span>
      <div className={`mt-3 overflow-hidden rounded-xl border border-current/25 bg-bg ${featured ? 'aspect-[16/11]' : 'aspect-[2/3]'}`}>
        <PersonajeImg
          slug={personaje.slug}
          src={personaje.imagenUrl}
          nombre={personaje.nombre}
          colorDominante={personaje.imagenColorDominante}
          alt={personaje.nombre}
          sizes={featured ? '(min-width: 768px) 280px, 90vw' : '(min-width: 768px) 180px, 44vw'}
          fit="contain"
          position="center"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          loading="eager"
        />
      </div>
      <h2 className="mt-3 line-clamp-1 text-lg font-black text-fg-strong group-hover:text-gold">
        {personaje.nombre}
      </h2>
      <p className="mt-1 font-mono text-sm font-black">
        {personaje.score} <span className="text-[10px]">{personaje.scoreLabel}</span>
      </p>
    </Link>
  )
}

function AnimeRankingRow({ rank, personaje }) {
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:px-5">
      <Link
        to={`/personajes/${personaje.slug}`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg font-mono text-sm font-black text-gold">
          {rank === 1 ? <Trophy className="h-5 w-5" /> : rank}
        </span>
        <PersonajeImg
          slug={personaje.slug}
          src={personaje.imagenUrl}
          nombre={personaje.nombre}
          colorDominante={personaje.imagenColorDominante}
          alt={personaje.nombre}
          className="h-14 w-10 shrink-0 rounded-lg object-cover object-top"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-fg-strong group-hover:text-gold">
            {personaje.nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{personaje.anime}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-black text-gold">{personaje.score}</p>
          <p className="text-[10px] text-fg-muted">
            {personaje.scoreLabel}
          </p>
        </div>
      </Link>
      <Link
        to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
        aria-label={`Retar a ${personaje.nombre} en un duelo`}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 text-[12px] font-black text-gold transition-colors hover:bg-accent/20"
      >
        <Swords className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Retar</span>
      </Link>
    </li>
  )
}

function StatTile({ icon: Icon, label, value, compact = false }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-gold" />
        <span className="text-[10px] font-semibold text-fg-muted">
          {label}
        </span>
      </div>
      <p
        className={`min-w-0 font-black text-fg-strong ${
          compact ? 'truncate text-base' : 'font-mono text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default AnimeRankingPage
