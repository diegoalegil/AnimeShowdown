import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
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
import AccessibleDialog from '../components/AccessibleDialog'
import PersonajeCard from '../components/PersonajeCard'
import PersonajeImg from '../components/PersonajeImg'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'
import {
  personajes,
  getStatsPersonaje,
  getPopularidad,
} from '../lib/personajes-core'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useSound } from '../contexts/SoundContext'
import { CinematicHero, EmptyStateScene, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import { endpoints } from '../lib/api'
import { useCatalogoPersonajes } from '../hooks/useCatalogoPersonajes'
import {
  RASGOS_OTAKU,
  getCategoriasPersonaje,
} from '../data/personajes-tags'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const sortLabels = {
  popularidad: 'Popularidad',
  elo_desc: 'Mayor ELO',
  elo_asc: 'Menor ELO',
  winrate: 'Mejor win rate',
  nombre_az: 'Nombre A-Z',
  nombre_za: 'Nombre Z-A',
  anime: 'Anime A-Z',
}

const DEFAULT_SORT = 'popularidad'
const DEFAULT_VIEW = 'grid'

function parseOptionalInt(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function MiniHeroStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-black text-gold tabular-nums">
        {Number(value).toLocaleString('es-ES')}
      </p>
    </div>
  )
}

function HighlightMatch({ text, query }) {
  if (!query) return text
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const idx = lower.indexOf(needle)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-gold/20 px-0.5 text-gold">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  )
}

