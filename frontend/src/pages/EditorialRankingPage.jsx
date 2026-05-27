import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  ListOrdered,
  Search,
  Share2,
  Swords,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSeo } from '../hooks/useSeo'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { getStatsPersonaje } from '../lib/personajes-core'
import {
  CATEGORIAS,
  getPersonajesPorCategoria,
} from '../data/personajes-tags'
import {
  EDITORIAL_RANKING_PAGES,
  getEditorialRankingPage,
} from '../data/editorial-rankings'
import {
  breadcrumbsSchema,
  faqPageSchema,
  rankingItemListSchema,
} from '../lib/schema'
import JsonLd from '../components/JsonLd'
import PersonajeImg from '../components/PersonajeImg'
import EmptyState from '../components/EmptyState'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import { shareOrCopy } from '../lib/share'
import { recordDailyRankingView, recordDailyShare } from '../lib/dailyProgress'
import NotFoundPage from './NotFoundPage'

function buildRows(page, catalogoPersonajes) {
  const base =
    page.source.kind === 'category'
      ? getPersonajesPorCategoria(page.source.id, catalogoPersonajes)
      : catalogoPersonajes
  return base
    .map((personaje) => ({
      ...personaje,
      ...getStatsPersonaje(personaje.slug),
      scoreLabel: page.scoreLabel,
    }))
    .sort((a, b) => b.elo - a.elo)
}

