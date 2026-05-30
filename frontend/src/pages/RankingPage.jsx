import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  HelpCircle,
  Search,
  Share2,
  Swords,
  Trophy,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getStatsPersonaje } from '../lib/personajes-core'
import {
  CATEGORIAS,
  MIN_PARA_SECCION,
  getPersonajesPorCategoria,
} from '../data/personajes-tags'
import PersonajeImg from '../components/PersonajeImg'
import BrandSelect from '../components/BrandSelect'
import RankingMetaReport from '../components/RankingMetaReport'
import PersonalRankingTeaser from '../components/PersonalRankingTeaser'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { BRAND_VISUALS } from '../data/visual-assets'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { endpoints } from '../lib/api'
import {
  useAnimesConVotos,
  useCategoriasConVotos,
  useRankingDeltaSubscription,
  useRankingMovimientos,
  useRankingSegmentado,
} from '../hooks/useRanking'
import { INTENCIONES } from '../data/voto-intenciones'
import { useQueryState } from '../hooks/useQueryState'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { shareOrCopy } from '../lib/share'
import { recordDailyRankingView, recordDailyShare } from '../lib/dailyProgress'
import EditorialRankingsStrip from '../features/ranking/components/EditorialRankingsStrip'
import EloExplainer from '../features/ranking/components/EloExplainer'
import MoversStrip from '../features/ranking/components/MoversStrip'
import RankingPodium from '../features/ranking/components/RankingPodium'
import { RankRowElo, RankRowVotos } from '../features/ranking/components/RankingRows'
import RankingTabs from '../features/ranking/components/RankingTabs'
import RankingTechnicalTable from '../features/ranking/components/RankingTechnicalTable'
import { RANKING_TABS } from '../features/ranking/ranking-tabs'

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
  // La tabla técnica (extraíble por crawlers/LLMs) debe exponer SOLO datos
  // reales: top por votos del backend, nunca el ELO base sintético.
  const { data: rankingRealTop } = useRankingSegmentado({ periodo: 'all', limit: 10 })
  // Default inteligente: sin pestaña elegida a mano, lideramos con "ELO base"
  // (siempre lleno, 1086) mientras el Histórico de votos reales esté escaso, para
  // no recibir al usuario con una tabla casi vacía. Cuando el Histórico acumule
  // señal real (>= UMBRAL con votos), pasará a liderar él solo. El default '' hace
  // que cualquier elección (incluida "Histórico"=all) quede explícita en la URL
  // y se respete; los crawlers siguen extrayendo datos reales de la tabla técnica.
  const UMBRAL_HISTORICO = 10
  const [queryTab, setTab] = useQueryState('tab', '')
  const tabExplicito = RANKING_TABS.some((item) => item.id === queryTab)
  const historicoConSenal =
    Array.isArray(rankingRealTop) && rankingRealTop.length >= UMBRAL_HISTORICO
  const tab = tabExplicito ? queryTab : historicoConSenal ? 'all' : 'elo'
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
            <div className="as-panel rounded-2xl border-gold/35 p-5">
            {/* Antes esto era un segundo "Meta report" que duplicaba el
                componente RankingMetaReport de abajo. Lo reconvertimos en una
                caja-CTA para mover la tabla (E2). */}
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-gold">
              Mueve la tabla
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
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/20"
            >
              Votar duelos abiertos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          }
        />

        <p className="mb-6 max-w-3xl text-sm leading-7 text-fg-muted">
          El ranking de AnimeShowdown ordena personajes por actividad competitiva
          de la comunidad y por ELO base cuando todavía falta señal real. Úsalo
          para detectar cambios de meta, comparar universos y saltar a duelos
          donde tu voto puede mover posiciones. No es canon oficial: es una
          fotografía viva de preferencias fandom dentro de la plataforma.
        </p>

        {/* Tabs + lista PRIMERO (E2): el ranking es lo que el usuario viene a
            ver, así que va justo bajo el hero, por encima del explainer, el
            meta report, los movers y los rankings editoriales. */}
        <RankingTabs activo={tab} onChange={setTab} />

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
            <CategoriasYIntencionTab
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

        <div className="mt-10">
          <EloExplainer />
        </div>

        {/* Meta report narrativo: lee los endpoints que ya carga la página y
            React Query deduplica las requests. */}
        <RankingMetaReport />
        {/* MoversStrip: los 3 personajes con más movimiento de la semana.
            Solo aparece si hay movimientos. */}
        <MoversStrip />

        <PersonalRankingTeaser className="mt-6" />

        <EditorialRankingsStrip />

        <HubLinks />

        <RankingFaq />

        <RankingTechnicalTable items={rankingRealTop} />
      </div>
    </VisualPageShell>
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
/**
 * Pestaña "Categorías" con dos ejes DISTINTOS, rotulados para no confundirlos
 * (feature #15):
 *   - "Por arquetipo": qué ES el personaje (héroe, villano, waifu…). Data
 *     local de personajes-tags.js, ordenado por ELO. Es lo de siempre.
 *   - "Por intención de voto": POR QUÉ vota la gente (poder, diseño…). Votos
 *     reales del backend, segmentados por categoría.
 * El modo intención se refleja en la URL como ?intencion=<id> (deep-linkable,
 * back-compat: sin el param se muestra arquetipo).
 */
