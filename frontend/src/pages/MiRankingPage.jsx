import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Image as ImageIcon,
  RefreshCw,
  Share2,
  Swords,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import PersonajeImg from '../components/PersonajeImg'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { imagenPersonaje } from '../lib/personajes-core'
import {
  clearLocalVotes,
  filterLocalVotesByPeriod,
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'
import { recordDailyShare } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'

const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: 'all', label: 'Todo' },
]

function MiRankingPage() {
  useSeo({
    title: 'Mi ranking anime',
    description:
      'Ranking personal local de AnimeShowdown basado en los personajes que más votas. Comparte tu top y reta a tus favoritos.',
    canonical: 'https://animeshowdown.dev/mi-ranking',
    noindex: true,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const [votes, setVotes] = useState(() => readLocalVotes())
  const [period, setPeriod] = useState('all')

  useEffect(
    () => listenLocalVotes((nextVotes) => setVotes(nextVotes)),
    [],
  )

  const catalogBySlug = useMemo(
    () => new Map(catalogoPersonajes.map((personaje) => [personaje.slug, personaje])),
    [catalogoPersonajes],
  )
  const filteredVotes = useMemo(
    () => filterLocalVotesByPeriod(votes, period),
    [period, votes],
  )
  const stats = useMemo(
    () => getLocalVoteStats(filteredVotes),
    [filteredVotes],
  )
  const top = useMemo(
    () =>
      stats.top.map((item) => ({
        ...item,
        personaje: catalogBySlug.get(item.slug) || null,
      })),
    [catalogBySlug, stats.top],
  )
  const topTwo = top.slice(0, 2)

  const compartir = async () => {
    const podium = top.slice(0, 5)
    const text = podium.length
      ? [
          'Mi ranking personal de AnimeShowdown:',
          ...podium.map((item, index) => `${index + 1}. ${item.nombre} x${item.count}`),
          `Total: ${stats.total} voto${stats.total === 1 ? '' : 's'} registrados en este navegador.`,
        ].join('\n')
      : 'Estoy creando mi ranking personal de personajes anime en AnimeShowdown. ¿Cuál sería tu top?'
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

  const reiniciar = () => {
    if (stats.total > 0 && !window.confirm('¿Reiniciar tu ranking personal local?')) return
    clearLocalVotes()
    toast.success('Ranking personal reiniciado')
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.ranking}
      className="py-10 sm:py-12"
      lateralKanji={{ left: '私', right: '順' }}
      atmosphere="archive"
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Mi ranking', path: '/mi-ranking' },
        ])}
      />
      <JsonLd id="mi-ranking-page" schema={miRankingSchema()} />

      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.ranking}
          icon={Trophy}
          eyebrow="Ranking personal"
          title="Tu top se escribe con tus votos"
          subtitle="Un ranking local y privado que resume a qué personajes estás empujando. Sirve para volver, comparar y compartir tu sesgo de fan sin esperar a una red social completa."
          actions={
            <>
              <Link
                to="/votar"
                className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
              >
                <Swords className="h-4 w-4" />
                Votar para subirlo
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={compartir}
                className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <Share2 className="h-4 w-4" />
                Compartir top
              </button>
              <Link
                to="/mi-top5"
                className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <ImageIcon className="h-4 w-4" />
                Crear imagen
              </Link>
            </>
          }
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                Votos locales
              </p>
              <p className="mt-3 font-mono text-5xl font-black text-fg-strong">
                {stats.total}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                {stats.uniqueCharacters} personaje{stats.uniqueCharacters === 1 ? '' : 's'} en tu ranking.
              </p>
            </div>
          }
        />

        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                aria-pressed={period === item.id}
                className={`rounded-lg border px-3 py-2 text-[12px] font-black transition-colors ${
                  period === item.id
                    ? 'border-gold/55 bg-gold-soft text-gold'
                    : 'border-border bg-bg/50 text-fg-muted hover:border-accent/45 hover:text-fg-strong'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {topTwo.length === 2 && (
              <Link
                to={`/comparar?a=${encodeURIComponent(topTwo[0].slug)}&b=${encodeURIComponent(topTwo[1].slug)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-[12px] font-bold text-gold transition-colors hover:bg-accent/20"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Comparar mi top 2
              </Link>
            )}
            {top.length > 0 && (
              <Link
                to="/mi-top5"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-3 py-2 text-[12px] font-bold text-gold transition-colors hover:bg-gold/10"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Pasar a imagen
              </Link>
            )}
            <button
              type="button"
              onClick={reiniciar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/50 px-3 py-2 text-[12px] font-bold text-fg-muted transition-colors hover:border-danger/45 hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reiniciar
            </button>
          </div>
        </section>

        {top.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.34fr)]">
            <div className="grid gap-3">
              {top.slice(0, 10).map((item, index) => (
                <RankingRow key={item.slug} item={item} rank={index + 1} />
              ))}
            </div>

            <aside className="flex flex-col gap-4">
              <SummaryPanel stats={stats} />
              <AnimePanel animes={stats.animes} />
              <LatestVotes votes={stats.latest} />
            </aside>
          </section>
        ) : (
          <EmptyState />
        )}
      </div>
    </VisualPageShell>
  )
}

