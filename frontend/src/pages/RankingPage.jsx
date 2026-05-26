import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  Crown,
  HelpCircle,
  Medal,
  Search,
  Share2,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  Tv,
  Vote,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getStatsPersonaje } from '../lib/personajes-core'
import { EDITORIAL_RANKING_PAGES } from '../data/editorial-rankings'
import {
  CATEGORIAS,
  MIN_PARA_SECCION,
  getPersonajesPorCategoria,
} from '../data/personajes-tags'
import PersonajeImg from '../components/PersonajeImg'
import RankingMetaReport from '../components/RankingMetaReport'
import PersonalRankingTeaser from '../components/PersonalRankingTeaser'
import { CinematicHero, EmptyStateScene, VisualPageShell } from '../components/VisualSystem'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import PersonajeCutImg from '../components/PersonajeCutImg'
import { BRAND_VISUALS } from '../data/visual-assets'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { endpoints } from '../lib/api'
import {
  useAnimesConVotos,
  useRankingDeltaSubscription,
  useRankingMovimientos,
  useRankingSegmentado,
} from '../hooks/useRanking'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { shareOrCopy } from '../lib/share'
import { recordDailyRankingView, recordDailyShare } from '../lib/dailyProgress'

/**
 * RankingPage rebranded.
 *
 * Tabs:
 *   - ELO actual — calculado desde catálogo, siempre disponible.
 *   - Histórico — top votos absoluto del backend.
 *   - Este mes — últimos 30 días.
 *   - Por anime — dropdown de animes con al menos 1 voto.
 *
 * Estructura nueva:
 *   - Header competitivo + CTAs
 *   - Tabs
 *   - Buscador + filtros
 *   - Podio Top 3 (campeón centrado grande)
 *   - Lista desde #4
 *   - Hub "Sigue moviendo el ranking"
 *   - Tabla extraíble plegable (datos técnicos)
 */

function crearRankingElo(catalogoPersonajes) {
  return [...catalogoPersonajes]
    .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
    .sort((a, b) => b.elo - a.elo)
}

function crearAnimeFilterOptions(catalogoPersonajes) {
  const set = new Set(catalogoPersonajes.map((p) => p.anime).filter(Boolean))
  return ['', ...Array.from(set).sort()]
}

const TABS = [
  { id: 'elo', label: 'ELO actual', icon: Trophy },
  { id: 'categorias', label: 'Categorías', icon: Sparkles },
  { id: 'all', label: 'Histórico', icon: Vote },
  { id: 'mes', label: 'Este mes', icon: Calendar },
  { id: 'anime', label: 'Por anime', icon: Tv },
]