function EditorialRankingPage() {
  const { slug } = useParams()
  const page = getEditorialRankingPage(slug)
  const { personajes: catalogoPersonajes, isLoading } = usePersonajesCatalogo()

  useEffect(() => {
    recordDailyRankingView()
  }, [])

  const rows = useMemo(
    () => (page ? buildRows(page, catalogoPersonajes) : []),
    [catalogoPersonajes, page],
  )
  const top3 = rows.slice(0, 3)
  const category = page?.source.kind === 'category'
    ? CATEGORIAS.find((item) => item.id === page.source.id)
    : null
  const top5Text = rows
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} (${personaje.anime}) · ${personaje.elo} ELO base`)
    .join('\n')

  useSeo(
    page
      ? {
          title: page.title,
          description: page.description,
          canonical: `https://animeshowdown.dev/rankings/${page.slug}`,
          image: '/api/og/ranking.png',
        }
      : { title: '404 — Ranking no encontrado', noindex: true },
  )

  if (!page && isLoading) {
    return (
      <VisualPageShell visual={BRAND_VISUALS.ranking} lateralKanji={{ left: '頂', right: '点' }}>
        <div className="mx-auto max-w-6xl py-16 text-center text-sm text-fg-muted">
          Cargando ranking…
        </div>
      </VisualPageShell>
    )
  }

  if (!page) return <NotFoundPage />

  const compartirRanking = async () => {
    if (!top5Text) {
      toast.error('El ranking todavía está cargando')
      return
    }
    try {
      const result = await shareOrCopy({
        title: page.title,
        text: `${page.title} en AnimeShowdown:\n${top5Text}\n\nVota y mueve este top.`,
        url: `/rankings/${page.slug}`,
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

  const faqs = [
    {
      pregunta: `¿Cómo se ordena ${page.h1.toLowerCase()}?`,
      respuesta:
        'La página usa ELO base y etiquetas curadas del catálogo para dar una lectura inicial. Los votos comunitarios viven en el ranking competitivo general.',
    },
    {
      pregunta: '¿Es un ranking oficial de anime?',
      respuesta:
        'No. AnimeShowdown no decide canon ni poder oficial; convierte preferencias y señales competitivas de fandom en rankings navegables.',
    },
    {
      pregunta: '¿Cómo puedo cambiar el resultado?',
      respuesta:
        'Vota duelos, reta personajes desde esta página y revisa el ranking general para ver cómo se mueve la comunidad.',
    },
  ]

  return (
    <VisualPageShell visual={BRAND_VISUALS.ranking} lateralKanji={{ left: '頂', right: '点' }}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Ranking', path: '/ranking' },
          { label: page.title, path: `/rankings/${page.slug}` },
        ])}
      />
      <JsonLd id="faq-editorial-ranking" schema={faqPageSchema(faqs)} />
      <JsonLd
        id="ranking-item-list"
        schema={rankingItemListSchema({
          name: page.title,
          path: `/rankings/${page.slug}`,
          description: page.description,
          items: rows.slice(0, 20).map((personaje) => ({
            name: personaje.nombre,
            path: `/personajes/${personaje.slug}`,
            image: personaje.imagenUrl ?? personaje.imagen,
            score: personaje.elo,
            scoreLabel: 'ELO base',
          })),
        })}
      />

      <div className="mx-auto max-w-6xl">
        <Link
          to="/ranking"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al ranking
        </Link>

        <CinematicHero
          visual={BRAND_VISUALS.ranking}
          icon={Trophy}
          eyebrow={page.eyebrow}
          title={
            <>
              {page.h1.split(' anime')[0]} <span className="as-title-gradient">anime</span>
            </>
          }
          subtitle={page.description}
          actions={
            <>
              <Link
                to="/votar"
                className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Votar ahora
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <button
                type="button"
                onClick={compartirRanking}
                disabled={rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                Compartir top
              </button>
              <Link
                to="/metodologia-elo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
              >
                <HelpCircle className="h-4 w-4" />
                Metodología
              </Link>
            </>
          }
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)] backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                Intención SEO
              </p>
              <p className="mt-3 text-sm leading-7 text-fg-muted">
                {page.intent}
              </p>
              <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
                {rows.length}
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">
                personajes en este top
              </p>
            </div>
          }
        >
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Top actual" value={rows[0]?.nombre ?? '—'} />
            <StatTile label="Filtro" value={category?.label ?? 'Global'} />
            <StatTile label="Métrica" value="ELO base" />
            <StatTile label="Landing" value="Manual" />
          </div>
        </CinematicHero>

        <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            Qué contiene esta página
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <p className="text-sm leading-7 text-fg-muted">
              {page.intro} La lista se construye con personajes reales del
              catálogo, etiquetas curadas y ELO base. Para evitar contenido
              fino, cada landing existe solo si responde a una intención clara.
            </p>
            <div className="rounded-xl border border-border bg-bg/45 p-4 text-[13px] leading-6 text-fg-muted">
              No es canon oficial. Es una vista de producto para descubrir,
              votar, comparar y compartir rankings dentro de AnimeShowdown.
            </div>
          </div>
        </section>

        {isLoading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState scene
            visual={BRAND_VISUALS.empty}
            icon={Search}
            title="No hay personajes suficientes para este ranking"
            action={{ to: '/personajes', label: 'Explorar personajes' }}
          >
            Este top necesita más personajes etiquetados para no parecer una
            página vacía.
          </EmptyState>
        ) : (
          <>
            {top3.length === 3 && <EditorialPodium top3={top3} />}
            <section className="mt-8">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                    Tabla completa
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-fg-strong">
                    Top {Math.min(rows.length, 100)} · {page.title}
                  </h2>
                </div>
                <Link
                  to="/ranking"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
                >
                  <ListOrdered className="h-4 w-4" />
                  Ranking completo
                </Link>
              </div>
              <ol className="flex flex-col gap-2">
                {rows.slice(0, 100).map((personaje, index) => (
                  <EditorialRankingRow
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
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            Más rankings para explorar
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EDITORIAL_RANKING_PAGES.filter((item) => item.slug !== page.slug).map((item) => (
              <Link
                key={item.slug}
                to={`/rankings/${item.slug}`}
                className="rounded-xl border border-border bg-bg/45 p-4 transition-colors hover:border-gold/45 hover:text-gold"
              >
                <p className="line-clamp-2 text-sm font-black text-fg-strong">
                  {item.title}
                </p>
                <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-fg-muted">
                  {item.intent}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </VisualPageShell>
  )
}

function EditorialPodium({ top3 }) {
  return (
    <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
      {top3.map((personaje, index) => (
        <PodiumCard
          key={personaje.slug}
          personaje={personaje}
          rank={index + 1}
          featured={index === 0}
          className={index === 0 ? 'col-span-2 sm:order-2 sm:col-span-1' : index === 1 ? 'sm:order-1' : 'sm:order-3'}
        />
      ))}
    </section>
  )
}

function PodiumCard({ personaje, rank, featured = false, className = '' }) {
  const tone =
    rank === 1
      ? 'border-yellow-400/65 bg-yellow-500/10 text-yellow-300'
      : rank === 2
        ? 'border-zinc-300/45 bg-zinc-400/10 text-zinc-200'
        : 'border-orange-400/45 bg-orange-500/10 text-orange-300'
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
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          loading="eager"
        />
      </div>
      <h2 className="mt-3 line-clamp-1 text-lg font-black text-fg-strong group-hover:text-gold">
        {personaje.nombre}
      </h2>
      <p className="line-clamp-1 text-[12px] text-fg-muted">{personaje.anime}</p>
      <p className="mt-1 font-mono text-sm font-black">
        {personaje.elo} <span className="text-[10px] uppercase">ELO base</span>
      </p>
    </Link>
  )
}

function EditorialRankingRow({ rank, personaje }) {
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:px-5">
      <Link
        to={`/personajes/${personaje.slug}`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg font-mono text-sm font-black text-gold">
          {rank}
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
          <p className="font-mono text-base font-black text-gold">{personaje.elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO base
          </p>
        </div>
      </Link>
      <Link
        to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
        aria-label={`Retar a ${personaje.nombre} en un duelo`}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 text-[12px] font-black text-gold transition-colors hover:bg-accent/20"
      >
        <Swords className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Retar</span>
      </Link>
    </li>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
        {label}
      </span>
      <p className="min-w-0 truncate text-base font-black text-fg-strong">
        {value}
      </p>
    </div>
  )
}

export default EditorialRankingPage
