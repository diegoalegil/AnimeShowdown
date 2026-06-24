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
import { useEloCanonico } from '../hooks/useRanking'
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
import EmptyState from '../components/EmptyState'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import TopPlate from './TopPlate'
import { BRAND_VISUALS } from '../data/visual-assets'
import { shareWithToast } from '../lib/shareWithToast'
import { recordDailyRankingView } from '../lib/dailyProgress'
import NotFoundPage from './NotFoundPage'

function buildRows(page, catalogoPersonajes, eloDe) {
  const base =
    page.source.kind === 'category'
      ? getPersonajesPorCategoria(page.source.id, catalogoPersonajes)
      : catalogoPersonajes
  return base
    .map((personaje) => ({
      ...personaje,
      ...getStatsPersonaje(personaje.slug),
      // ELO canónico real (semilla por popularidad + votos) si está cargado;
      // cae al sintético mientras llega el mapa del backend.
      elo: eloDe(personaje.slug),
      scoreLabel: page.scoreLabel,
    }))
    .sort((a, b) => b.elo - a.elo)
}

function EditorialRankingPage() {
  const { slug } = useParams()
  const page = getEditorialRankingPage(slug)
  const { personajes: catalogoPersonajes, isLoading } = usePersonajesCatalogo()
  const { data: eloCanonico } = useEloCanonico()

  useEffect(() => {
    recordDailyRankingView()
  }, [])

  const rows = useMemo(
    () =>
      page
        ? buildRows(page, catalogoPersonajes, (slug) => eloCanonico?.[slug] ?? getStatsPersonaje(slug).elo)
        : [],
    [catalogoPersonajes, page, eloCanonico],
  )
  // Filas de la lámina: MISMOS datos y MISMO orden que la tabla previa
  // (rows ya viene ordenado por ELO desc). Top 100, como la tabla original.
  const entradasTopPlate = useMemo(
    () =>
      rows.slice(0, 100).map((personaje, index) => ({
        rank: index + 1,
        slug: personaje.slug,
        nombre: personaje.nombre,
        universo: personaje.anime,
        elo: personaje.elo,
        colorDominante: personaje.imagenColorDominante,
        href: `/personajes/${personaje.slug}`,
      })),
    [rows],
  )
  const category = page?.source.kind === 'category'
    ? CATEGORIAS.find((item) => item.id === page.source.id)
    : null
  const top5Text = rows
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} (${personaje.anime}) · ${personaje.elo} ELO`)
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
    await shareWithToast(
      {
        title: page.title,
        text: `${page.title} en AnimeShowdown:\n${top5Text}\n\nVota y mueve este top.`,
        url: `/rankings/${page.slug}`,
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
      pregunta: `¿Cómo se ordena ${page.h1.toLowerCase()}?`,
      respuesta:
        'La página ordena por ELO (popularidad del catálogo ajustada por los votos) y etiquetas curadas. El ranking por volumen de votos en vivo vive en el ranking general.',
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
            scoreLabel: 'ELO',
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
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 inset-shadow-hairline backdrop-blur-md">
              <p className="text-[11px] font-black text-gold">
                Intención SEO
              </p>
              <p className="mt-3 text-sm leading-7 text-fg-muted">
                {page.intent}
              </p>
              <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
                {rows.length}
              </p>
              <p className="text-[11px] text-fg-muted">
                personajes en este top
              </p>
            </div>
          }
        >
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Top actual" value={rows[0]?.nombre ?? '—'} />
            <StatTile label="Filtro" value={category?.label ?? 'Global'} />
            <StatTile label="Métrica" value="ELO" />
            <StatTile label="Landing" value="Manual" />
          </div>
        </CinematicHero>

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
          <TopPlate
            titulo={`Top ${Math.min(rows.length, 100)} · ${page.title}`}
            tituloTag="h2"
            kicker={`${page.eyebrow} · ${rows.length} personajes`}
            kanji="王"
            kanjiSentido="rey"
            entradas={entradasTopPlate}
          >
            {/* Bloque editorial SEO ÍNTEGRO: «qué contiene» + cross-links,
                literal y crawlable, bajo la tabla. */}
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <p className="text-[11px] font-black text-gold">
                Qué contiene esta página
              </p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <p className="text-sm leading-7 text-fg-muted">
                  {page.intro} La lista se construye con personajes reales del
                  catálogo, etiquetas curadas y su ELO. Para evitar contenido
                  fino, cada landing existe solo si responde a una intención clara.
                </p>
                <div className="rounded-2xl border border-border bg-bg/45 p-4 text-[13px] leading-6 text-fg-muted">
                  No es canon oficial. Es una vista de producto para descubrir,
                  votar, comparar y compartir rankings dentro de AnimeShowdown.
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-[11px] font-black text-gold">
                  Más rankings para explorar
                </p>
                <Link
                  to="/ranking"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
                >
                  <ListOrdered className="h-4 w-4" />
                  Ranking completo
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {EDITORIAL_RANKING_PAGES.filter((item) => item.slug !== page.slug).map((item) => (
                  <Link
                    key={item.slug}
                    to={`/rankings/${item.slug}`}
                    className="rounded-2xl border border-border bg-bg/45 p-4 transition-colors hover:border-gold/45 hover:text-gold"
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
          </TopPlate>
        )}
      </div>
    </VisualPageShell>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4">
      <span className="text-[10px] font-semibold text-fg-muted">
        {label}
      </span>
      <p className="min-w-0 truncate text-base font-black text-fg-strong">
        {value}
      </p>
    </div>
  )
}

export default EditorialRankingPage