function PersonajesPage() {
  const { data: catalogoRemoto } = useCatalogoPersonajes()
  const catalogoPersonajes = useMemo(() => {
    if (!Array.isArray(catalogoRemoto) || catalogoRemoto.length === 0) {
      return personajes
    }
    return catalogoRemoto.map((p) => ({
      ...p,
      imagen: p.imagenUrl ?? p.imagen,
    }))
  }, [catalogoRemoto])

  const animes = useMemo(() => {
    const counts = {}
    catalogoPersonajes.forEach((p) => {
      counts[p.anime] = (counts[p.anime] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [catalogoPersonajes])

  const eloBounds = useMemo(() => {
    if (catalogoPersonajes.length === 0) return { min: 1000, max: 2300 }
    const elos = catalogoPersonajes.map((p) => getStatsPersonaje(p.slug).elo)
    return {
      min: Math.floor(Math.min(...elos) / 25) * 25,
      max: Math.ceil(Math.max(...elos) / 25) * 25,
    }
  }, [catalogoPersonajes])

  const rankPorSlug = useMemo(() => {
    const map = new Map()
    const ordenado = [...catalogoPersonajes]
      .map((p) => ({ slug: p.slug, elo: getStatsPersonaje(p.slug).elo }))
      .sort((a, b) => b.elo - a.elo)
    ordenado.forEach((p, i) => map.set(p.slug, i + 1))
    return map
  }, [catalogoPersonajes])

  const { play } = useSound()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
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

  // Audit (2026-05-17): /personajes con 730 cards renderizaba ~9.8k nodos
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
    let list = catalogoPersonajes
    if (animeFilter) list = list.filter((p) => p.anime === animeFilter)
    if (tagFilter) {
      list = list.filter((p) =>
        getCategoriasPersonaje(p.slug).includes(tagFilter),
      )
    }
    if (eloMin != null || eloMax != null) {
      list = list.filter((p) => {
        const elo = getStatsPersonaje(p.slug).elo
        if (eloMin != null && elo < eloMin) return false
        if (eloMax != null && elo > eloMax) return false
        return true
      })
    }
    if (normalizedSearch) {
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(normalizedSearch) ||
          p.anime.toLowerCase().includes(normalizedSearch),
      )
    }
    if (sort === 'popularidad') {
      list = [...list].sort(
        (a, b) => getPopularidad(b.slug) - getPopularidad(a.slug),
      )
    } else if (sort === 'elo_desc') {
      list = [...list].sort(
        (a, b) => getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo,
      )
    } else if (sort === 'elo_asc') {
      list = [...list].sort(
        (a, b) => getStatsPersonaje(a.slug).elo - getStatsPersonaje(b.slug).elo,
      )
    } else if (sort === 'winrate') {
      list = [...list].sort((a, b) => {
        const sa = getStatsPersonaje(a.slug)
        const sb = getStatsPersonaje(b.slug)
        const wra = sa.wins + sa.losses > 0 ? sa.wins / (sa.wins + sa.losses) : 0
        const wrb = sb.wins + sb.losses > 0 ? sb.wins / (sb.wins + sb.losses) : 0
        return wrb - wra
      })
    } else if (sort === 'nombre_az') {
      list = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre))
    } else if (sort === 'nombre_za') {
      list = [...list].sort((a, b) => b.nombre.localeCompare(a.nombre))
    } else if (sort === 'anime') {
      list = [...list].sort((a, b) => a.anime.localeCompare(b.anime))
    }
    return list
  }, [catalogoPersonajes, normalizedSearch, animeFilter, tagFilter, sort, eloMin, eloMax])

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
      ? `Personajes con rasgo ${selectedTag.label} en AnimeShowdown: ranking ELO, anime de origen y fichas para votar.`
      : `Catálogo de ${catalogoPersonajes.length} personajes de anime con su ranking ELO, anime de origen y stats de votos.`,
  })
  const activeFilterBadges = useMemo(() => {
    const badges = []
    if (animeFilter) badges.push(animeFilter)
    if (selectedTag) badges.push(selectedTag.label)
    if (eloMin != null || eloMax != null) {
      badges.push(`${eloMin ?? eloBounds.min}-${eloMax ?? eloBounds.max} ELO`)
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
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                  Estado del archivo
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MiniHeroStat label="Universos" value={animes.length} />
                  <MiniHeroStat label="Top ELO" value={Math.max(...catalogoPersonajes.map((p) => getStatsPersonaje(p.slug).elo))} />
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
              placeholder="Busca personaje, anime o alias…"
              aria-expanded={autocompleteQuery.length >= 2}
              aria-controls="personajes-search-results"
              className="as-control w-full rounded-lg py-2.5 pl-10 pr-9 text-sm text-fg-strong placeholder:text-fg-muted"
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
                className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-surface/98 shadow-[0_24px_80px_-36px_rgb(0_0_0_/_0.95)] backdrop-blur-xl"
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
          <select
            value={tagFilter ?? ''}
            onChange={(e) => {
              setTagFilter(e.target.value || null)
              play('playClick')
            }}
            aria-label="Filtrar por rasgo otaku"
            className="as-control hidden rounded-lg py-2.5 px-3 text-sm text-fg-strong sm:block"
          >
            <option value="">Rasgo: todos</option>
            {RASGOS_OTAKU.map((tag) => (
              <option key={tag.id} value={tag.id}>
                Rasgo: {tag.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              play('playClick')
            }}
            aria-label="Ordenar por"
            className="as-control hidden rounded-lg py-2.5 px-3 text-sm text-fg-strong sm:block"
          >
            {Object.entries(sortLabels).map(([k, v]) => (
              <option key={k} value={k}>
                Ordenar: {v}
              </option>
            ))}
          </select>
          <div className="as-control hidden items-center gap-1 rounded-lg p-1 sm:flex">
            <button
              type="button"
              onClick={() => {
                setView('grid')
                play('playClick')
              }}
              aria-label="Vista cuadrícula"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
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
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
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

        <div className="fixed bottom-20 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:hidden">
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
            className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-surface/95 px-4 py-3 text-sm font-black text-fg-strong shadow-[0_16px_48px_-20px_rgb(0_0_0_/_0.95)] backdrop-blur-xl"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <Filter className="h-4 w-4 text-gold" />
            Filtros ({activeFilterBadges.length})
          </button>
        </div>

        <div className="scrollbar-hide -mx-5 mb-6 hidden gap-2 overflow-x-auto px-5 pb-1 sm:flex sm:-mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => seleccionarAnime(null)}
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

        {/* Audit F017 (2026-05-22): el drawer de filtros móvil antes era
            un <div role="dialog"> ad-hoc sin focus trap, Escape close ni
            bloqueo de scroll del body — los lectores y users de teclado
            podían tabbing salir al fondo. Ahora pasa por AccessibleDialog
            con align="bottom" que conserva el look bottom-sheet pero añade
            todas las features de accesibilidad. El backdrop, el lock de
            scroll y el restore de foco quedan centralizados.
            sm:hidden se aplica al backdrop wrapper para que el drawer solo
            aparezca en viewports móviles — en desktop hay filtros inline. */}
        <AccessibleDialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          label="Filtros de personajes"
          align="bottom"
          className="sm:hidden"
          panelClassName="max-h-[86vh] p-0 shadow-[0_-24px_80px_rgb(0_0_0_/_0.5)]"
        >
          <section className="contents">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
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
                  <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
                    Universo
                  </legend>
                  <select
                    value={drawerFilters.animeFilter ?? ''}
                    onChange={(e) => actualizarDraftFiltros({ animeFilter: e.target.value || null })}
                    className="as-control w-full rounded-lg px-3 py-2.5 text-sm text-fg-strong"
                  >
                    <option value="">Todos · {catalogoPersonajes.length}</option>
                    {animes.map(([anime, count]) => (
                      <option key={anime} value={anime}>
                        {anime} · {count}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
                    Rasgo otaku
                  </legend>
                  <select
                    value={drawerFilters.tagFilter ?? ''}
                    onChange={(e) => actualizarDraftFiltros({ tagFilter: e.target.value || null })}
                    className="as-control w-full rounded-lg px-3 py-2.5 text-sm text-fg-strong"
                  >
                    <option value="">Todos los rasgos</option>
                    {RASGOS_OTAKU.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.label}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
                    Orden
                  </legend>
                  <select
                    value={drawerFilters.sort}
                    onChange={(e) => actualizarDraftFiltros({ sort: e.target.value })}
                    className="as-control w-full rounded-lg px-3 py-2.5 text-sm text-fg-strong"
                  >
                    {Object.entries(sortLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
                    Rango ELO
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
                      className="mt-2 w-full accent-amber-400"
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
                      className="mt-2 w-full accent-amber-400"
                    />
                  </label>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-fg-muted">
                    Vista
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => actualizarDraftFiltros({ view: 'list' })}
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
        </AccessibleDialog>

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

        {filtered.length === 0 ? (
          <EmptyStateScene
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
          </EmptyStateScene>
        ) : view === 'grid' ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filtered.slice(0, visibleCount).map((p) => (
                <PersonajeCard key={p.slug} rank={rankPorSlug.get(p.slug)} {...p} />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={cargarMas}
                  className="as-button-ghost rounded-lg px-6 py-2.5 text-sm font-bold"
                >
                  Cargar {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
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
              {filtered.slice(0, visibleCount).map((p) => (
                <PersonajeListRow
                  key={p.slug}
                  rank={rankPorSlug.get(p.slug)}
                  {...p}
                />
              ))}
            </ul>
            {visibleCount < filtered.length && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={cargarMas}
                  className="as-button-ghost rounded-lg px-6 py-2.5 text-sm font-bold"
                >
                  Cargar {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
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

function PersonajeListRow({ slug, nombre, anime, rank }) {
  const { elo, wins, losses } = getStatsPersonaje(slug)
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 sm:px-5"
      >
        {rank && rank <= 100 && (
          <span className="hidden w-10 shrink-0 font-mono text-[13px] font-extrabold text-fg-muted sm:block">
            #{rank}
          </span>
        )}
        <PersonajeImg
          slug={slug}
          alt=""
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <div className="hidden text-right text-[12px] sm:block">
          <p className="text-fg-muted">
            <span className="font-semibold text-emerald-300">{wins}V</span>
            {' · '}
            <span className="font-semibold text-rose-300">{losses}D</span>
          </p>
          {winRate != null && (
            <p className="font-mono text-[11px] font-semibold text-emerald-300/80">
              {winRate}% WR
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-gold">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
        <span className="hidden items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-[11px] font-semibold text-fg-muted transition-colors group-hover:border-accent/40 group-hover:text-gold md:inline-flex">
          Ver ficha
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  )
}

export default PersonajesPage