function RankingRow({ item, rank }) {
  const personaje = item.personaje
  const imageSrc = personaje?.imagenUrl ?? personaje?.imagen ?? imagenPersonaje(item.slug)
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3 sm:gap-4 sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold-soft font-mono text-sm font-black text-gold">
        #{rank}
      </div>
      <Link
        to={`/personajes/${item.slug}`}
        className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-bg"
      >
        <PersonajeImg
          slug={item.slug}
          src={imageSrc}
          alt={item.nombre}
          className="h-full w-full object-cover object-top"
          loading={rank <= 3 ? 'eager' : 'lazy'}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/personajes/${item.slug}`}
          className="line-clamp-1 text-base font-black text-fg-strong hover:text-gold"
        >
          {item.nombre}
        </Link>
        <p className="line-clamp-1 text-[12px] text-fg-muted">
          {item.anime || personaje?.anime || 'Anime no especificado'}
        </p>
      </div>
      <div className="hidden min-w-[5rem] text-right sm:block">
        <p className="font-mono text-2xl font-black text-fg-strong">{item.count}</p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">
          votos tuyos
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Link
          to={`/votar?personaje=${encodeURIComponent(item.slug)}`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-accent/45 bg-accent-soft px-3 text-[12px] font-black text-gold transition-colors hover:bg-accent/20"
        >
          Retar
        </Link>
      </div>
    </article>
  )
}

function SummaryPanel({ stats }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
        Resumen
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat icon={Swords} value={stats.total} label="votos" />
        <MiniStat icon={UserRound} value={stats.uniqueCharacters} label="chars" />
        <MiniStat icon={CalendarDays} value={stats.uniqueAnimes} label="animes" />
      </div>
    </section>
  )
}

function MiniStat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-lg border border-border bg-bg/45 p-3">
      <Icon className="mx-auto mb-1 h-4 w-4 text-gold" />
      <p className="font-mono text-lg font-black text-fg-strong">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">{label}</p>
    </div>
  )
}

function AnimePanel({ animes }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
        Universos que más empujas
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {animes.slice(0, 5).map((item) => (
          <div key={item.anime} className="flex items-center justify-between gap-3 text-sm">
            <span className="line-clamp-1 text-fg-muted">{item.anime}</span>
            <span className="font-mono font-black text-fg-strong">{item.count}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function LatestVotes({ votes }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
        Últimos votos
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {votes.slice(0, 6).map((vote) => (
          <div key={vote.id} className="rounded-lg border border-border bg-bg/45 px-3 py-2">
            <p className="line-clamp-1 text-[13px] font-bold text-fg-strong">
              {vote.ganadorNombre}
            </p>
            <p className="line-clamp-1 text-[11px] text-fg-muted">
              contra {vote.perdedorNombre || 'rival'} · {formatDate(vote.at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-gold/35 bg-gold-soft text-gold">
        <RefreshCw className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-black text-fg-strong">
        Todavía no hay ranking personal
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-fg-muted">
        Vota algunos duelos y esta página se convertirá en tu top personal. Se guarda
        en este navegador, no cambia el ranking global por sí solo y no requiere login.
      </p>
      <Link
        to="/votar"
        className="as-button-primary mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
      >
        <Swords className="h-4 w-4" />
        Empezar a votar
      </Link>
    </section>
  )
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'ahora'
  }
}

function miRankingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Mi ranking anime',
    url: 'https://animeshowdown.dev/mi-ranking',
    description:
      'Ranking personal local de AnimeShowdown basado en los personajes anime que más vota cada usuario.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev/',
    },
  }
}

export default MiRankingPage