function RankingPage() {
  useRankingDeltaSubscription()
  const [searchParams] = useSearchParams()
  const {
    personajes: catalogoPersonajes,
    isLoading: isCatalogLoading,
  } = usePersonajesCatalogo()
  const rankedElo = useMemo(
    () => crearRankingElo(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const animeFilterOptions = useMemo(
    () => crearAnimeFilterOptions(catalogoPersonajes),
    [catalogoPersonajes],
  )
  useSeo({
    title: 'Ranking competitivo',
    description: `Top ${catalogoPersonajes.length} personajes de anime ordenados por señales competitivas de la comunidad. Quién domina AnimeShowdown — cada voto mueve la tabla.`,
    image: '/api/og/ranking.png',
  })

  useEffect(() => {
    recordDailyRankingView()
  }, [])

  const initialSearch = searchParams.get('q') ?? ''
  const initialAnimeFilter = searchParams.get('anime') ?? ''
  const initialTab = searchParams.get('tab')
  const [tab, setTab] = useState(
    TABS.some((item) => item.id === initialTab) ? initialTab : 'elo',
  )
  const consultadoA = useMemo(
    () =>
      new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )
  const compartirRanking = async () => {
    const top5 = rankedElo.slice(0, 5)
    if (top5.length === 0) {
      toast.error('El ranking todavía está cargando')
      return
    }
    const resumen = top5
      .map((p, index) => `${index + 1}. ${p.nombre} (${p.anime}) · ${p.elo} ELO base`)
      .join('\n')
    try {
      const result = await shareOrCopy({
        title: 'Top anime en AnimeShowdown',
        text: `Mi top 5 ELO base en AnimeShowdown ahora mismo:\n${resumen}\n\nVota y cambia la tabla.`,
        url: '/ranking',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Ranking compartido' : 'Ranking copiado')
    } catch (error) {
      toast.error('No se pudo compartir el ranking', {
        description: error?.message || 'Copia el top manualmente.',
      })
    }
  }

  return (
    <VisualPageShell visual={BRAND_VISUALS.ranking} className="py-10 sm:py-12" lateralKanji={{left: "頂", right: "点"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Ranking', path: '/ranking' },
        ])}
      />
      <div className="mx-auto max-w-7xl">
        <CinematicHero
          visual={BRAND_VISUALS.ranking}
          icon={Trophy}
          eyebrow="Ranking competitivo · Salón de la fama"
          title={
            <>
              ¿Quién domina <span className="as-title-gradient">AnimeShowdown?</span>
            </>
          }
          subtitle="Estos son los personajes que la comunidad ha llevado a la cima. Cada voto suma señal competitiva, cada duelo puede cambiar posiciones y ningún puesto está garantizado."
          actions={
            <>
              <Link
                to="/votar"
                className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Votar ahora
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/metodologia-elo"
                className="as-panel inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
              >
                <HelpCircle className="h-4 w-4" />
                Cómo funciona
              </Link>
              <button
                type="button"
                onClick={compartirRanking}
                disabled={isCatalogLoading && rankedElo.length === 0}
                className="as-panel inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                Compartir top
              </button>
            </>
          }
          aside={
            <div className="as-panel rounded-2xl border-amber-500/35 p-5">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-300">
              Meta report · esta semana
            </p>
            <p className="text-sm leading-relaxed text-fg-muted">
              La tabla cambia con cada duelo. Entra a votar si quieres mover el
              podio antes del próximo corte semanal.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              <Clock className="h-3.5 w-3.5 text-gold" />
              Consultado hoy a las {consultadoA}
            </p>
            <Link
              to="/votar"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20"
            >
              Votar duelos abiertos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          }
        />

        <EloExplainer />

        {/* Meta report narrativo arriba del MoversStrip: lee los endpoints
            que ya carga la página y React Query deduplica las requests. */}
        <RankingMetaReport />
        {/* Nota de producto: el ranking se sentía estático.
            MoversStrip arriba pinta los 3 personajes con más movimiento
            de la semana — da sensación de vida temporal incluso antes
            de que el user elija un tab. Solo aparece si hay movimientos. */}
        <MoversStrip />

        <PersonalRankingTeaser className="mt-6" />

        <EditorialRankingsStrip />

        <Tabs activo={tab} onChange={setTab} />

        <div className="mt-6">
          {tab === 'elo' && (
            <ListaEloLocal
              key={`elo:${initialSearch}:${initialAnimeFilter}`}
              rankedElo={rankedElo}
              animeFilterOptions={animeFilterOptions}
              isCatalogLoading={isCatalogLoading}
              initialSearch={initialSearch}
              initialAnimeFilter={initialAnimeFilter}
            />
          )}
          {tab === 'categorias' && (
            <ListaCategoriasOtaku
              catalogoPersonajes={catalogoPersonajes}
              isCatalogLoading={isCatalogLoading}
            />
          )}
          {tab === 'all' && <ListaBackend periodo="all" />}
          {tab === 'mes' && <ListaBackend periodo="mes" />}
          {tab === 'anime' && (
            <PorAnime key={`anime:${initialAnimeFilter}`} initialAnime={initialAnimeFilter} />
          )}
        </div>

        <HubLinks />

        <RankingFaq />

        <TablaExtraible rankedElo={rankedElo} />
      </div>
    </VisualPageShell>
  )
}

function EditorialRankingsStrip() {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            Rankings por intención
          </p>
          <h2 className="text-xl font-black text-fg-strong">
            Entra directo al top que buscabas
          </h2>
        </div>
        <Link
          to="/rankings/mejores-personajes-anime"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg/45 px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
        >
          Ver top global
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {EDITORIAL_RANKING_PAGES.map((page) => (
          <Link
            key={page.slug}
            to={`/rankings/${page.slug}`}
            className="group rounded-xl border border-border bg-bg/45 p-3 transition-all hover:-translate-y-0.5 hover:border-accent/45"
          >
            <p className="line-clamp-2 text-sm font-black text-fg-strong group-hover:text-gold">
              {page.title}
            </p>
            <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {page.intent}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function EloExplainer() {
  const pasos = [
    {
      icon: Swords,
      titulo: 'Cada duelo registra una preferencia',
      texto:
        'La comunidad elige entre dos personajes. Es una señal competitiva agregada, no una verdad absoluta sobre poder o canon.',
    },
    {
      icon: TrendingUp,
      titulo: 'La tabla se mueve con votos reales',
      texto:
        'Los tabs históricos y mensuales salen de actividad pública. El ELO base del catálogo sirve como estimación inicial y contexto.',
    },
    {
      icon: Medal,
      titulo: 'El ranking separa histórico y momento',
      texto:
        'El histórico acumula toda la actividad; el mes enseña qué personajes vienen moviendo el meta ahora.',
    },
  ]

  return (
    <section
      aria-labelledby="elo-explicacion"
      className="as-panel mt-8 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-gold">
            Cómo se mueve la tabla
          </p>
          <h2 id="elo-explicacion" className="mt-1 text-2xl">
            El ranking mezcla actividad comunitaria y contexto competitivo
          </h2>
        </div>
        <Link
          to="/metodologia-elo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface-alt px-3 py-2 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
        >
          Ver metodología
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {pasos.map(({ icon: Icon, titulo, texto }) => (
          <div
            key={titulo}
            className="rounded-xl border border-border bg-bg/45 p-4"
          >
            <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-gold">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-base">{titulo}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              {texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Tab "Categorías otaku" — secciones independientes por arquetipo
 * (héroes, villanos, waifus, husbandos, protagonistas, rivales,
 * mentores, antihéroes). Cada sección lista los personajes tagueados
 * ordenados por ELO local, máximo 10 por sección. Se omite la
 * categoría si tiene menos de MIN_PARA_SECCION personajes (3) —
 * mejor no enseñar "Top mentores: 1 personaje" que se ve raro.
 *
 * Nota de producto: el ranking
 * por ELO global es la "tabla de la liga"; estas categorías son las
 * "competiciones temáticas" (Top heroínas, copa villanos, etc).
 * Tags vienen del archivo data/personajes-tags.js, sin backend.
 */
function ListaCategoriasOtaku({ catalogoPersonajes, isCatalogLoading }) {
  const secciones = useMemo(() => {
    return CATEGORIAS
      .map((cat) => {
        const personajesCat = getPersonajesPorCategoria(cat.id, catalogoPersonajes)
          .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
          .sort((a, b) => b.elo - a.elo)
          .slice(0, 10)
        return { ...cat, personajes: personajesCat }
      })
      .filter((s) => s.personajes.length >= MIN_PARA_SECCION)
  }, [catalogoPersonajes])

  if (isCatalogLoading && catalogoPersonajes.length === 0) {
    return <RankingSkeletonGrid />
  }

  if (secciones.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-alt/40 p-6 text-center text-[13px] text-fg-muted">
        Aún no hay personajes tagueados por categoría. Añade tags en{' '}
        <code className="font-mono text-[12px]">data/personajes-tags.js</code>.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="text-[13px] text-fg-muted">
        Rankings temáticos por arquetipo de personaje. Solo aparecen las
        categorías con suficientes personajes etiquetados.
      </p>
      {secciones.map((seccion) => (
        <SeccionCategoria key={seccion.id} seccion={seccion} />
      ))}
    </div>
  )
}

function SeccionCategoria({ seccion }) {
  // Colores tematizados por arquetipo (sky héroes, rose villanos, pink
  // waifus, violet husbandos, amber protagonistas, orange rivales,
  // emerald mentores, purple antihéroes).
  const TONO_CLASES = {
    sky: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    rose: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
    pink: 'text-pink-300 border-pink-500/40 bg-pink-500/10',
    violet: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    amber: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    orange: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    emerald: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    purple: 'text-purple-300 border-purple-500/40 bg-purple-500/10',
  }
  const tonoClase = TONO_CLASES[seccion.tono] ?? TONO_CLASES.sky
  // Sprint 5h (2026-05-18): el chip eyebrow era un <span> — sin landmark
  // semántico para screen readers ni structure outline. Usamos un h2
  // visualmente igual al chip anterior (mismo padding/colores/uppercase)
  // pero etiquetado como heading para a11y + SEO.
  return (
    <section aria-labelledby={`cat-${seccion.id}`} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <h2
          id={`cat-${seccion.id}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.1em] ${tonoClase}`}
        >
          <span aria-hidden="true">{seccion.emoji}</span>
          {seccion.label}
        </h2>
        <span className="font-mono text-[11px] text-fg-muted tabular-nums" aria-label={`${seccion.personajes.length} personajes en esta categoría`}>
          {seccion.personajes.length}
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {seccion.personajes.map((p, i) => (
          <CategoriaCard
            key={p.slug}
            rank={i + 1}
            personaje={p}
            tono={seccion.tono}
          />
        ))}
      </ol>
    </section>
  )
}

function CategoriaCard({ rank, personaje, tono }) {
  // El ranking puede devolver items sin slug durante cold-start o con datos
  // incompletos. Evitamos /personajes/undefined y preferimos omitir la card.
  if (!personaje?.slug) return null
  const RANK_TONO = {
    sky: 'bg-sky-500/20 text-sky-200',
    rose: 'bg-rose-500/20 text-rose-200',
    pink: 'bg-pink-500/20 text-pink-200',
    violet: 'bg-violet-500/20 text-violet-200',
    amber: 'bg-amber-500/20 text-amber-200',
    orange: 'bg-orange-500/20 text-orange-200',
    emerald: 'bg-emerald-500/20 text-emerald-200',
    purple: 'bg-purple-500/20 text-purple-200',
  }
  const rankTono = RANK_TONO[tono] ?? RANK_TONO.sky
  return (
    <li>
      <Link
        to={`/personajes/${personaje.slug}`}
        className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 sm:p-3"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-bg">
          <PersonajeImg
            slug={personaje.slug}
            // Pasamos src/colorDominante explícitos desde la data del ranking
            // para no depender de que el módulo `personajes` se haya hidratado
            // antes del primer paint. Sin esto, la card cae a /img/_missing/...
            // → 404 → PersonajePlaceholder y queda atrapada hasta que llega
            // el evento de hidratación.
            src={personaje.imagenUrl}
            nombre={personaje.nombre}
            colorDominante={personaje.imagenColorDominante}
            alt={personaje.nombre}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
          <span
            className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-mono text-[10px] font-extrabold ${rankTono}`}
          >
            #{rank}
          </span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-[12px] font-bold text-fg-strong group-hover:text-gold sm:text-[13px]">
            {personaje.nombre}
          </p>
          <p className="line-clamp-1 text-[10px] text-fg-muted sm:text-[11px]">
            {personaje.anime}
          </p>
        </div>
        <p className="font-mono text-[11px] font-bold text-gold">
          {personaje.elo}
        </p>
      </Link>
    </li>
  )
}

/**
 * Strip "Movers de la semana" — pinta los 3 personajes con mayor cambio
 * de posición en los últimos 7 días. Hide si el endpoint no devuelve
 * datos significativos (sin votos suficientes para que haya movimientos).
 *
 * Nota de producto: da sensación de vida temporal al ranking.
 * El user llega y ve quién está subiendo/bajando ahora mismo antes de
 * elegir un tab — el ranking deja de sentirse "tabla congelada".
 */
function MoversStrip() {
  const { data: movs } = useRankingMovimientos({ dias: 7, limit: 30 })
  const top3 = useMemo(() => {
    if (!Array.isArray(movs)) return []
    return movs
      .filter((m) => m.delta != null && m.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
  }, [movs])

  if (top3.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-300" />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
          Movers de la semana
        </h2>
        <span className="ml-auto text-[11px] text-fg-muted">últimos 7 días</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {top3.map((m) => (
          <MoverChip key={m.slug} mover={m} />
        ))}
      </ul>
    </div>
  )
}

function MoverChip({ mover }) {
  const subio = mover.delta > 0
  const Icon = subio ? TrendingUp : TrendingDown
  const colorClase = subio
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
  const verbo = subio ? 'subió' : 'bajó'
  return (
    <li>
      <Link
        to={`/personajes/${mover.slug}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-accent/40"
      >
        <PersonajeImg
          slug={mover.slug}
          src={mover.imagenUrl}
          alt={mover.nombre}
          loading="lazy"
          sizes="48px"
          className="h-12 w-9 shrink-0 rounded object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[13px] font-bold text-fg-strong group-hover:text-gold">
            {mover.nombre}
          </p>
          <p className="line-clamp-1 text-[11px] text-fg-muted">{mover.anime}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] font-extrabold ${colorClase}`}
          title={`${verbo} ${Math.abs(mover.delta)} posiciones vs hace 7 días`}
        >
          <Icon className="h-3 w-3" />
          {Math.abs(mover.delta)}
        </span>
      </Link>
    </li>
  )
}

function Tabs({ activo, onChange }) {
  // El flex-wrap hacía que 'Por anime' bajara a la
  // segunda fila en 390px, dejando el control con apariencia rota.
  // Solución: scroll horizontal en móvil (-mx para que sangre full-bleed)
  // con whitespace-nowrap; en sm+ vuelve al grid sin scroll.
  return (
    <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Secciones del ranking"
        className="inline-flex w-max gap-1 whitespace-nowrap rounded-lg border border-border bg-surface p-1 sm:flex sm:w-full sm:flex-wrap"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activo === id}
            onClick={() => onChange(id)}
            title={
              id === 'elo'
                ? 'Calculado desde los datos del catálogo. Siempre disponible.'
                : id === 'categorias'
                  ? 'Rankings por arquetipo: héroes, villanos, estrategas y más.'
                : id === 'all'
                  ? 'Top de votos desde que abrió AnimeShowdown.'
                  : id === 'mes'
                    ? 'Top de votos en los últimos 30 días.'
                    : 'Selecciona un anime para ver su ranking interno.'
            }
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-colors ${
              activo === id
                ? 'bg-accent text-white'
                : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ListaEloLocal({
  rankedElo,
  animeFilterOptions,
  isCatalogLoading,
  initialSearch = '',
  initialAnimeFilter = '',
}) {
  const [search, setSearch] = useState(initialSearch)
  const [animeFilter, setAnimeFilter] = useState(initialAnimeFilter)
  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = useMemo(
    () => deferredSearch.trim().toLowerCase(),
    [deferredSearch],
  )

  const filtered = useMemo(() => {
    let list = rankedElo
    if (animeFilter) list = list.filter((p) => p.anime === animeFilter)
    if (normalizedSearch) {
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(normalizedSearch) ||
          p.anime.toLowerCase().includes(normalizedSearch),
      )
    }
    return list
  }, [rankedElo, normalizedSearch, animeFilter])

  const podio = filtered.slice(0, 3)
  const resto = filtered.slice(3, 100)
  const top10Slugs = useMemo(
    () => filtered.slice(0, 10).map((p) => p.slug),
    [filtered],
  )
  const { data: eloHistoryTop10 } = useQuery({
    queryKey: ['ranking', 'elo-history', 'top10', top10Slugs.join(',')],
    queryFn: () => endpoints.personajesEloHistoryBatch(top10Slugs, { dias: 7 }),
    enabled: top10Slugs.length > 0,
    staleTime: 60 * 60 * 1000,
  })
  const hayFiltros = Boolean(search) || Boolean(animeFilter)
  const compartirVista = async () => {
    if (filtered.length === 0) {
      toast.error('No hay personajes para compartir con estos filtros')
      return
    }
    const params = new URLSearchParams()
    const searchTrimmed = search.trim()
    if (searchTrimmed) params.set('q', searchTrimmed)
    if (animeFilter) params.set('anime', animeFilter)
    const url = `/ranking${params.toString() ? `?${params.toString()}` : ''}`
    const top5 = filtered
      .slice(0, 5)
      .map((p, index) => `${index + 1}. ${p.nombre} (${p.anime}) · ${p.elo} ELO base`)
      .join('\n')
    const scope = animeFilter
      ? ` de ${animeFilter}`
      : searchTrimmed
        ? ` para "${searchTrimmed}"`
        : ''

    try {
      const result = await shareOrCopy({
        title: `Ranking anime${scope}`,
        text: `Mi top${scope} en AnimeShowdown:\n${top5}\n\nÁbrelo y dime a quién subirías votando.`,
        url,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Vista compartida' : 'Vista copiada')
    } catch (error) {
      toast.error('No se pudo compartir la vista', {
        description: error?.message || 'Copia el ranking manualmente.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="as-panel flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar personaje en el ranking"
            placeholder="Buscar personaje…"
            className="as-control min-h-11 w-full rounded-lg py-2.5 pl-10 pr-9 text-sm text-fg-strong placeholder:text-fg-muted"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted transition-colors hover:text-fg-strong"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={animeFilter}
          onChange={(e) => setAnimeFilter(e.target.value)}
          aria-label="Filtrar por anime"
          className="as-control min-h-11 w-full min-w-0 rounded-lg py-2.5 px-3 text-sm text-fg-strong"
        >
          <option value="">Anime: Todos</option>
          {animeFilterOptions.slice(1).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={compartirVista}
          disabled={filtered.length === 0}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-alt px-3.5 py-2 text-[12px] font-black text-fg-strong transition-colors hover:border-accent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir vista
        </button>
      </div>

      {isCatalogLoading && rankedElo.length === 0 ? (
        <RankingSkeletonList />
      ) : filtered.length === 0 ? (
        <EmptyStateScene
          visual={BRAND_VISUALS.empty}
          icon={Search}
          title="El salón de la fama no encontró ese combatiente"
        >
          <p>
            Revisa el nombre, prueba otro universo o limpia filtros para volver
            al ranking completo.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setAnimeFilter('')
            }}
            className="as-button-ghost mt-3 rounded-lg px-5 py-3 text-sm font-bold"
          >
            Limpiar filtros
          </button>
        </EmptyStateScene>
      ) : (
        <>
          {/* Podio Top 3 — solo cuando no hay filtros activos. Si el
              usuario filtra perdería sentido ver "Top 3 global" mezclado
              con un subconjunto. */}
          {!hayFiltros && podio.length === 3 && (
            <Podio top3={podio} historyBySlug={eloHistoryTop10 ?? {}} />
          )}

          {hayFiltros && (
            <p className="text-[12px] text-fg-muted">
              Mostrando{' '}
              <strong className="text-fg-strong">{filtered.length}</strong>{' '}
              personajes que coinciden
              {animeFilter && <> en {animeFilter}</>}.
            </p>
          )}

          <ol className="flex flex-col gap-2">
            {(hayFiltros ? filtered.slice(0, 100) : resto).map((p, i) => (
              <RankRowElo
                key={p.slug}
                rank={hayFiltros ? i + 1 : i + 4}
                history={eloHistoryTop10?.[p.slug]}
                {...p}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

/**
 * Podio Top 3 — campeón al centro, plata izquierda, bronce derecha.
 * Imagen grande y badges diferenciados por posición.
 */
function Podio({ top3, historyBySlug = {} }) {
  const [primero, segundo, tercero] = top3
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
      <PodioCard
        personaje={primero}
        rank={1}
        highlighted
        history={historyBySlug[primero.slug]}
        className="col-span-2 sm:order-2 sm:col-span-1"
      />
      <PodioCard
        personaje={segundo}
        rank={2}
        history={historyBySlug[segundo.slug]}
        className="sm:order-1"
      />
      <PodioCard
        personaje={tercero}
        rank={3}
        history={historyBySlug[tercero.slug]}
        className="sm:order-3"
      />
    </div>
  )
}

function PodioCard({ personaje, rank, highlighted, history, className = '' }) {
  // Guard contra slug undefined; ver CategoriaCard.
  if (!personaje?.slug) return null
  const tone =
    rank === 1
      ? {
          border: 'border-yellow-400/70',
          bg: 'bg-gradient-to-b from-yellow-500/15 via-amber-500/5 to-transparent',
          text: 'text-yellow-300',
          glow: 'shadow-[0_0_80px_-15px_rgba(251,191,36,0.6)]',
          icon: Crown,
          label: 'Campeón actual',
        }
      : rank === 2
        ? {
            border: 'border-zinc-300/50',
            bg: 'bg-gradient-to-b from-zinc-400/10 via-zinc-500/5 to-transparent',
            text: 'text-zinc-200',
            glow: 'shadow-[0_0_40px_-15px_rgba(244,244,245,0.4)]',
            icon: Medal,
            label: '2º puesto',
          }
        : {
            border: 'border-orange-400/50',
            bg: 'bg-gradient-to-b from-orange-500/10 via-amber-700/5 to-transparent',
            text: 'text-orange-300',
            glow: 'shadow-[0_0_40px_-15px_rgba(251,146,60,0.4)]',
            icon: Medal,
            label: '3er puesto',
          }
  const Icon = tone.icon
  const linkLayout = highlighted
    ? 'grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 text-left sm:flex sm:flex-col sm:items-center sm:gap-2 sm:p-3 sm:pt-6 sm:text-center'
    : 'flex flex-col items-center gap-2 p-3 pt-4 text-center'

  return (
    <Link
      to={`/personajes/${personaje.slug}`}
      className={`group relative overflow-hidden rounded-2xl border-2 transition-all motion-safe:hover:-translate-y-1 ${linkLayout} ${tone.border} ${tone.bg} ${highlighted ? tone.glow : ''} ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] ${tone.border} ${tone.text} ${highlighted ? 'col-span-2 justify-self-start sm:justify-self-auto' : ''}`}
      >
        <Icon className="h-3 w-3" />
        #{rank}
        {highlighted && ` · ${tone.label}`}
      </span>
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl border ${tone.border} bg-surface ${
          highlighted
            ? 'max-w-[8.5rem] sm:mx-auto sm:max-w-none'
            : 'mx-auto max-w-[8rem] opacity-95 sm:max-w-none'
        }`}
      >
        <PersonajeImg
          slug={personaje.slug}
          // Mismo motivo que CategoriaCard: pasamos src directo del personaje
          // recibido para no depender del catálogo módulo-global.
          src={personaje.imagenUrl}
          nombre={personaje.nombre}
          colorDominante={personaje.imagenColorDominante}
          alt={personaje.nombre}
          loading="eager"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div
        className={`flex min-w-0 flex-col gap-0.5 ${
          highlighted ? 'items-start sm:items-center' : 'items-center'
        }`}
      >
        <h3
          className={`line-clamp-1 font-bold text-fg-strong group-hover:text-gold ${
            highlighted ? 'text-base sm:text-lg' : 'text-sm'
          }`}
        >
          {personaje.nombre}
        </h3>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {personaje.anime}
        </p>
        <p
          className={`mt-1 font-mono font-extrabold tabular-nums ${tone.text} ${
            highlighted ? 'text-2xl' : 'text-lg'
          }`}
        >
          {personaje.elo}
          <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
            ELO
          </span>
        </p>
        <EloSparkline points={history} className="mt-1" />
      </div>
    </Link>
  )
}

function EloSparkline({ points, className = '' }) {
  const values = Array.isArray(points)
    ? points.map((p) => Number(p.votosAcumulados ?? p.elo ?? 0))
    : []
  if (values.length < 2) {
    return (
      <svg
        viewBox="0 0 60 20"
        role="img"
        aria-label="Sin tendencia suficiente"
        className={`h-5 w-[60px] text-fg-muted/50 ${className}`}
      >
        <line x1="2" y1="10" x2="58" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const step = 56 / (values.length - 1)
  const polyline = values
    .map((value, index) => {
      const x = 2 + index * step
      const y = 18 - ((value - min) / range) * 16
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const trend = values[values.length - 1] - values[0]
  const color =
    trend > 0 ? 'text-emerald-300' : trend < 0 ? 'text-rose-300' : 'text-fg-muted'
  const label =
    trend > 0
      ? `Tendencia positiva de ${trend} votos`
      : trend < 0
        ? `Tendencia negativa de ${Math.abs(trend)} votos`
        : 'Tendencia plana'
  return (
    <svg
      viewBox="0 0 60 20"
      role="img"
      aria-label={label}
      className={`h-5 w-[60px] ${color} ${className}`}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RankingSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  )
}

function RankingSkeletonList() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} variant="line" className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

function ListaBackend({ periodo }) {
  const { data, isLoading, isError } = useRankingSegmentado({
    periodo,
    limit: 100,
  })
  // Solo cargamos movimientos en el tab "ELO actual" (periodo=all): es
  // el único donde "subir/bajar vs hace 7d" tiene sentido. En mes ya
  // tienes la ventana corta como contexto.
  const { data: movimientos } = useRankingMovimientos({
    limit: 100,
    dias: 7,
    enabled: periodo === 'all',
  })
  const movimientosPorSlug = useMemo(
    () => Array.isArray(movimientos) ? new Map(movimientos.map((m) => [m.slug, m])) : null,
    [movimientos],
  )
  return (
    <ListaVotosCommon
      items={data}
      isLoading={isLoading}
      isError={isError}
      movimientosPorSlug={movimientosPorSlug}
    />
  )
}

function PorAnime({ initialAnime = '' }) {
  const { data: animes, isLoading: cargandoAnimes } = useAnimesConVotos()
  const [anime, setAnime] = useState(initialAnime)
  const { data, isLoading, isError } = useRankingSegmentado({
    anime,
    limit: 50,
    enabled: Boolean(anime),
  })
  const compartirRankingAnime = async () => {
    if (!anime || !Array.isArray(data) || data.length === 0) {
      toast.error('Elige un anime con ranking para compartir')
      return
    }
    const top5 = data
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.personaje.nombre} · ${item.votos} votos`)
      .join('\n')
    try {
      const result = await shareOrCopy({
        title: `Ranking de ${anime}`,
        text: `Ranking interno de ${anime} en AnimeShowdown:\n${top5}\n\nVota personajes de ${anime} y mueve este top.`,
        url: `/ranking?tab=anime&anime=${encodeURIComponent(anime)}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Ranking compartido' : 'Ranking copiado')
    } catch (error) {
      toast.error('No se pudo compartir el ranking', {
        description: error?.message || 'Copia el top manualmente.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <label
          htmlFor="anime-select"
          className="text-[12px] font-semibold text-fg-muted"
        >
          Anime:
        </label>
        <select
          id="anime-select"
          value={anime}
          onChange={(e) => setAnime(e.target.value)}
          disabled={cargandoAnimes}
          className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="">— Elige un anime —</option>
          {(animes ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {!anime ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt/40 p-6 text-center text-[12px] text-fg-muted">
          Selecciona un anime para ver el ranking interno de sus personajes.
        </p>
      ) : (
        <>
          <ListaVotosCommon
            items={data}
            isLoading={isLoading}
            isError={isError}
          />
          {data?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/votar?anime=${encodeURIComponent(anime)}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Votar personajes de {anime}
              </Link>
              <button
                type="button"
                onClick={compartirRankingAnime}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-bold text-fg-strong transition-colors hover:border-accent hover:text-gold"
              >
                <Share2 className="h-4 w-4" />
                Compartir ranking
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ListaVotosCommon({ items, isLoading, isError, movimientosPorSlug = null }) {
  if (isLoading) {
    return <RankingSkeletonList />
  }
  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No pudimos cargar el ranking"
        description="Reintenta en unos segundos para volver a consultar los votos de esta ventana."
      />
    )
  }
  if (!items || items.length === 0) {
    return (
      <EmptyStateScene
        icon={Clock}
        title="Sin actividad en esta ventana"
        action={{ to: '/votar', label: 'Votar ahora' }}
      >
        Todavía no hay votos suficientes para esta ventana de tiempo. El
        ranking se rellena cuando hay tráfico real — sé tú el primero.
      </EmptyStateScene>
    )
  }
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <RankRowVotos
          key={item.personaje.slug}
          rank={i + 1}
          personaje={item.personaje}
          votos={item.votos}
          movimiento={movimientosPorSlug?.get(item.personaje.slug) ?? null}
        />
      ))}
    </ol>
  )
}

function RankRowElo({
  rank,
  slug,
  nombre,
  anime,
  elo,
  wins,
  losses,
  history,
  // Guard contra slug undefined; ver CategoriaCard.
  // En este componente el slug viene directo como prop (no anidado en
  // personaje), así que el check va aquí abajo (no en la firma).
  // Destructuramos también imagenUrl + colorDominante del item del ranking
  // para pasárselos al PersonajeImg. Sin estos campos, el componente caía
  // al catálogo módulo-global vía imagenPersonaje(slug) y, si rankedElo se
  // snapshoteó antes de la hidratación, el slug no resolvía a la URL real.
  imagenUrl,
  imagenColorDominante,
}) {
  if (!slug) return null
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const esTop10 = rank <= 10
  const rowTone = esTop10
    ? 'border-yellow-400/30 bg-gradient-to-r from-yellow-500/5 to-surface'
    : 'border-border bg-surface'
  return (
    <li>
      <div
        className={`group flex items-center gap-2 rounded-lg border px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:gap-3 sm:px-5 ${rowTone}`}
      >
        <Link
          to={`/personajes/${slug}`}
          aria-label={`Rank #${rank} — ${nombre} de ${anime}, ELO ${elo}, ${winRate}% win rate`}
          title={`${nombre} de ${anime} · ELO ${elo}`}
          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
        >
          <RankBadge rank={rank} />
          <PersonajeImg
            slug={slug}
            src={imagenUrl}
            nombre={nombre}
            colorDominante={imagenColorDominante}
            alt={nombre}
            loading="lazy"
            className="h-14 w-10 shrink-0 rounded-md object-cover object-top sm:hidden"
          />
          <PersonajeCutImg
            slug={slug}
            alt={nombre}
            loading="lazy"
            sizes="56px"
            className="hidden h-14 w-14 shrink-0 rounded-lg border border-white/10 sm:block"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
                {nombre}
              </p>
              {esTop10 && (
                <span className="hidden shrink-0 rounded border border-yellow-400/40 bg-yellow-500/10 px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-yellow-300 sm:inline">
                  Top 10
                </span>
              )}
            </div>
            <p className="truncate text-[12px] text-fg-muted">{anime}</p>
            {esTop10 && <EloSparkline points={history} className="mt-1" />}
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[12px] text-fg-muted">
              <span className="font-semibold text-emerald-300">{wins}V</span>
              {' · '}
              <span className="font-semibold text-rose-300">{losses}D</span>
            </p>
            <p className="text-[11px] font-semibold text-emerald-300/80">
              {winRate}% WR
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-base font-bold text-gold">{elo}</p>
            <p className="text-[10px] uppercase tracking-wider text-fg-muted">
              ELO
            </p>
          </div>
        </Link>
        <ChallengeLink slug={slug} nombre={nombre} />
      </div>
    </li>
  )
}

function RankRowVotos({ rank, personaje, votos, movimiento = null }) {
  // Guard contra slug undefined; ver CategoriaCard.
  if (!personaje?.slug) return null
  return (
    <li>
      <div className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:gap-3 sm:px-5">
        <Link
          to={`/personajes/${personaje.slug}`}
          aria-label={`Rank #${rank} — ${personaje.nombre} de ${personaje.anime}, ${votos} votos`}
          title={`${personaje.nombre} de ${personaje.anime}`}
          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
        >
          <RankBadge rank={rank} />
          <PersonajeImg
            slug={personaje.slug}
            src={personaje.imagenUrl}
            nombre={personaje.nombre}
            colorDominante={personaje.imagenColorDominante}
            alt={personaje.nombre}
            loading="lazy"
            className="h-14 w-10 shrink-0 rounded-md object-cover object-top sm:hidden"
          />
          <PersonajeCutImg
            slug={personaje.slug}
            alt={personaje.nombre}
            loading="lazy"
            sizes="56px"
            className="hidden h-14 w-14 shrink-0 rounded-lg border border-white/10 sm:block"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
                {personaje.nombre}
              </p>
              {movimiento && <MovimientoBadge movimiento={movimiento} />}
            </div>
            <p className="truncate text-[12px] text-fg-muted">
              {personaje.anime}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-base font-bold text-gold">{votos}</p>
            <p className="text-[10px] uppercase tracking-wider text-fg-muted">
              votos
            </p>
          </div>
        </Link>
        <ChallengeLink slug={personaje.slug} nombre={personaje.nombre} />
      </div>
    </li>
  )
}

function ChallengeLink({ slug, nombre }) {
  return (
    <Link
      to={`/votar?personaje=${encodeURIComponent(slug)}`}
      aria-label={`Retar a ${nombre} en un duelo`}
      title={`Retar a ${nombre}`}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 text-[12px] font-black text-gold transition-colors hover:bg-accent/20"
    >
      <Swords className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Retar</span>
    </Link>
  )
}

function RankBadge({ rank }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${
        rank === 1
          ? 'bg-yellow-500/15 text-yellow-400'
          : rank === 2
            ? 'bg-zinc-400/15 text-zinc-300'
            : rank === 3
              ? 'bg-orange-500/15 text-orange-400'
              : 'bg-surface-alt text-fg-muted'
      }`}
    >
      {rank === 1 ? <Crown className="h-5 w-5" /> : rank}
    </span>
  )
}

/**
 * Badge ↑N / ↓N / = / Nuevo según el movimiento del personaje vs el
 * ranking de hace 7 días.
 */
function MovimientoBadge({ movimiento }) {
  if (movimiento.esNuevo) {
    return (
      <span className="inline-flex shrink-0 items-center rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-gold">
        Nuevo
      </span>
    )
  }
  const delta = movimiento.delta
  if (delta == null || delta === 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center font-mono text-[11px] font-bold text-fg-muted"
        title="Mantiene posición vs hace 7 días"
      >
        =
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-emerald-300"
        title={`Subió ${delta} posiciones vs hace 7 días`}
      >
        ↑{delta}
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-rose-300"
      title={`Bajó ${Math.abs(delta)} posiciones vs hace 7 días`}
    >
      ↓{Math.abs(delta)}
    </span>
  )
}

/**
 * Hub "Sigue moviendo el ranking" — CTAs accionables, no párrafo de
 * links inline como antes.
 */
function HubLinks() {
  return (
    <div className="as-panel-hot relative mt-12 overflow-hidden rounded-2xl p-6 sm:p-7">
      {/* Revision de feedback (2026-05-20): se elimino el kanji decorativo
          duplicado. as-panel-hot ya tiene glow/gradient propio. */}
      <div className="relative max-w-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
          Meta en movimiento
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-fg-strong">
          Sigue empujando el ranking
        </h2>
        <p className="mt-2 text-sm leading-7 text-fg-muted">
          Vota en nuevos duelos, explora personajes o revisa cómo funciona el
          ranking competitivo. Cada voto deja una marca visible en la tabla.
        </p>
      </div>
      <div className="relative mt-5 flex flex-wrap gap-2">
        <Link
          to="/votar"
          className="as-button-primary group inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
        >
          <Swords className="h-4 w-4" />
          Votar ahora
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/personajes"
          className="as-button-ghost inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
        >
          Explorar personajes
        </Link>
        <Link
          to="/metodologia-elo"
          className="as-button-ghost inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
        >
          <HelpCircle className="h-4 w-4" />
          Cómo funciona
        </Link>
      </div>
    </div>
  )
}

function RankingFaq() {
  const faqs = [
    {
      q: '¿Qué mide este ranking?',
      a: 'Mide señales competitivas de la comunidad: votos, actividad reciente y posición estimada. No pretende decidir canon ni poder absoluto.',
    },
    {
      q: '¿Cada cuánto cambia?',
      a: 'Los datos públicos se consultan en vivo y los indicadores de movimiento comparan la posición actual con cortes recientes, como los últimos 7 días.',
    },
    {
      q: '¿Los votos invitados cuentan igual?',
      a: 'Los invitados pueden probar la arena con límite y peso reducido. Crear cuenta permite seguir votando con historial y mejor protección antiabuso.',
    },
    {
      q: '¿Qué diferencia hay entre ELO base y ranking comunitario?',
      a: 'El ELO base es una estimación estática del catálogo. El ranking comunitario se alimenta de votos reales y actividad dentro de AnimeShowdown.',
    },
  ]

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
        FAQ del ranking
      </p>
      <h2 className="mt-1 text-2xl font-black text-fg-strong">
        Cómo leer la tabla sin confundirse
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {faqs.map((item) => (
          <div key={item.q} className="rounded-xl border border-border bg-bg/45 p-4">
            <h3 className="text-base font-bold text-fg-strong">{item.q}</h3>
            <p className="mt-2 text-[13px] leading-6 text-fg-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Tabla HTML semántica con el top 10 ELO local. Sirve a buscadores y
 * usuarios que quieren copy/paste. Ahora vive dentro de un <details>
 * plegable para no competir con el ranking visual.
 */
function TablaExtraible({ rankedElo }) {
  const top10 = rankedElo.slice(0, 10)
  return (
    <details className="group mt-6 rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Datos técnicos
          </h2>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Tabla en formato estándar para copia rápida o referencia.
          </p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180 [details[open]_&]:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Rank
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Personaje
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Anime
                </th>
                <th
                  scope="col"
                  className="py-2 pr-3 text-right font-mono font-semibold tabular-nums"
                >
                  ELO
                </th>
                <th
                  scope="col"
                  className="hidden py-2 pr-3 text-right font-semibold sm:table-cell"
                >
                  W/L
                </th>
              </tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr
                  key={p.slug}
                  className="border-b border-border/60 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 font-mono font-semibold text-fg-strong tabular-nums"
                  >
                    {i + 1}
                  </th>
                  <td className="py-2 pr-3 text-fg-strong">
                    <Link
                      to={`/personajes/${p.slug}`}
                      className="hover:text-gold hover:underline"
                    >
                      {p.nombre}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-fg-muted">{p.anime}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-gold">
                    {p.elo}
                  </td>
                  <td className="hidden py-2 pr-3 text-right font-mono text-fg-muted tabular-nums sm:table-cell">
                    {p.wins}/{p.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

export default RankingPage
