import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
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
import {
  CATEGORIAS,
  MIN_PARA_SECCION,
} from '../data/personajes-tags'
import { AppLink } from '../components/AppLink'
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
import {
  useAnimesConVotos,
  useCategoriasConVotos,
  useEloCanonico,
  useRankingDeltaSubscription,
  useRankingMovimientos,
  useRankingSegmentado,
} from '../hooks/useRanking'
import { getStatsPersonaje } from '../lib/personajes-core'
import { markPersonajeHero } from '../lib/viewTransitions'
import { INTENCIONES } from '../data/voto-intenciones'
import { useQueryState } from '../hooks/useQueryState'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { shareWithToast } from '../lib/shareWithToast'
import { recordDailyRankingView } from '../lib/dailyProgress'
import EditorialRankingsStrip from '../features/ranking/components/EditorialRankingsStrip'
import EloExplainer from '../features/ranking/components/EloExplainer'
import MoversStrip from '../features/ranking/components/MoversStrip'
import RankingPodium from '../features/ranking/components/RankingPodium'
import { ANIMES_KANJI } from '../data/animes-kanji'
import { getAnimesCatalogo, slugifyAnime } from '../lib/animes'
import { endpoints } from '../lib/api'
import { RankRowVotos } from '../features/ranking/components/RankingRows'
import { ArenaCommandRoom } from '../features/ranking/components/ArenaCommandRoom'
import FederationTable from '../features/ranking/components/FederationTable'
import RankingTabs from '../features/ranking/components/RankingTabs'
import RankingTechnicalTable from '../features/ranking/components/RankingTechnicalTable'
import { RANKING_TABS } from '../features/ranking/ranking-tabs'
import { useFlipList } from '../features/ranking/useFlipList'
import {
  crearCatalogoIndex,
  filtrarRankingElo,
} from '../features/personajes/CatalogoPersonajes/catalogo-index'

const RANKING_BACKEND_LIMIT = 100
const OBSERVATORIO_TOP = 60

// El Observatorio es una pieza de lienzo pesada (pan/zoom, 60 estrellas memo +
// SVG): carga diferida en su propio chunk para no tocar el bundle inicial.
const MetaObservatory = lazy(() =>
  import('../features/ranking/observatory/MetaObservatory'),
)

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

