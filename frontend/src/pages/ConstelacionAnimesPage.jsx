import { Suspense, lazy, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { List, Orbit } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { brandAssetUrl } from '../lib/brand-assets'
import { supportsWebGL } from '../features/animes/galaxy/galaxy-layout'
import { construirUniversosGalaxia } from '../features/animes/galaxy/construir-universos'
import UniverseGalaxyPoster from '../features/animes/UniverseGalaxyPoster'

// La galaxia 3D arrastra el chunk de three/@react-three: solo se carga cuando
// hace falta y siempre tras decidir que el navegador soporta WebGL.
const UniverseGalaxy = lazy(() => import('../features/animes/UniverseGalaxy'))

const symbolUrlFor = (u) => brandAssetUrl(`${u.slug}-symbol-01`, 480)

/**
 * Vista galaxia del índice de animes: cada universo es una estrella en una
 * espiral 3D navegable (WebGL), con los más poblados como núcleo dorado. Sin
 * WebGL cae a un póster 2D con la misma espiral. Vista inmersiva — la canónica
 * e indexable sigue siendo /animes.
 */
function ConstelacionAnimesPage() {
  useSeo({
    title: 'Galaxia de universos',
    description:
      'Explora los universos anime de AnimeShowdown como una galaxia navegable: cada estrella es un universo y los más poblados forman el núcleo dorado.',
    noindex: true,
  })
  const navigate = useNavigate()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const universos = useMemo(
    () => construirUniversosGalaxia(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const totalPersonajes = useMemo(
    () => universos.reduce((s, u) => s + u.charCount, 0),
    [universos],
  )

  const webgl = supportsWebGL()
  const onSelect = (u) => navigate(`/animes/${u.slug}`)

  const poster = (
    <UniverseGalaxyPoster
      universes={universos}
      getSymbolUrl={symbolUrlFor}
      onSelect={onSelect}
    />
  )

  return (
    <div className="bg-bg">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-bg/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span aria-hidden="true" lang="ja" className="text-2xl font-bold leading-none text-gold" style={{ fontFamily: 'var(--font-jp)' }}>
            宇宙
          </span>
          <h1 className="text-[15px] font-semibold text-fg-strong">Universos</h1>
          <span className="hidden truncate font-mono text-[11px] text-fg-muted sm:inline">
            {universos.length} universos · {totalPersonajes.toLocaleString('es-ES')} personajes
          </span>
        </div>
        <nav
          aria-label="Modo de vista"
          className="flex flex-none gap-1 rounded-[10px] border border-white/10 bg-surface p-[3px]"
        >
          <Link
            to="/animes"
            className="inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold text-fg-muted transition-colors hover:text-fg-strong"
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </Link>
          <span
            aria-current="page"
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12.5px] font-semibold text-gold"
          >
            <Orbit className="h-3.5 w-3.5" />
            Galaxia
          </span>
        </nav>
      </header>

      {universos.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
          Cargando la galaxia de universos…
        </div>
      ) : webgl ? (
        <div className="h-[calc(100dvh-3.5rem)] w-full">
          <Suspense fallback={poster}>
            <UniverseGalaxy
              universes={universos}
              getSymbolUrl={symbolUrlFor}
              onSelect={onSelect}
            />
          </Suspense>
        </div>
      ) : (
        poster
      )}
    </div>
  )
}

export default ConstelacionAnimesPage
