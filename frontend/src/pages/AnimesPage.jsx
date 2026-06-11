import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Search, Sparkles, Trophy, X } from 'lucide-react'
import LazyOnView from '../components/LazyOnView'
import { useSeo } from '../hooks/useSeo'
import { animesListSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useSound } from '../contexts/SoundContext'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'
import { filtrarOrdenarAnimes, getAnimesCatalogo } from '../lib/animes'
import EditorialCover from '../components/EditorialCover'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import BrandSelect from '../components/BrandSelect'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { BRAND_VISUALS } from '../data/visual-assets'
import { getAnimeVisual } from '../data/anime-visual'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'

const SORT_LABELS = {
  destacados: 'Destacados',
  personajes: 'Más personajes',
  elo: 'Mayor ELO base máximo',
  promedio: 'Mayor ELO base promedio',
  az: 'A-Z',
}

function AnimesPage() {
  const { personajes, isLoading, isError, refetch } = usePersonajesCatalogo()
  const animesCatalogo = useMemo(
    () => getAnimesCatalogo(personajes),
    [personajes],
  )

  useSeo({
    title: 'Animes',
    description: `${animesCatalogo.length} universos de anime en AnimeShowdown, con sus personajes votables y rankings internos.`,
  })

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('destacados')
  const deferredSearch = useDeferredValue(search)

  const filtrados = useMemo(() => {
    return filtrarOrdenarAnimes({
      catalogo: personajes,
      query: deferredSearch,
      sort,
    })
  }, [deferredSearch, sort, personajes])
  const personajesEnVista = useMemo(
    () => filtrados.reduce((total, animeData) => total + animeData.total, 0),
    [filtrados],
  )

  return (
    <VisualPageShell visual={BRAND_VISUALS.animes} lateralKanji={{left: "世", right: "界"}}>
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
        <CinematicHero
          visual={BRAND_VISUALS.animes} lateralKanji={{left: "世", right: "界"}}
          icon={Sparkles}
          eyebrow={`Catálogo anime · ${animesCatalogo.length} universos`}
          title="Universos anime"
          subtitle="Entra en cada universo, descubre sus personajes más fuertes y compara quién domina su ranking interno. Cada saga se presenta como una escena propia dentro del archivo."
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black text-gold">
                Archivo de universos
              </p>
              <p className="mt-3 text-sm leading-7 text-fg-muted">
                Roster, ranking interno y rutas rápidas para saltar del anime
                al duelo sin perder el hilo del meta.
              </p>
            </div>
          }
        />

        <p className="mb-6 max-w-3xl text-sm leading-7 text-fg-muted">
          El catálogo de animes agrupa cada universo por roster, ELO base máximo
          y ranking interno. Entra en una ficha para ver sus personajes
          destacados, abrir duelos relacionados o revisar qué saga concentra más
          fuerza competitiva dentro de AnimeShowdown. Los alias ayudan a encontrar
          nombres populares como MHA, Kimetsu o SNK sin duplicar páginas.
        </p>

        <div className="as-panel mb-6 grid gap-3 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar animes"
              placeholder="Busca anime, personaje o alias… (ej: luffy, kimetsu, snk)"
              className="as-control min-h-11 w-full rounded-lg py-2.5 pl-10 pr-12 text-sm text-fg-strong placeholder:text-fg-muted"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg-muted transition-colors hover:text-fg-strong"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <BrandSelect
            value={sort}
            onChange={setSort}
            ariaLabel="Ordenar por"
            className="w-full min-w-0"
            options={Object.entries(SORT_LABELS).map(([k, v]) => ({
              value: k,
              label: `Ordenar: ${v}`,
            }))}
          />
        </div>

        <p className="mb-4 text-[11px] text-fg-muted">
          Mostrando{' '}
          <strong className="text-fg-strong">{filtrados.length}</strong> de{' '}
          {animesCatalogo.length} universos ·{' '}
          <strong className="text-fg-strong">{personajesEnVista}</strong>{' '}
          personajes en vista
        </p>

        {isLoading && animesCatalogo.length === 0 ? (
          <CatalogoSkeletonGrid />
        ) : isError && animesCatalogo.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No pudimos cargar universos"
            description="El catálogo anime no respondió a tiempo. Reintenta para volver a consultar el archivo."
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
        ) : filtrados.length === 0 ? (
          <EmptyState scene
            visual={BRAND_VISUALS.empty}
            icon={Search}
            title="No aparece ese universo"
          >
            <p>
              Prueba con un personaje, nombre alternativo (kimetsu, mha,
              snk…) o limpia la búsqueda para volver al catálogo completo.
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="as-button-ghost mt-3 rounded-lg px-5 py-3 text-sm font-bold"
            >
              Limpiar búsqueda
            </button>
          </EmptyState>
        ) : (
          // Cada anime usa una portada editorial, no collage de cards.
          // Mantenemos LazyOnView porque el grid puede
          // superar 100 universos y no hace falta montar todo en el primer
          // paint.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((a, i) =>
              i < 6 ? (
                <AnimeTile key={a.slug} animeData={a} />
              ) : (
                <LazyOnView key={a.slug} minHeight={280} rootMargin="1200px 0px">
                  <AnimeTile animeData={a} />
                </LazyOnView>
              ),
            )}
          </div>
        )}

        <div className="mt-12">
          <SugerirPersonajeCTA titulo="¿Falta un universo importante?" />
        </div>
      </div>
    </VisualPageShell>
  )
}

function CatalogoSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  )
}

function AnimeTile({ animeData }) {
  const { anime, slug, total, topElo } = animeData
  const { play } = useSound()
  const visual = getAnimeVisual(slug, anime)
  // El visual ya trae accent del propio anime (chakra naranja para Naruto,
  // dorado mar para One Piece, etc.). Usamos eso para el glow del hover.
  const accentRgb = visual?.accentRgb ?? '159 29 44'
  return (
    <Link
      to={`/animes/${slug}`}
      onClick={() => play('playWhoosh')}
      className="as-anime-tile as-panel group relative block overflow-hidden rounded-2xl p-0 transition-all duration-300 motion-safe:hover:-translate-y-1.5 hover:border-gold/45"
      style={{
        '--anime-accent': accentRgb,
      }}
    >
      <EditorialCover
        visual={visual}
        title={anime}
        eyebrow="Universo"
        className="h-44 rounded-none border-0"
        imageClassName="saturate-105 contrast-100"
        compact
      >
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="rounded-lg border border-white/10 bg-bg/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-fg-muted backdrop-blur">
            {total} personajes
          </span>
          {topElo && (
            <span className="rounded-lg border border-gold/35 bg-gold-soft px-2 py-0.5 font-mono text-[10px] font-bold text-gold">
              ELO base {topElo.elo}
            </span>
          )}
        </div>
      </EditorialCover>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold text-fg-strong group-hover:text-gold">
            {anime}
          </h3>
        </div>
        {topElo && (
          <p className="line-clamp-1 text-[12px] text-fg-muted">
            <Trophy className="mr-1 inline h-3 w-3 text-medal-gold" />
            Top ELO base:{' '}
            <strong className="text-fg-strong">{topElo.nombre}</strong>
            <span className="font-mono text-gold"> · {topElo.elo}</span>
          </p>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
          Explorar universo
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export default AnimesPage