function RankingPage() {
  useRankingDeltaSubscription()
  const [searchParams] = useSearchParams()
  const {
    personajes: catalogoPersonajes,
    isLoading: isCatalogLoading,
  } = usePersonajesCatalogo()
  // ELO canónico real del backend (semilla por popularidad +15% + votos). La
  // pestaña ELO lo usa en vez del sintético; cae al sintético mientras carga.
  const { data: eloCanonico } = useEloCanonico()
  const catalogoIndex = useMemo(() => {
    const getStats = eloCanonico
      ? (slug) => {
          const elo = eloCanonico[slug]
          return elo != null
            ? { elo, wins: 0, losses: 0, _sintetico: false }
            : getStatsPersonaje(slug)
        }
      : undefined
    return crearCatalogoIndex(catalogoPersonajes, getStats ? { getStats } : undefined)
  }, [catalogoPersonajes, eloCanonico])
  const { rankedElo, animeFilterOptions } = catalogoIndex
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
  // La tabla técnica extraíble por crawlers expone el top por VOLUMEN de
  // votos del backend (no la pestaña ELO), para datos de actividad verificables.
  const rankingAllQuery = useRankingSegmentado({
    periodo: 'all',
    limit: RANKING_BACKEND_LIMIT,
  })
  const movimientosSemanaQuery = useRankingMovimientos({
    limit: RANKING_BACKEND_LIMIT,
    dias: 7,
  })
  const { data: rankingRealTop } = rankingAllQuery
  // Default inteligente: sin pestaña elegida a mano, lideramos con "ELO"
  // (siempre lleno, 1086) mientras el Histórico de votos reales esté escaso, para
  // no recibir al usuario con una tabla casi vacía. El default '' hace
  // que cualquier elección (incluida "Histórico"=all) quede explícita en la URL
  // y se respete; los crawlers siguen extrayendo datos reales de la tabla técnica.
  //
  // La decisión se toma UNA vez en el mount (con lo que haya en caché).
  // Antes se recalculaba al resolver el fetch del histórico y la pestaña
  // saltaba de ELO a Histórico delante del usuario, reemplazando la lista
  // entera que ya estaba leyendo.
  const UMBRAL_HISTORICO = 10
  const [queryTab, setTab] = useQueryState('tab', '')
  const tabExplicito = RANKING_TABS.some((item) => item.id === queryTab)
  const [tabPorDefecto] = useState(() =>
    Array.isArray(rankingRealTop) && rankingRealTop.length >= UMBRAL_HISTORICO
      ? 'all'
      : 'elo',
  )
  const tab = tabExplicito ? queryTab : tabPorDefecto

  // Sala de mando (pestaña 'arena'): el pulso en vivo de la arena como mapa de
  // mareas de tinta. Solo poll cuando la pestaña está activa. Territorios = top
  // animes por presencia en catálogo; gotas doradas = top-10 ELO; kanji por slug.
  const { data: votosArena = [] } = useQuery({
    queryKey: ['ranking', 'arena', 'votos-recientes', 20],
    queryFn: () => endpoints.votosRecientes({ limit: 20 }),
    enabled: tab === 'arena',
    refetchInterval: tab === 'arena' ? 45000 : false,
    staleTime: 30000,
  })
  const arenaCatalogo = useMemo(
    () => getAnimesCatalogo(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const arenaTopSlugs = useMemo(
    () => rankedElo.slice(0, 10).map((p) => p.slug),
    [rankedElo],
  )
  const arenaKanjiMap = useMemo(() => {
    const m = {}
    for (const a of arenaCatalogo) {
      const k = ANIMES_KANJI[a.anime]
      if (k) m[a.slug] = k
    }
    return m
  }, [arenaCatalogo])

  // Hora de consulta congelada al montar (lazy puro). useState en vez de
  // useMemo([]): React puede descartar y recomputar un memo; el inicializador
  // lazy garantiza un único new Date().
  const [consultadoA] = useState(() =>
    new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  )

  // Observatorio (pestaña 'observatorio'): proyecta el top del ELO canónico como
  // cielo nocturno. Adaptamos rankedElo al contrato de la pieza {slug, nombre,
  // anime, elo, posicion}. La posición es el orden por ELO (1 = top).
  const observatorioRanking = useMemo(
    () =>
      rankedElo.slice(0, OBSERVATORIO_TOP).map((p, i) => ({
        slug: p.slug,
        nombre: p.nombre,
        anime: p.anime,
        elo: p.elo,
        posicion: i + 1,
      })),
    [rankedElo],
  )
  const [fechaCielo] = useState(() =>
    new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  )
  const compartirRanking = async () => {
    const top5 = rankedElo.slice(0, 5)
    if (top5.length === 0) {
      toast.error('El ranking todavía está cargando')
      return
    }
    const resumen = top5
      .map((p, index) => `${index + 1}. ${p.nombre} (${p.anime}) · ${p.elo} ELO`)
      .join('\n')
    await shareWithToast(
      {
        title: 'Top anime en AnimeShowdown',
        text: `Mi top 5 por ELO en AnimeShowdown ahora mismo:\n${resumen}\n\nVota y cambia la tabla.`,
        url: '/ranking',
      },
      {
        nativeSuccess: 'Ranking compartido',
        clipboardSuccess: 'Ranking copiado',
        errorTitle: 'No se pudo compartir el ranking',
        errorDescription: 'Copia el top manualmente.',
      },
    )
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
            <p className="mb-3 text-[12px] font-bold text-gold">
              Mueve la tabla
            </p>
            <p className="text-sm leading-relaxed text-fg-muted">
              La tabla cambia con cada duelo. Entra a votar si quieres mover el
              podio antes del próximo corte semanal.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/45 px-3 py-1.5 text-[11px] font-semibold text-fg-muted">
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
          El ranking de AnimeShowdown ordena personajes por su ELO (popularidad
          del catálogo ajustada por los votos) y por actividad de la comunidad. Úsalo
          para detectar cambios de meta, comparar universos y saltar a duelos
          donde tu voto puede mover posiciones. No es canon oficial: es una
          fotografía viva de preferencias fandom dentro de la plataforma.
        </p>

        {/* Tabs + lista PRIMERO (E2): el ranking es lo que el usuario viene a
            ver, así que va justo bajo el hero, por encima del explainer, el
            meta report, los movers y los rankings editoriales. */}
        <RankingTabs activo={tab} onChange={setTab} />

        {/* Panel del patrón ARIA tabs: las pestañas de RankingTabs lo apuntan
            con aria-controls; aria-labelledby cuelga del tab activo (single
            panel que intercambia contenido). Sin tabIndex porque su contenido
            ya es focusable (listas con enlaces), por APG. */}
        <div
          className="mt-6"
          role="tabpanel"
          id="rankingtabpanel"
          aria-labelledby={`rankingtab-${tab}`}
        >
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
          {tab === 'observatorio' &&
            (isCatalogLoading && observatorioRanking.length === 0 ? (
              // Deep-link en frío a ?tab=observatorio: el catálogo aún hidrata.
              // Skeleton en vez de un cielo vacío (coherente con las otras pestañas).
              <RankingSkeletonGrid />
            ) : (
              <Suspense fallback={<RankingSkeletonGrid />}>
                <MetaObservatory
                  ranking={observatorioRanking}
                  hrefPersonaje={(slug) => `/personajes/${slug}`}
                  fecha={fechaCielo}
                  onVolverTabla={() => setTab('elo')}
                />
              </Suspense>
            ))}
          {tab === 'categorias' && (
            <CategoriasYIntencionTab
              catalogoIndex={catalogoIndex}
              isCatalogLoading={isCatalogLoading}
            />
          )}
          {tab === 'all' && (
            <ListaBackend
              periodo="all"
              preloadedRankingQuery={rankingAllQuery}
              preloadedMovimientosQuery={movimientosSemanaQuery}
            />
          )}
          {tab === 'mes' && <ListaBackend periodo="mes" />}
          {tab === 'anime' && (
            <PorAnime key={`anime:${initialAnimeFilter}`} initialAnime={initialAnimeFilter} />
          )}
          {tab === 'arena' && (
            <ArenaCommandRoom
              votos={votosArena}
              catalogo={arenaCatalogo}
              topSlugs={arenaTopSlugs}
              kanjiMap={arenaKanjiMap}
            />
          )}
        </div>

        <div className="mt-10">
          <EloExplainer />
        </div>

        {/* Meta report narrativo: lee los endpoints que ya carga la página y
            React Query deduplica las requests. */}
        <RankingMetaReport
          rankingQuery={rankingAllQuery}
          movimientosQuery={movimientosSemanaQuery}
        />
        {/* MoversStrip: los 3 personajes con más movimiento de la semana.
            Solo aparece si hay movimientos. */}
        <MoversStrip movimientosQuery={movimientosSemanaQuery} />

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
function CategoriasYIntencionTab({ catalogoIndex, isCatalogLoading }) {
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

  // Roving tabindex + flechas para las 2 pestañas (patrón APG de PerfilTabs).
  const tabRefs = useRef([])
  const handleTabKey = (e, idx) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const activadores = [activarArquetipo, activarIntencion]
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : (idx + 1) % 2
    activadores[next]()
    tabRefs.current[next]?.focus()
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
          ref={(el) => { tabRefs.current[0] = el }}
          type="button"
          role="tab"
          id="cattab-arquetipo"
          aria-selected={modo === 'arquetipo'}
          tabIndex={modo === 'arquetipo' ? 0 : -1}
          onClick={activarArquetipo}
          onKeyDown={(e) => handleTabKey(e, 0)}
          className={`${pestañaBase} ${
            modo === 'arquetipo'
              ? 'bg-accent text-white'
              : 'text-fg-muted hover:text-fg-strong'
          }`}
        >
          Por arquetipo
        </button>
        <button
          ref={(el) => { tabRefs.current[1] = el }}
          type="button"
          role="tab"
          id="cattab-intencion"
          aria-selected={modo === 'intencion'}
          tabIndex={modo === 'intencion' ? 0 : -1}
          onClick={activarIntencion}
          onKeyDown={(e) => handleTabKey(e, 1)}
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
          catalogoIndex={catalogoIndex}
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

function ListaCategoriasOtaku({ catalogoIndex, isCatalogLoading }) {
  const secciones = useMemo(() => {
    const rankedByElo = catalogoIndex.sortedBy?.elo_desc ?? catalogoIndex.rankedElo
    return CATEGORIAS
      .map((cat) => {
        const personajesCat = rankedByElo
          .filter((p) => p.categorias.includes(cat.id))
          .slice(0, 10)
        return { ...cat, personajes: personajesCat }
      })
      .filter((s) => s.personajes.length >= MIN_PARA_SECCION)
  }, [catalogoIndex])

  if (isCatalogLoading && catalogoIndex.items.length === 0) {
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
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${tonoClase}`}
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
  const retratoRef = useRef(null)
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
    /* contentVisibility: las categorías pintan 100+ cards de golpe; el
       navegador se salta layout/paint de las que quedan fuera de viewport.
       El fondo va en el PROPIO li (el background de un elemento con c-v sí
       se pinta aunque el contenido se salte): el hueco durante el fling se
       ve como slot de card oscuro, nunca como vacío. */
    <li
      className="rounded-lg bg-surface/40"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' }}
    >
      <AppLink
        to={`/personajes/${personaje.slug}`}
        // El retrato de la card viaja hasta el hero del detalle (morph).
        onViewTransitionStart={() => markPersonajeHero(retratoRef.current)}
        className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 sm:p-3"
      >
        <div ref={retratoRef} className="relative aspect-[2/3] overflow-hidden rounded-lg bg-bg">
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
            sizes="(min-width: 1024px) 190px, (min-width: 640px) 30vw, 42vw"
            fit="contain"
            position="center"
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
      </AppLink>
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
    return filtrarRankingElo(rankedElo, { normalizedSearch, animeFilter })
  }, [rankedElo, normalizedSearch, animeFilter])

  // Honestidad de cold-start: mientras el ELO canónico del backend no ha
  // llegado, el orden es la SEMILLA por popularidad (1500 + popularidad·7,
  // _sintetico:true), no votos reales. Si los primeros puestos son sintéticos
  // lo rotulamos sin esconder el ranking. En cuanto entra el ELO del backend
  // (_sintetico:false) la nota desaparece sola.
  const esSembrado = useMemo(
    () => rankedElo.slice(0, 10).some((p) => p?._sintetico),
    [rankedElo],
  )

  const rankingSlices = useMemo(() => {
    const top100 = filtered.slice(0, 100)
    return {
      filteredTop100: top100,
      podio: top100.slice(0, 3),
      resto: top100.slice(3),
    }
  }, [filtered])
  const { filteredTop100, podio, resto } = rankingSlices
  const hayFiltros = Boolean(search) || Boolean(animeFilter)
  const visibleRankingRows = useMemo(
    () => (hayFiltros ? filteredTop100 : resto),
    [filteredTop100, hayFiltros, resto],
  )
  const top5ShareText = useMemo(
    () =>
      filtered
        .slice(0, 5)
        .map((p, index) => `${index + 1}. ${p.nombre} (${p.anime}) · ${p.elo} ELO`)
        .join('\n'),
    [filtered],
  )
  // Mapa nombre→slug de los universos del podio: brandImage() resuelve la
  // escena de fondo con el slug canónico (los nombres del catálogo ya
  // slugifican 1:1 con los assets de marca; sin asset, el podio degrada a
  // scrim sin escena).
  const animeSlugsPodio = useMemo(
    () => Object.fromEntries(podio.map((p) => [p.anime, slugifyAnime(p.anime)])),
    [podio],
  )
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
    const scope = animeFilter
      ? ` de ${animeFilter}`
      : searchTrimmed
        ? ` para "${searchTrimmed}"`
        : ''

    await shareWithToast(
      {
        title: `Ranking anime${scope}`,
        text: `Mi top${scope} en AnimeShowdown:\n${top5ShareText}\n\nÁbrelo y dime a quién subirías votando.`,
        url,
      },
      {
        nativeSuccess: 'Vista compartida',
        clipboardSuccess: 'Vista copiada',
        errorTitle: 'No se pudo compartir la vista',
        errorDescription: 'Copia el ranking manualmente.',
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Nota: esta pestaña ordena por el ELO canónico (semilla por popularidad
          +15% femenino + ajuste por votos, recalculado periódicamente). Las
          pestañas por volumen de votos en vivo son Histórico / Este mes. */}
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-[12px] leading-5 text-fg-muted">
        <strong className="font-bold text-fg-strong">ELO.</strong>{' '}
        Arranca de la popularidad del catálogo y tus votos lo ajustan (se
        recalcula cada pocos minutos). Para el ranking por volumen de votos en
        vivo mira{' '}
        <Link to="/ranking?tab=all" className="font-semibold text-gold underline">
          Histórico
        </Link>{' '}
        o{' '}
        <Link to="/ranking?tab=mes" className="font-semibold text-gold underline">
          Este mes
        </Link>
        .
      </p>
      {esSembrado && (
        <p className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-[12px] leading-5 text-gold">
          <strong className="font-bold">Ranking inicial.</strong>{' '}
          Todavía sembrado por popularidad del catálogo, no por votos reales —
          tus votos empiezan a moverlo en cuanto entras a la arena.
        </p>
      )}
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
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-alt px-3.5 py-2 text-[12px] font-black text-fg-strong transition-colors hover:border-accent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir vista
        </button>
      </div>

      {/* El Registro de la Federación: la <table> con placas lacadas trae
          su propio FLIP (cinta + delta sobre live-flip), skeleton .skl y
          vacío honesto — reemplaza al <ol>+RankRowElo y a useFlipList aquí.
          scrollMode="page": /ranking conserva el scroll de documento. */}
      {isCatalogLoading && rankedElo.length === 0 ? (
        <FederationTable items={[]} loading scrollMode="page" />
      ) : filtered.length === 0 ? (
        <FederationTable
          items={[]}
          vacioMotivo="busqueda"
          scrollMode="page"
          onClearSearch={() => {
            setSearch('')
            setAnimeFilter('')
          }}
        />
      ) : (
        <>
          {/* Podio Top 3 — solo cuando no hay filtros activos. Si el
              usuario filtra perdería sentido ver "Top 3 global" mezclado
              con un subconjunto. */}
          {!hayFiltros && podio.length === 3 && (
            <RankingPodium
              top3={podio}
              kanjiPorAnime={ANIMES_KANJI}
              animeSlugPorNombre={animeSlugsPodio}
            />
          )}

          {hayFiltros && (
            <p className="text-[12px] text-fg-muted">
              Mostrando{' '}
              <strong className="text-fg-strong">{filtered.length}</strong>{' '}
              personajes que coinciden
              {animeFilter && <> en {animeFilter}</>}.
            </p>
          )}

          <FederationTable
            items={visibleRankingRows}
            rankBase={hayFiltros ? 1 : 4}
            scrollMode="page"
          />
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

function ListaBackend({
  periodo,
  preloadedRankingQuery,
  preloadedMovimientosQuery,
}) {
  const usaRankingPrecargado = periodo === 'all' && Boolean(preloadedRankingQuery)
  const rankingQuery = useRankingSegmentado({
    periodo,
    limit: RANKING_BACKEND_LIMIT,
    enabled: !usaRankingPrecargado,
  })
  const data = usaRankingPrecargado ? preloadedRankingQuery.data : rankingQuery.data
  const isLoading = usaRankingPrecargado ? preloadedRankingQuery.isLoading : rankingQuery.isLoading
  const isError = usaRankingPrecargado ? preloadedRankingQuery.isError : rankingQuery.isError
  // Solo cargamos movimientos en el tab "ELO actual" (periodo=all): es
  // el único donde "subir/bajar vs hace 7d" tiene sentido. En mes ya
  // tienes la ventana corta como contexto.
  const usaMovimientosPrecargados = periodo === 'all' && Boolean(preloadedMovimientosQuery)
  const movimientosQuery = useRankingMovimientos({
    limit: RANKING_BACKEND_LIMIT,
    dias: 7,
    enabled: periodo === 'all' && !usaMovimientosPrecargados,
  })
  const movimientos = usaMovimientosPrecargados
    ? preloadedMovimientosQuery.data
    : movimientosQuery.data
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
  const animeOptions = useMemo(
    () => [
      { value: '', label: 'Elige un anime' },
      ...(animes ?? []).map((item) => ({ value: item, label: item })),
    ],
    [animes],
  )
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
    await shareWithToast(
      {
        title: `Ranking de ${anime}`,
        text: `Ranking interno de ${anime} en AnimeShowdown:\n${top5}\n\nVota personajes de ${anime} y mueve este top.`,
        url: `/ranking?tab=anime&anime=${encodeURIComponent(anime)}`,
      },
      {
        nativeSuccess: 'Ranking compartido',
        clipboardSuccess: 'Ranking copiado',
        errorTitle: 'No se pudo compartir el ranking',
        errorDescription: 'Copia el top manualmente.',
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <span className="text-[12px] font-semibold text-fg-muted">
          Anime:
        </span>
        <BrandSelect
          value={anime}
          onChange={setAnime}
          ariaLabel="Elegir anime para ranking interno"
          disabled={cargandoAnimes}
          className="min-w-0 flex-1"
          placeholder="Elige un anime"
          options={animeOptions}
        />
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
  // Tabla viva: cada voto del WS reordena la caché y la fila desliza a su
  // nueva posición (FLIP manual; el odómetro y el flash viven en la fila).
  const listRef = useRef(null)
  const flipOrder = useMemo(
    () =>
      Array.isArray(items)
        ? items.map((item) => item?.personaje?.slug).filter(Boolean)
        : [],
    [items],
  )
  useFlipList(listRef, flipOrder)
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
    <ol ref={listRef} className="flex flex-col gap-2">
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
        <p className="text-[11px] font-black text-gold">
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
      q: '¿Qué diferencia hay entre la pestaña ELO y Histórico / Este mes?',
      a: 'El ELO ordena por posición canónica: arranca de la popularidad del catálogo y los votos lo ajustan (se recalcula cada pocos minutos). Histórico y Este mes ordenan por volumen de votos reales en una ventana de tiempo, en vivo.',
    },
  ]

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-[11px] font-black text-gold">
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
