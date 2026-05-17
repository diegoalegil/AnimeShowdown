import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, Sparkles, Trophy, X } from 'lucide-react'
import PersonajeImg from '../components/PersonajeImg'
import { useSeo } from '../hooks/useSeo'
import { animesListSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useSound } from '../contexts/SoundContext'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'
import { animesCatalogo, buscarAnimes } from '../lib/animes'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const SORT_LABELS = {
  destacados: 'Destacados',
  personajes: 'Más personajes',
  elo: 'Mayor ELO máximo',
  promedio: 'Mayor ELO promedio',
  az: 'A-Z',
}

function AnimesPage() {
  useSeo({
    title: 'Animes',
    description: `${animesCatalogo.length} universos de anime en AnimeShowdown, con sus personajes votables y rankings internos.`,
  })

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('destacados')

  const filtrados = useMemo(() => {
    let list = buscarAnimes(search)
    if (sort === 'destacados') {
      // Mezcla de cantidad de personajes + topELO. Pondera ambos para
      // que los animes "ricos" (mucho roster + competidores fuertes) suban
      // arriba en vez de solo los que tienen más entradas en el catálogo.
      list = [...list].sort((a, b) => {
        const scoreA = a.total * 8 + (a.topElo?.elo ?? 0)
        const scoreB = b.total * 8 + (b.topElo?.elo ?? 0)
        return scoreB - scoreA
      })
    } else if (sort === 'personajes') {
      list = [...list].sort((a, b) => b.total - a.total)
    } else if (sort === 'elo') {
      list = [...list].sort(
        (a, b) => (b.topElo?.elo ?? 0) - (a.topElo?.elo ?? 0),
      )
    } else if (sort === 'promedio') {
      list = [...list].sort((a, b) => b.eloPromedio - a.eloPromedio)
    } else if (sort === 'az') {
      list = [...list].sort((a, b) => a.anime.localeCompare(b.anime))
    }
    return list
  }, [search, sort])

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="animes-list"
        schema={animesListSchema(animesCatalogo.map((a) => a.anime))}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Animes', path: '/animes' },
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
            Catálogo anime · {animesCatalogo.length} universos
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Universos anime
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Entra en cada universo, descubre sus personajes más fuertes y
            compara quién domina su ranking interno. Cada anime tiene su
            roster, sus favoritos y su propia competición.
          </p>
        </motion.header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca anime, saga o universo… (ej: kimetsu, snk, mha)"
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
            aria-label="Ordenar por"
            className="rounded-lg border border-border bg-surface py-2.5 px-3 text-sm text-fg-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                Ordenar: {v}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-4 text-[11px] text-fg-muted">
          Mostrando{' '}
          <strong className="text-fg-strong">{filtrados.length}</strong> de{' '}
          {animesCatalogo.length} universos
        </p>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-lg font-bold text-fg-strong">
              Ningún anime coincide
            </p>
            <p className="text-sm text-fg-muted">
              Prueba con un nombre alternativo (kimetsu, mha, snk…) o limpia
              la búsqueda.
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((a) => (
              <AnimeTile key={a.slug} animeData={a} />
            ))}
          </div>
        )}

        <div className="mt-12">
          <SugerirPersonajeCTA titulo="¿Falta un universo importante?" />
        </div>
      </div>
    </section>
  )
}

function AnimeTile({ animeData }) {
  const { anime, slug, total, topElo, portada } = animeData
  const { play } = useSound()
  return (
    <Link
      to={`/animes/${slug}`}
      onClick={() => play('playWhoosh')}
      className="group relative block overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_0_40px_-12px_rgba(255,46,99,0.55)]"
    >
      {/* Collage de portada: protagonistas + top ELO, no random. */}
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {portada.map((p) => (
          <PersonajeImg
            key={p.slug}
            slug={p.slug}
            alt=""
            loading="lazy"
            className="aspect-[2/3] w-full rounded-md object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        ))}
        {Array.from({ length: 4 - portada.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="aspect-[2/3] w-full rounded-md bg-surface-alt"
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 px-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold text-fg-strong group-hover:text-accent">
            {anime}
          </h3>
          <span className="shrink-0 rounded-md border border-border bg-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-fg-muted">
            {total}
          </span>
        </div>
        {topElo && (
          <p className="line-clamp-1 text-[12px] text-fg-muted">
            <Trophy className="mr-1 inline h-3 w-3 text-yellow-400" />
            Top ELO:{' '}
            <strong className="text-fg-strong">{topElo.nombre}</strong>
            <span className="font-mono text-accent"> · {topElo.elo}</span>
          </p>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Explorar universo
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export default AnimesPage
