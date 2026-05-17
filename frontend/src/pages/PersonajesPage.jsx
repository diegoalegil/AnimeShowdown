import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Swords,
  TrendingUp,
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PersonajeCard from '../components/PersonajeCard'
import PersonajeImg from '../components/PersonajeImg'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'
import {
  personajes,
  getStatsPersonaje,
  getPopularidad,
} from '../data/personajes'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useSound } from '../contexts/SoundContext'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const animes = (() => {
  const counts = {}
  personajes.forEach((p) => {
    counts[p.anime] = (counts[p.anime] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
})()

// Pre-cálculo del rank por ELO — para mostrar "#1, #2…" en las cards
// del top 10. Estable entre renders (no cambia mientras no se recargue
// el catálogo).
const rankPorSlug = (() => {
  const map = new Map()
  const ordenado = [...personajes]
    .map((p) => ({ slug: p.slug, elo: getStatsPersonaje(p.slug).elo }))
    .sort((a, b) => b.elo - a.elo)
  ordenado.forEach((p, i) => map.set(p.slug, i + 1))
  return map
})()

const sortLabels = {
  popularidad: 'Popularidad',
  elo_desc: 'Mayor ELO',
  elo_asc: 'Menor ELO',
  winrate: 'Mejor win rate',
  nombre_az: 'Nombre A-Z',
  nombre_za: 'Nombre Z-A',
  anime: 'Anime A-Z',
}

function PersonajesPage() {
  useSeo({
    title: 'Personajes',
    description: `Catálogo de ${personajes.length} personajes de anime con su ranking ELO, anime de origen y stats de votos.`,
  })
  const { play } = useSound()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [animeFilter, setAnimeFilter] = useState(
    () => searchParams.get('anime') || null,
  )
  const [sort, setSort] = useState('popularidad')
  const [view, setView] = useState('grid')

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (animeFilter) next.set('anime', animeFilter)
    else next.delete('anime')
    setSearchParams(next, { replace: true })
  }, [animeFilter, searchParams, setSearchParams])

  const filtered = useMemo(() => {
    let list = personajes
    if (animeFilter) list = list.filter((p) => p.anime === animeFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(s) ||
          p.anime.toLowerCase().includes(s),
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
  }, [search, animeFilter, sort])

  const hayFiltros = Boolean(search) || Boolean(animeFilter)
  const limpiarFiltros = () => {
    setSearch('')
    setAnimeFilter(null)
    play('playClick')
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Personajes', path: '/personajes' },
        ])}
      />
      <div className="mx-auto max-w-7xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            <Sparkles className="h-3 w-3" />
            Catálogo completo · {personajes.length} personajes
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Personajes
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Explora todos los personajes que compiten por subir en el ranking
            ELO. Busca a tus favoritos, filtra por universo y revisa sus stats
            de combate antes de votar.
          </p>
        </motion.header>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca personaje, anime o alias…"
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-9 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
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
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              play('playClick')
            }}
            aria-label="Ordenar por"
            className="rounded-lg border border-border bg-surface py-2.5 px-3 text-sm text-fg-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {Object.entries(sortLabels).map(([k, v]) => (
              <option key={k} value={k}>
                Ordenar: {v}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => {
                setView('grid')
                play('playClick')
              }}
              aria-label="Vista cuadrícula"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                view === 'grid'
                  ? 'bg-surface-alt text-fg-strong'
                  : 'text-fg-muted hover:text-fg-strong'
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
                  ? 'bg-surface-alt text-fg-strong'
                  : 'text-fg-muted hover:text-fg-strong'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-fg-muted">
            Filtra por universo para encontrar personajes de un anime concreto.
          </p>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent transition-colors hover:underline"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="scrollbar-hide -mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => {
              setAnimeFilter(null)
              play('playClick')
            }}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              animeFilter === null
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface text-fg-muted hover:border-accent/40 hover:text-fg-strong'
            }`}
          >
            Todos · {personajes.length}
          </button>
          {animes.map(([anime, count]) => (
            <button
              key={anime}
              type="button"
              onClick={() => {
                setAnimeFilter(anime)
                play('playClick')
              }}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                animeFilter === anime
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface text-fg-muted hover:border-accent/40 hover:text-fg-strong'
              }`}
            >
              {anime} · {count}
            </button>
          ))}
        </div>

        <p className="mb-4 text-[11px] text-fg-muted">
          Mostrando <strong className="text-fg-strong">{filtered.length}</strong>{' '}
          de {personajes.length} personajes
          {animeFilter && (
            <>
              {' '}· Universo:{' '}
              <strong className="text-fg-strong">{animeFilter}</strong>
            </>
          )}
        </p>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-lg font-bold text-fg-strong">
              Ningún personaje coincide
            </p>
            <p className="text-sm text-fg-muted">
              Prueba con otra búsqueda o limpia los filtros.
            </p>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="mt-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
            >
              Limpiar filtros
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((p) => (
              <PersonajeCard key={p.slug} rank={rankPorSlug.get(p.slug)} {...p} />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((p) => (
              <PersonajeListRow
                key={p.slug}
                rank={rankPorSlug.get(p.slug)}
                {...p}
              />
            ))}
          </ul>
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
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/20"
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
              className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
            >
              Explorar animes
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <SugerirPersonajeCTA titulo="¿No está tu personaje favorito?" />
        </div>
      </div>
    </section>
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
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
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
          <p className="font-mono text-sm font-bold text-accent">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
        <span className="hidden items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-[11px] font-semibold text-fg-muted transition-colors group-hover:border-accent/40 group-hover:text-accent md:inline-flex">
          Ver ficha
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  )
}

export default PersonajesPage
