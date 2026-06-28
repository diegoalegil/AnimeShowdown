import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { animesListSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'
import { filtrarOrdenarAnimes, getAnimesCatalogo } from '../lib/animes'
import { kanjiDeAnime, significadoKanjiDeAnime } from '../data/animes-kanji'
import { VisualPageShell, CinematicHero } from '../components/VisualSystem'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { BRAND_VISUALS } from '../data/visual-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import UniverseLibrary from '../features/animes/library/UniverseLibrary'
import { derivarUniversos } from '../features/animes/library/library-core'

// Tablillas de orden de la Biblioteca (radiogroup): claves de orden del
// catálogo (library-core / ANIME_SORTERS) con etiquetas cortas para las
// tablillas de madera. Única fuente de las opciones de orden.
const SORT_TABLILLAS = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'personajes', label: 'Personajes' },
  { value: 'elo', label: 'ELO máx.' },
  { value: 'promedio', label: 'ELO medio' },
  { value: 'az', label: 'A–Z' },
]

const hrefUniverso = (slug) => `/animes/${slug}`

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

  // Universos derivados para la Biblioteca. El orden/filtro fino lo hace
  // UniverseLibrary (library-core, mismos criterios que SORT_LABELS), pero
  // partimos del catálogo ya enriquecido (eloMedio/top3/searchText) y le
  // adjuntamos el kanji curado real (animes-kanji.js); sin entrada → 印.
  const universos = useMemo(
    () =>
      derivarUniversos(
        getAnimesCatalogo(personajes),
        kanjiDeAnime,
        significadoKanjiDeAnime,
      ),
    [personajes],
  )

  // Conteo "en vista" para la línea editorial (preserva el indicador previo):
  // suma de personajes de los universos que casan con la búsqueda + orden.
  const filtrados = useMemo(
    () => filtrarOrdenarAnimes({ catalogo: personajes, query: deferredSearch, sort }),
    [deferredSearch, sort, personajes],
  )
  const personajesEnVista = useMemo(
    () => filtrados.reduce((acc, a) => acc + a.total, 0),
    [filtrados],
  )

  return (
    <VisualPageShell visual={BRAND_VISUALS.animes} lateralKanji={{ left: '世', right: '界' }}>
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
          visual={BRAND_VISUALS.animes}
          lateralKanji={{ left: '世', right: '界' }}
          icon={Sparkles}
          eyebrow={`Catálogo anime · ${animesCatalogo.length} universos`}
          title="Universos anime"
          subtitle="Entra en cada universo, descubre sus personajes más fuertes y compara quién domina su ranking interno. Cada saga se presenta como un tomo lacado dentro de la biblioteca del archivo."
          actions={
            <Link
              to="/animes/constelacion"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/55 hover:text-gold"
            >
              <Sparkles className="h-4 w-4" />
              Ver como constelación
            </Link>
          }
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black text-gold">
                Biblioteca de los universos
              </p>
              <p className="mt-3 text-sm leading-7 text-fg-muted">
                Cada anime es un tomo: hojéalo para ver su roster, ELO base y
                top del universo, o entra a la ficha completa.
              </p>
            </div>
          }
        />

        <p className="mb-6 max-w-3xl text-sm leading-7 text-fg-muted">
          El catálogo de animes agrupa cada universo por roster, ELO base máximo
          y ranking interno. Abre un tomo para ver sus personajes destacados,
          saltar a la ficha o revisar qué saga concentra más fuerza competitiva
          dentro de AnimeShowdown. Los alias ayudan a encontrar nombres
          populares como MHA, Kimetsu o SNK sin duplicar páginas.
        </p>

        <p className="mb-4 text-[11px] text-fg-muted">
          <strong className="text-fg-strong">{filtrados.length}</strong>{' '}
          universos ·{' '}
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
        ) : !isLoading && !isError && animesCatalogo.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Aún no hay universos"
            description="El catálogo anime está vacío por ahora. Vuelve pronto."
          />
        ) : (
          <UniverseLibrary
            universos={universos}
            search={search}
            onSearch={setSearch}
            sort={sort}
            onSort={setSort}
            sortOptions={SORT_TABLILLAS}
            hrefUniverso={hrefUniverso}
          />
        )}

        <div className="mt-12">
          <SugerirPersonajeCTA titulo="¿Falta un universo importante?" />
        </div>
      </div>
    </VisualPageShell>
  )
}

// Esqueleto con la MISMA forma que UniverseLibrary (barra de búsqueda/orden +
// estantería de lomos verticales), no una rejilla de cartas: así no salta de
// layout al resolver (era la causa del CLS). Tailwind puro, sin depender del
// CSS de la biblioteca.
function CatalogoSkeletonGrid() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton variant="box" className="h-11 min-w-[16rem] flex-1 rounded-lg" />
        <Skeleton variant="box" className="h-10 w-56 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} variant="box" className="h-56 w-12 flex-none rounded-md sm:h-64" />
        ))}
      </div>
    </div>
  )
}

export default AnimesPage