function CategoriasYIntencionTab({ catalogoPersonajes, isCatalogLoading }) {
  const [intencion, setIntencion] = useQueryState('intencion', '')
  const { data: categoriasDisp } = useCategoriasConVotos()
  const disponibles = useMemo(
    () =>
      INTENCIONES.filter(
        (i) => Array.isArray(categoriasDisp) && categoriasDisp.includes(i.id),
      ),
    [categoriasDisp],
  )
  // Modo derivado del deep-link: ?intencion=X entra directo en modo intención.
  const [modo, setModo] = useState(intencion ? 'intencion' : 'arquetipo')

  const activarArquetipo = () => {
    setModo('arquetipo')
    setIntencion('')
  }
  const activarIntencion = () => {
    setModo('intencion')
    if (!intencion && disponibles.length > 0) setIntencion(disponibles[0].id)
  }

  const pestañaBase =
    'flex-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors'
  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Tipo de categoría"
        className="flex gap-1 rounded-xl border border-border bg-surface p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'arquetipo'}
          onClick={activarArquetipo}
          className={`${pestañaBase} ${
            modo === 'arquetipo'
              ? 'bg-accent text-white'
              : 'text-fg-muted hover:text-fg-strong'
          }`}
        >
          Por arquetipo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'intencion'}
          onClick={activarIntencion}
          className={`${pestañaBase} ${
            modo === 'intencion'
              ? 'bg-accent text-white'
              : 'text-fg-muted hover:text-fg-strong'
          }`}
        >
          Por intención de voto
        </button>
      </div>

      {modo === 'arquetipo' ? (
        <ListaCategoriasOtaku
          catalogoPersonajes={catalogoPersonajes}
          isCatalogLoading={isCatalogLoading}
        />
      ) : (
        <ListaIntenciones
          intencion={intencion}
          setIntencion={setIntencion}
          disponibles={disponibles}
        />
      )}
    </div>
  )
}

/**
 * Ranking por intención de voto (feature #15): top de personajes según POR QUÉ
 * los votó la gente. Pills de las intenciones CON votos + lista de votos reales.
 */
