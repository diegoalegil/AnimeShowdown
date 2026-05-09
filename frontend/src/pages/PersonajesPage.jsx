import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid, List, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeCard from '../components/PersonajeCard'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

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

const sortLabels = {
  default: 'Por defecto',
  nombre: 'Nombre A-Z',
  elo: 'ELO ↓',
  anime: 'Anime A-Z',
}

function PersonajesPage() {
  useDocumentTitle('Personajes')
  const [search, setSearch] = useState('')
  const [animeFilter, setAnimeFilter] = useState(null)
  const [sort, setSort] = useState('default')
  const [view, setView] = useState('grid')

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
    if (sort === 'nombre') {
      list = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre))
    } else if (sort === 'elo') {
      list = [...list].sort(
        (a, b) =>
          getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo,
      )
    } else if (sort === 'anime') {
      list = [...list].sort((a, b) => a.anime.localeCompare(b.anime))
    }
    return list
  }, [search, animeFilter, sort])

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            {filtered.length} de {personajes.length} personajes
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Personajes
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Todos los personajes disponibles para los próximos torneos. Filtra por anime, busca por nombre o cambia de vista.
          </p>
        </motion.header>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o anime..."
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
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-border bg-surface py-2.5 px-3 text-sm text-fg-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {Object.entries(sortLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setView('grid')}
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
              onClick={() => setView('list')}
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

        <div className="scrollbar-hide -mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setAnimeFilter(null)}
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
              onClick={() => setAnimeFilter(anime)}
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
              onClick={() => {
                setSearch('')
                setAnimeFilter(null)
              }}
              className="mt-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
            >
              Limpiar filtros
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((p) => (
              <PersonajeCard key={p.slug} {...p} />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((p) => (
              <PersonajeListRow key={p.slug} {...p} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function PersonajeListRow({ slug, nombre, anime }) {
  const { elo, wins, losses } = getStatsPersonaje(slug)
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 sm:px-5"
      >
        <img
          src={imagenPersonaje(slug)}
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
        <div className="hidden text-right sm:block">
          <p className="text-[12px] text-fg-muted">
            {wins}V · {losses}D · {winRate}%
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-accent">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
      </Link>
    </li>
  )
}

export default PersonajesPage
