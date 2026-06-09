import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Swords,
  TrendingUp,
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import Dialog from '../components/Dialog'
import PersonajeCard from '../components/PersonajeCard'
import BrandSelect from '../components/BrandSelect'
import PersonajeImg from '../components/PersonajeImg'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'
import { personajes } from '../lib/personajes-core'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useSound } from '../contexts/SoundContext'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import EmptyState from '../components/EmptyState'
import { BRAND_VISUALS } from '../data/visual-assets'
import { endpoints } from '../lib/api'
import { useCatalogoPersonajes } from '../hooks/useCatalogoPersonajes'
import { useQueryState } from '../hooks/useQueryState'
import { RASGOS_OTAKU } from '../data/personajes-tags'
import CatalogoSkeletonGrid from '../features/personajes/CatalogoPersonajes/CatalogoSkeletonGrid'
import HighlightMatch from '../features/personajes/CatalogoPersonajes/HighlightMatch'
import MiniHeroStat from '../features/personajes/CatalogoPersonajes/MiniHeroStat'
import PersonajeListRow from '../features/personajes/CatalogoPersonajes/PersonajeListRow'
import {
  DEFAULT_SORT,
  DEFAULT_VIEW,
  parseOptionalInt,
  sortLabels,
} from '../features/personajes/CatalogoPersonajes/catalogo-config'
import {
  crearCatalogoIndex,
  filtrarCatalogo,
} from '../features/personajes/CatalogoPersonajes/catalogo-index'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PersonajesPage() {
  const {
    data: catalogoRemoto,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    refetch,
  } = useCatalogoPersonajes()
  const catalogoPersonajes = useMemo(() => {
    if (!Array.isArray(catalogoRemoto) || catalogoRemoto.length === 0) {
      return personajes
    }
    return catalogoRemoto.map((p) => ({
      ...p,
      imagen: p.imagenUrl ?? p.imagen,
    }))
  }, [catalogoRemoto])
  const shouldShowCatalogLoading = isCatalogLoading && catalogoPersonajes.length === 0
  const shouldShowCatalogError = isCatalogError && catalogoPersonajes.length === 0
  const catalogoIndex = useMemo(
    () => crearCatalogoIndex(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const { animes, eloBounds, rankPorSlug } = catalogoIndex

  const { play } = useSound()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useQueryState('q', '')
  const [animeFilter, setAnimeFilter] = useState(
    () => searchParams.get('anime') || null,
  )
  const [tagFilter, setTagFilter] = useState(
    () => searchParams.get('tag') || null,
  )
  const [sort, setSort] = useState(
    () => (sortLabels[searchParams.get('sort')] ? searchParams.get('sort') : DEFAULT_SORT),
  )
  const [view, setView] = useState(
    () => (searchParams.get('view') === 'list' ? 'list' : DEFAULT_VIEW),
  )
  const [eloMin, setEloMin] = useState(() => parseOptionalInt(searchParams.get('eloMin')))
  const [eloMax, setEloMax] = useState(() => parseOptionalInt(searchParams.get('eloMax')))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(null)
  const deferredSearch = useDeferredValue(search)
  const autocompleteQuery = deferredSearch.trim()
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsQuery, setSuggestionsQuery] = useState('')
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(null)
  const visibleSuggestions = suggestionsQuery === autocompleteQuery ? suggestions : []
  const visibleSuggestionsError =
    suggestionsQuery === autocompleteQuery ? suggestionsError : null
  const normalizedSearch = useMemo(
    () => deferredSearch.trim().toLowerCase(),
    [deferredSearch],
  )

  // /personajes con 730 cards renderizaba ~9.8k nodos
  // DOM, ~790 imgs, scroll de >100k px en móvil. Paginación incremental:
  // 60 cards iniciales + botón "Cargar más" para ampliar de 60 en 60.
  // Reset automático al cambiar filtros: guardamos {key, count} juntos
  // y derivamos visibleCount; si el key actual no coincide con el del
  // state, devolvemos PAGE_SIZE (reset) en lugar de setState dentro de
  // un useEffect (react-hooks/set-state-in-effect) o ref-en-render
  // (react-hooks/refs).
  const PAGE_SIZE = 60
  const filterKey = `${normalizedSearch}|${animeFilter ?? ''}|${tagFilter ?? ''}|${sort}|${view}|${eloMin ?? ''}|${eloMax ?? ''}`
  const [pag, setPag] = useState({ key: filterKey, count: PAGE_SIZE })
  const visibleCount = pag.key === filterKey ? pag.count : PAGE_SIZE
  const cargarMas = () => setPag({ key: filterKey, count: visibleCount + PAGE_SIZE })

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (animeFilter) next.set('anime', animeFilter)
    else next.delete('anime')
    if (tagFilter) next.set('tag', tagFilter)
    else next.delete('tag')
    if (sort !== DEFAULT_SORT) next.set('sort', sort)
    else next.delete('sort')
    if (view !== DEFAULT_VIEW) next.set('view', view)
    else next.delete('view')
    if (eloMin != null) next.set('eloMin', String(eloMin))
    else next.delete('eloMin')
    if (eloMax != null) next.set('eloMax', String(eloMax))
    else next.delete('eloMax')
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [animeFilter, tagFilter, sort, view, eloMin, eloMax, searchParams, setSearchParams])

  const filtered = useMemo(() => {
    return filtrarCatalogo(catalogoIndex, {
      normalizedSearch,
      animeFilter,
      tagFilter,
      sort,
      eloMin,
      eloMax,
    })
  }, [catalogoIndex, normalizedSearch, animeFilter, tagFilter, sort, eloMin, eloMax])
  const visiblePersonajes = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  )
  const remainingPersonajes = Math.max(filtered.length - visibleCount, 0)
  const nextPageCount = Math.min(PAGE_SIZE, remainingPersonajes)

  useEffect(() => {
    if (autocompleteQuery.length < 2) {
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true)
      setSuggestionsError(null)
      endpoints
        .buscarPersonajes({
          q: autocompleteQuery,
          limit: 10,
          signal: controller.signal,
        })
        .then((data) => {
          if (!controller.signal.aborted) {
            setSuggestions(Array.isArray(data) ? data : [])
            setSuggestionsQuery(autocompleteQuery)
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setSuggestions([])
            setSuggestionsQuery(autocompleteQuery)
            setSuggestionsError(err.message || 'No se pudo buscar')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestionsLoading(false)
        })
    }, 150)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [autocompleteQuery])

  const selectedTag = useMemo(
    () => RASGOS_OTAKU.find((tag) => tag.id === tagFilter) ?? null,
    [tagFilter],
  )
  useSeo({
    title: selectedTag ? `Personajes ${selectedTag.label}` : 'Personajes',
    description: selectedTag
      ? `Personajes con categoría ${selectedTag.label} en AnimeShowdown: ranking ELO, anime de origen y fichas para votar.`
      : `Catálogo de ${catalogoPersonajes.length} personajes de anime con su ranking ELO, anime de origen y stats de votos.`,
  })
  const activeFilterBadges = useMemo(() => {
    const badges = []
    if (animeFilter) badges.push(animeFilter)
    if (selectedTag) badges.push(selectedTag.label)
    if (eloMin != null || eloMax != null) {
      badges.push(`${eloMin ?? eloBounds.min}-${eloMax ?? eloBounds.max} ELO base`)
    }
    if (sort !== DEFAULT_SORT) badges.push(sortLabels[sort])
    if (view === 'list') badges.push('Vista densa')
    return badges
  }, [animeFilter, selectedTag, eloMin, eloMax, eloBounds, sort, view])
  const hayFiltros =
    Boolean(search) || Boolean(animeFilter) || Boolean(tagFilter) ||
    Boolean(eloMin != null || eloMax != null) || sort !== DEFAULT_SORT ||
    view !== DEFAULT_VIEW
  const limpiarFiltros = () => {
    setSearch('')
    setAnimeFilter(null)
    setTagFilter(null)
    setSort(DEFAULT_SORT)
    setView(DEFAULT_VIEW)
    setEloMin(null)
    setEloMax(null)
    setFiltersOpen(false)
    setDraftFilters(null)
    play('playClick')
  }

  const seleccionarAnime = (anime) => {
    setAnimeFilter(anime)
    setFiltersOpen(false)
    play('playClick')
  }

  const crearSnapshotFiltros = () => ({
      animeFilter,
      tagFilter,
      sort,
      view,
      eloMin,
      eloMax,
    })

  const actualizarDraftFiltros = (patch) => {
    setDraftFilters((current) => ({
      ...(current ?? crearSnapshotFiltros()),
      ...patch,
    }))
  }

  const abrirFiltrosMovil = () => {
    setDraftFilters(crearSnapshotFiltros())
    setFiltersOpen(true)
    play('playClick')
  }

  const aplicarFiltrosMovil = () => {
    if (!draftFilters) return
    setAnimeFilter(draftFilters.animeFilter)
    setTagFilter(draftFilters.tagFilter)
    setSort(draftFilters.sort)
    setView(draftFilters.view)
    setEloMin(draftFilters.eloMin)
    setEloMax(draftFilters.eloMax)
    setFiltersOpen(false)
    play('playClick')
  }

  const resetFiltrosMovil = () => {
    setSearch('')
    setAnimeFilter(null)
    setTagFilter(null)
    setSort(DEFAULT_SORT)
    setView(DEFAULT_VIEW)
    setEloMin(null)
    setEloMax(null)
    setDraftFilters({
      animeFilter: null,
      tagFilter: null,
      sort: DEFAULT_SORT,
      view: DEFAULT_VIEW,
      eloMin: null,
      eloMax: null,
    })
    setFiltersOpen(false)
    play('playClick')
  }

  useEffect(() => {
    if (!filtersOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [filtersOpen])

  const drawerFilters = draftFilters ?? crearSnapshotFiltros()
  const drawerTag = RASGOS_OTAKU.find((tag) => tag.id === drawerFilters.tagFilter) ?? null
  const drawerEloMin = drawerFilters.eloMin ?? eloBounds.min
  const drawerEloMax = drawerFilters.eloMax ?? eloBounds.max

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.personajes}
      contentClassName="mx-auto max-w-7xl"
      lateralKanji={{ left: '英', right: '雄' }}
      atmosphere="archive"
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Personajes', path: '/personajes' },
        ])}
      />
        <motion.div initial="hidden" animate="visible" variants={headerVariants}>
          <CinematicHero
            visual={BRAND_VISUALS.personajes}
            icon={Sparkles}
            eyebrow={`Catálogo completo · ${catalogoPersonajes.length} combatientes`}
            title="Archivo de personajes"
            subtitle="Busca, filtra y compara a los personajes que sostienen el meta. Cada ficha funciona como entrada de archivo y como carta de combate para saltar directo al duelo."
            actions={
              <>
                <Link
                  to="/votar"
                  className="as-button-primary inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-black"
                >
                  <Swords className="h-4 w-4" />
                  Votar ahora
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/ranking"
                  className="as-button-ghost inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold"
                >
                  <TrendingUp className="h-4 w-4" />
                  Ver ranking
                </Link>
              </>
            }
            aside={
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-bg/62 p-5 backdrop-blur-xl">
                <p className="text-[11px] font-black text-gold">
                  Estado del archivo
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MiniHeroStat label="Universos" value={animes.length} />
                  <MiniHeroStat label="Top ELO base" value={eloBounds.top} />
                </div>
              </div>
            }
          />
        </motion.div>

        <div className="as-panel mb-4 grid gap-3 rounded-2xl p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              role="combobox"
              aria-label="Buscar personajes"
              placeholder="Busca personaje, anime o alias…"
              aria-autocomplete="list"
              aria-expanded={autocompleteQuery.length >= 2}
              aria-haspopup="listbox"
              aria-controls={
                autocompleteQuery.length >= 2
                  ? 'personajes-search-results'
                  : undefined
              }
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
            {autocompleteQuery.length >= 2 && (
              <div
                id="personajes-search-results"
                role="listbox"
                className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-surface/98 shadow-elev-2 backdrop-blur-xl"
              >
                {suggestionsLoading ? (
                  <p className="px-3.5 py-3 text-[12px] font-semibold text-fg-muted">
                    Buscando…
                  </p>
                ) : visibleSuggestionsError ? (
                  <p className="px-3.5 py-3 text-[12px] font-semibold text-gold">
                    {visibleSuggestionsError}
                  </p>
                ) : visibleSuggestions.length > 0 ? (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {visibleSuggestions.map((item) => (
                      <li key={item.slug} role="option" aria-selected="false">
                        <Link
                          to={`/personajes/${item.slug}`}
                          onClick={() => play('playClick')}
                          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/6"
                        >
                          <PersonajeImg
                            slug={item.slug}
                            nombre={item.nombre}
                            src={item.imagenUrl}
                            className="h-11 w-11 rounded-lg border border-white/10 object-cover"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-fg-strong">
                              <HighlightMatch text={item.nombre} query={autocompleteQuery} />
                            </span>
                            <span className="block truncate text-[11px] font-semibold text-fg-muted">
                              <HighlightMatch text={item.anime} query={autocompleteQuery} />
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3.5 py-3 text-[12px] font-semibold text-fg-muted">
                    Sin resultados rápidos. El filtro local sigue activo abajo.
                  </p>
                )}
              </div>
            )}
          </div>
          <BrandSelect
            value={tagFilter ?? ''}
            onChange={(v) => {
              setTagFilter(v || null)
              play('playClick')
            }}
            ariaLabel="Filtrar por rasgo otaku"
            className="hidden sm:block"
            options={[
              { value: '', label: 'Rasgo: todos' },
              ...RASGOS_OTAKU.map((tag) => ({ value: tag.id, label: `Rasgo: ${tag.label}` })),
            ]}
          />
          <BrandSelect
            value={sort}
            onChange={(v) => {
              setSort(v)
              play('playClick')
            }}
            ariaLabel="Ordenar por"
            className="hidden sm:block"
            options={Object.entries(sortLabels).map(([k, v]) => ({
              value: k,
              label: `Ordenar: ${v}`,
            }))}
          />
          <div className="as-control hidden items-center gap-1 rounded-lg p-1 sm:flex">
            <button
              type="button"
              onClick={() => {
                setView('grid')
                play('playClick')
              }}
              aria-label="Vista cuadrícula"
              aria-pressed={view === 'grid'}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-gold/15 text-gold'
                  : 'text-fg-muted hover:bg-white/5 hover:text-fg-strong'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setView('list')
                play('playClick')
              }}
              aria-label="Vista lista"
              aria-pressed={view === 'list'}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-gold/15 text-gold'
                  : 'text-fg-muted hover:bg-white/5 hover:text-fg-strong'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-fg-muted">
          Filtra por universo o rasgo otaku para descubrir arquetipos concretos.
          {selectedTag && (
            <>
              {' '}
              <Link
                to={`/glossary#term-${selectedTag.id}`}
                className="font-semibold text-gold hover:underline"
              >
                ¿Qué significa {selectedTag.label}?
              </Link>
            </>
          )}
          </p>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold transition-colors hover:underline"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="fixed bottom-[calc(5rem_+_env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex max-w-[calc(100vw_-_2rem)] flex-col items-end gap-2 sm:hidden">
          {activeFilterBadges.length > 0 && (
            <div className="flex max-w-[78vw] flex-wrap justify-end gap-1.5">
              {activeFilterBadges.slice(0, 3).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-gold/35 bg-bg/90 px-2 py-1 text-[10px] font-bold text-gold shadow-lg backdrop-blur"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={abrirFiltrosMovil}
            className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-surface/95 px-4 py-3 text-sm font-black text-fg-strong shadow-elev-1 backdrop-blur-xl"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <Filter className="h-4 w-4 text-gold" />
            Filtros ({activeFilterBadges.length})
          </button>
        </div>

        <div className="scrollbar-hide scroll-x-affordance scroll-x-fade-mobile -mx-5 mb-6 hidden gap-2 overflow-x-auto px-5 pb-1 sm:flex sm:-mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => seleccionarAnime(null)}
            aria-pressed={animeFilter === null}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
              animeFilter === null
                ? 'as-chip-active'
                : 'as-chip hover:border-gold/40 hover:text-fg-strong'
            }`}
          >
            Todos · {catalogoPersonajes.length}
          </button>
          {animes.map(([anime, count]) => (
            <button
              key={anime}
              type="button"
              onClick={() => seleccionarAnime(anime)}
              aria-pressed={animeFilter === anime}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                animeFilter === anime
                  ? 'as-chip-active'
                  : 'as-chip hover:border-gold/40 hover:text-fg-strong'
              }`}
            >
              {anime} · {count}
            </button>
          ))}
        </div>

        {/* Dialog conserva el look bottom-sheet en mobile y
            centraliza focus trap, Escape, backdrop, lock de scroll y restore
            de foco. En desktop ya existen filtros inline. */}
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          label="Filtros de personajes"
          align="bottom"
          className="sm:hidden"
          panelClassName="max-h-[86vh] p-0 shadow-elev-up"
        >
          <section className="contents">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-gold">
                    Filtros
                  </p>
                  <p className="truncate text-sm font-bold text-fg-strong">
                    {drawerFilters.animeFilter ?? 'Todos los universos'}
                    {drawerTag ? ` · ${drawerTag.label}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Cerrar filtros"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg text-fg-muted transition-colors hover:text-fg-strong"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[calc(86vh-150px)] space-y-5 overflow-y-auto px-5 py-5">
                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black text-fg-muted">
                    Universo
                  </legend>
                  <BrandSelect
                    value={drawerFilters.animeFilter ?? ''}
                    onChange={(v) => actualizarDraftFiltros({ animeFilter: v || null })}
                    ariaLabel="Filtrar por universo"
                    className="w-full"
                    options={[
                      { value: '', label: `Todos · ${catalogoPersonajes.length}` },
                      ...animes.map(([anime, count]) => ({ value: anime, label: `${anime} · ${count}` })),
                    ]}
                  />
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black text-fg-muted">
                    Rasgo otaku
                  </legend>
                  <BrandSelect
                    value={drawerFilters.tagFilter ?? ''}
                    onChange={(v) => actualizarDraftFiltros({ tagFilter: v || null })}
                    ariaLabel="Filtrar por rasgo otaku"
                    className="w-full"
                    options={[
                      { value: '', label: 'Todos los rasgos' },
                      ...RASGOS_OTAKU.map((tag) => ({ value: tag.id, label: tag.label })),
                    ]}
                  />
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black text-fg-muted">
                    Orden
                  </legend>
                  <BrandSelect
                    value={drawerFilters.sort}
                    onChange={(v) => actualizarDraftFiltros({ sort: v })}
                    ariaLabel="Ordenar por"
                    className="w-full"
                    options={Object.entries(sortLabels).map(([k, v]) => ({
                      value: k,
                      label: v,
                    }))}
                  />
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-[11px] font-black text-fg-muted">
                    Rango ELO base
                  </legend>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[12px] font-bold text-gold tabular-nums">
                    <span>{drawerEloMin}</span>
                    <span>{drawerEloMax}</span>
                  </div>
                  <label className="block text-[11px] font-semibold text-fg-muted">
                    Mínimo
                    <input
                      type="range"
                      min={eloBounds.min}
                      max={eloBounds.max}
                      step="25"
                      value={drawerEloMin}
                      onChange={(e) => {
                        const value = Math.min(Number(e.target.value), drawerEloMax)
                        actualizarDraftFiltros({
                          eloMin: value === eloBounds.min ? null : value,
                        })
                      }}
                      className="mt-2 w-full accent-gold"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold text-fg-muted">
                    Máximo
                    <input
                      type="range"
                      min={eloBounds.min}
                      max={eloBounds.max}
                      step="25"
                      value={drawerEloMax}
                      onChange={(e) => {
                        const value = Math.max(Number(e.target.value), drawerEloMin)
                        actualizarDraftFiltros({
                          eloMax: value === eloBounds.max ? null : value,
                        })
                      }}
                      className="mt-2 w-full accent-gold"
                    />
                  </label>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black text-fg-muted">
                    Vista
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => actualizarDraftFiltros({ view: 'list' })}
                      aria-pressed={drawerFilters.view === 'list'}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                        drawerFilters.view === 'list'
                          ? 'border-gold/60 bg-gold/15 text-gold'
                          : 'border-border bg-bg text-fg-muted'
                      }`}
                    >
                      Densa
                    </button>
                    <button
                      type="button"
                      onClick={() => actualizarDraftFiltros({ view: 'grid' })}
                      aria-pressed={drawerFilters.view === 'grid'}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                        drawerFilters.view === 'grid'
                          ? 'border-gold/60 bg-gold/15 text-gold'
                          : 'border-border bg-bg text-fg-muted'
                      }`}
                    >
                      Cómoda
                    </button>
                  </div>
                </fieldset>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border bg-surface px-5 py-4">
                <button
                  type="button"
                  onClick={resetFiltrosMovil}
                  className="rounded-lg border border-border bg-bg px-4 py-3 text-sm font-bold text-fg-muted"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={aplicarFiltrosMovil}
                  className="rounded-lg bg-accent px-4 py-3 text-sm font-black text-white"
                >
                  Aplicar
                </button>
              </div>
          </section>
        </Dialog>

        <p className="mb-4 text-[11px] text-fg-muted">
          Mostrando <strong className="text-fg-strong">{filtered.length}</strong>{' '}
          de {catalogoPersonajes.length} personajes
          {animeFilter && (
            <>
              {' '}· Universo:{' '}
              <strong className="text-fg-strong">{animeFilter}</strong>
            </>
          )}
          {selectedTag && (
            <>
              {' '}· Rasgo:{' '}
              <strong className="text-fg-strong">{selectedTag.label}</strong>
            </>
          )}
        </p>

        {/* Leyenda del sufijo "·b": aclara una sola vez que el ELO de las
            cards/lista es una estimación por popularidad, no el ranking real
            por votos. Evita repetir el matiz en cada tarjeta. */}
        <p className="mb-4 text-[11px] text-fg-muted">
          <span className="font-mono font-bold text-gold">·b</span> = ELO base
          estimado por popularidad (no se mueve con tus votos). El ranking
          competitivo real, por votos, está en{' '}
          <Link to="/ranking" className="font-semibold text-gold hover:underline">
            /ranking
          </Link>
          .
        </p>

        {shouldShowCatalogLoading ? (
          <CatalogoSkeletonGrid />
        ) : shouldShowCatalogError ? (
          <EmptyState
            icon={AlertTriangle}
            title="No pudimos cargar personajes"
            description="El catálogo no respondió y no hay datos locales para mostrar. Reintenta para volver a montar el roster."
            action={
              <button
                type="button"
                onClick={() => refetch()}
                className="as-button-primary rounded-lg px-5 py-3 text-sm font-black"
              >
                Reintentar
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState scene
            visual={BRAND_VISUALS.empty}
            icon={Search}
            title="No hay combatientes con esos filtros"
          >
            <p>
              El archivo no encontró coincidencias. Prueba con otro universo,
              busca por nombre alternativo o limpia filtros para volver al
              roster completo.
            </p>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="as-button-ghost mt-3 inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-bold"
            >
              Limpiar filtros
            </button>
          </EmptyState>
        ) : view === 'grid' ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {visiblePersonajes.map((p) => (
                <PersonajeCard key={p.slug} rank={rankPorSlug.get(p.slug)} {...p} />
              ))}
            </div>
            {remainingPersonajes > 0 && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={cargarMas}
                  className="as-button-ghost rounded-lg px-6 py-2.5 text-sm font-bold"
                >
                  Cargar {nextPageCount} más
                  <span className="ml-2 text-fg-muted">
                    ({visibleCount} de {filtered.length})
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {visiblePersonajes.map((p) => (
                <PersonajeListRow
                  key={p.slug}
                  rank={rankPorSlug.get(p.slug)}
                  {...p}
                />
              ))}
            </ul>
            {remainingPersonajes > 0 && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={cargarMas}
                  className="as-button-ghost rounded-lg px-6 py-2.5 text-sm font-bold"
                >
                  Cargar {nextPageCount} más
                  <span className="ml-2 text-fg-muted">
                    ({visibleCount} de {filtered.length})
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {/* CTAs inferiores: dirigir al ranking, votar y explorar animes —
            la propuesta del usuario era hacer este bloque más directo y
            con links accionables, no un párrafo descriptivo gris. */}
        <div className="mt-12 rounded-2xl border border-border bg-surface p-6">
          <p className="text-[13px] text-fg-muted">
            Pulsa cualquier personaje para ver su ficha completa, stats de
            combate y posición en el ranking ELO.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/ranking"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
            >
              <TrendingUp className="h-4 w-4" />
              Ver ranking global
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/votar"
              className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              <Swords className="h-4 w-4" />
              Votar ahora
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/animes"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
            >
              Explorar animes
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <SugerirPersonajeCTA titulo="¿No está tu personaje favorito?" />
        </div>
    </VisualPageShell>
  )
}

export default PersonajesPage