function ListaIntenciones({ intencion, setIntencion, disponibles }) {
  const { data, isLoading, isError } = useRankingSegmentado({
    categoria: intencion,
    periodo: 'all',
    limit: 100,
    enabled: Boolean(intencion),
  })

  if (disponibles.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-alt/40 p-6 text-center text-[13px] text-fg-muted">
        Aún nadie ha votado eligiendo un motivo. Vota un duelo y elige{' '}
        <strong>por qué</strong> para estrenar estos rankings.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-fg-muted">
        Rankings según <strong>por qué</strong> vota la gente — distinto del
        arquetipo del personaje. Cada motivo tiene su propio top.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Intención de voto">
        {disponibles.map((item) => {
          const activo = item.id === intencion
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={activo}
              onClick={() => setIntencion(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                activo
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface text-fg-muted hover:text-fg-strong'
              }`}
            >
              <span aria-hidden="true">{item.emoji}</span>
              {item.label}
            </button>
          )
        })}
      </div>
      <ListaVotosCommon items={data} isLoading={isLoading} isError={isError} />
    </div>
  )
}

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
    sky: 'text-arc-hero border-arc-hero/40 bg-arc-hero/10',
    rose: 'text-arc-villain border-arc-villain/40 bg-arc-villain/10',
    pink: 'text-arc-waifu border-arc-waifu/40 bg-arc-waifu/10',
    violet: 'text-arc-husbando border-arc-husbando/40 bg-arc-husbando/10',
    amber: 'text-arc-protagonist border-arc-protagonist/40 bg-arc-protagonist/10',
    orange: 'text-arc-rival border-arc-rival/40 bg-arc-rival/10',
    emerald: 'text-arc-mentor border-arc-mentor/40 bg-arc-mentor/10',
    purple: 'text-arc-antihero border-arc-antihero/40 bg-arc-antihero/10',
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
    sky: 'bg-arc-hero/20 text-arc-hero',
    rose: 'bg-arc-villain/20 text-arc-villain',
    pink: 'bg-arc-waifu/20 text-arc-waifu',
    violet: 'bg-arc-husbando/20 text-arc-husbando',
    amber: 'bg-arc-protagonist/20 text-arc-protagonist',
    orange: 'bg-arc-rival/20 text-arc-rival',
    emerald: 'bg-arc-mentor/20 text-arc-mentor',
    purple: 'bg-arc-antihero/20 text-arc-antihero',
  }
  const rankTono = RANK_TONO[tono] ?? RANK_TONO.sky
  return (
    <li>
      <Link
        to={`/personajes/${personaje.slug}`}
        className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 sm:p-3"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-bg">
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
            className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-1 font-mono text-[10px] font-extrabold ${rankTono}`}
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
      {/* Banner de honestidad: esta pestaña ordena por ELO base (estimación
          por popularidad), no por votos reales. Dirige a las pestañas con
          datos reales para que nadie lea estos números como competitivos. */}
      <p className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-[12px] leading-5 text-warning/90">
        <strong className="font-bold text-warning">ELO base · estimado.</strong>{' '}
        Este orden usa una estimación por popularidad del catálogo, no votos
        reales (no se mueve con tus votos). Para el ranking competitivo por
        votos mira{' '}
        <Link to="/ranking?tab=all" className="font-semibold text-gold underline">
          Histórico
        </Link>{' '}
        o{' '}
        <Link to="/ranking?tab=mes" className="font-semibold text-gold underline">
          Este mes
        </Link>
        .
      </p>
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
        <BrandSelect
          value={animeFilter}
          onChange={setAnimeFilter}
          ariaLabel="Filtrar por anime"
          className="w-full min-w-0"
          options={[
            { value: '', label: 'Anime: Todos' },
            ...animeFilterOptions.slice(1).map((a) => ({ value: a, label: a })),
          ]}
        />
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
        <EmptyState scene
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
        </EmptyState>
      ) : (
        <>
          {/* Podio Top 3 — solo cuando no hay filtros activos. Si el
              usuario filtra perdería sentido ver "Top 3 global" mezclado
              con un subconjunto. */}
          {!hayFiltros && podio.length === 3 && (
            <RankingPodium top3={podio} historyBySlug={eloHistoryTop10 ?? {}} />
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
          className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
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
      <EmptyState scene
        icon={Clock}
        title="Sin actividad en esta ventana"
        action={{ to: '/votar', label: 'Votar ahora' }}
      >
        Todavía no hay votos suficientes para esta ventana de tiempo. El
        ranking se rellena cuando hay tráfico real — sé tú el primero.
      </EmptyState>
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
          <div key={item.q} className="rounded-2xl border border-border bg-bg/45 p-4">
            <h3 className="text-base font-bold text-fg-strong">{item.q}</h3>
            <p className="mt-2 text-[13px] leading-6 text-fg-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default RankingPage
