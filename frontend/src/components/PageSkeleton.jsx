import Skeleton from './Skeleton'

// V-2 (perf "blanco al navegar"): mientras se descarga el chunk lazy de una
// ruta o se hidrata el catálogo de personajes, en vez de un spinner genérico
// pintamos un ESQUELETO que imita el layout real de cada página (hero
// fantasma, grids de cards, tablas). Así el visitante nuevo ve la estructura
// de la página al instante y nunca una pantalla en blanco.
//
// Este componente se monta desde App.jsx (fallback de <Suspense> +
// <RequireCatalog>), por lo que vive en el bundle RAÍZ. Para no inflar el
// budget de JS inicial (scripts/check-bundle-budget.mjs) SOLO depende del
// primitivo <Skeleton> (Tailwind puro) y de clases CSS globales (.as-stage,
// .as-panel de index.css) — nada de VisualSystem/framer-motion. El respeto a
// prefers-reduced-motion ya lo aporta <Skeleton> (motion-reduce:animate-none).

// Asocia cada pathname con un arquetipo de layout. Refleja el mapa de
// routePreloaderFor()/getRouteSkeletonReserve() de App.jsx.
function archetypeForPath(pathname) {
  if (pathname === '/') return 'home'
  if (pathname === '/votar' || pathname === '/duel-live') return 'votar'
  if (
    pathname === '/ranking' ||
    pathname.startsWith('/rankings/') ||
    pathname === '/leaderboards' ||
    pathname === '/mi-ranking'
  ) {
    return 'ranking'
  }
  if (pathname === '/personajes') return 'catalogGrid'
  if (pathname.startsWith('/personajes/')) return 'characterDetail'
  if (pathname === '/animes') return 'animeGrid'
  if (pathname.startsWith('/animes/')) return 'animeDetail'
  if (pathname === '/torneos') return 'torneos'
  if (pathname.startsWith('/torneos/')) return 'torneoDetail'
  if (pathname === '/games') return 'games'
  if (
    pathname.startsWith('/games/') ||
    pathname === '/descubre-personaje' ||
    pathname === '/comparar' ||
    pathname.startsWith('/duelos/')
  ) {
    return 'gameStage'
  }
  if (
    pathname === '/perfil' ||
    pathname.startsWith('/u/') ||
    pathname === '/logros' ||
    pathname === '/mi-top5'
  ) {
    return 'perfil'
  }
  return 'generic'
}

// Wrapper común: stage de marca (CSS, peso ~0), accesibilidad equivalente al
// antiguo PageLoader (role/aria) y reserva de altura anti-CLS por ruta.
function SkeletonSection({
  archetype,
  reserveClassName = '',
  stage = 'as-stage',
  contentClassName = 'mx-auto max-w-7xl',
  padding = 'px-5 py-12 sm:px-8 sm:py-16',
  children,
}) {
  return (
    <section
      className={`${stage} relative isolate flex flex-1 flex-col overflow-hidden ${padding} ${reserveClassName}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-page-skeleton={archetype}
    >
      <div className={`relative z-10 w-full ${contentClassName}`}>{children}</div>
      <span className="sr-only">Cargando la página de AnimeShowdown, un momento.</span>
    </section>
  )
}

// Hero fantasma que imita el <CinematicHero> de VisualSystem (panel
// redondeado con eyebrow + título + subtítulo + acciones).
function HeroGhost() {
  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-bg/72 p-5 shadow-elev-3 backdrop-blur-xl sm:p-7 lg:p-8">
      <div className="flex max-w-2xl flex-col gap-4">
        <Skeleton variant="box" className="h-6 w-40" />
        <Skeleton variant="box" className="h-12 w-full" />
        <Skeleton variant="box" className="h-4 w-2/3" />
        <div className="mt-1 flex flex-wrap gap-3">
          <Skeleton variant="box" className="h-11 w-36" />
          <Skeleton variant="box" className="h-11 w-28" />
        </div>
      </div>
    </div>
  )
}

// Barra de filtros fantasma (search + selects), como las de /personajes.
function FilterBarGhost({ extras = 2 }) {
  return (
    <div className="as-panel mb-4 grid gap-3 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <Skeleton variant="box" className="h-11 w-full" />
      {Array.from({ length: extras }).map((_, i) => (
        <Skeleton key={i} variant="box" className="hidden h-11 w-36 sm:block" />
      ))}
    </div>
  )
}

function CardGrid({ className, count }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  )
}

// Bloques de la home (alturas calibradas a las secciones reales de InicioPage:
// pulso, stats, top10, retos, torneos, universos). Compartidos con InicioPage
// vía <HomeSkeleton> para no duplicar las medidas.
const HOME_SKELETON_BLOCKS = [
  { id: 'pulse', className: 'h-[926px]' },
  { id: 'stats', className: 'h-[224px]' },
  { id: 'ranking', className: 'h-[606px]' },
  { id: 'daily-trials', className: 'h-[620px]' },
  { id: 'tournaments', className: 'h-[520px]' },
  { id: 'anime-universes', className: 'h-[520px]' },
]

function HomeSkeletonBlocks() {
  return (
    <>
      {HOME_SKELETON_BLOCKS.map((block) => (
        <Skeleton key={block.id} variant="banner" className={`w-full ${block.className}`} />
      ))}
    </>
  )
}

// Esqueleto de las secciones de la home, reutilizable desde InicioPage
// (HomeCatalogGuard) para que el estado de carga interno y el del gate de App
// compartan la misma forma.
export function HomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
      <HomeSkeletonBlocks />
    </div>
  )
}

function PageSkeleton({ pathname = '', reserveClassName = '' }) {
  const archetype = archetypeForPath(pathname)

  switch (archetype) {
    case 'home':
      // Hero a casi pantalla completa (como el Hero real) + bloques de sección.
      return (
        <SkeletonSection
          archetype="home"
          reserveClassName={reserveClassName}
          stage="as-stage as-stage-visual as-stage-home"
          contentClassName="mx-auto w-full max-w-7xl"
          padding="px-5 pb-12 pt-6 sm:px-8"
        >
          <div className="mb-10 flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
            <Skeleton variant="circle" className="h-28 w-28" />
            <Skeleton variant="box" className="h-5 w-44" />
            <Skeleton variant="box" className="h-14 w-[min(34rem,90%)]" />
            <Skeleton variant="box" className="h-4 w-[min(22rem,80%)]" />
            <div className="flex gap-3">
              <Skeleton variant="box" className="h-11 w-40" />
              <Skeleton variant="box" className="h-11 w-36" />
            </div>
          </div>
          <HomeSkeletonBlocks />
        </SkeletonSection>
      )

    case 'votar':
      return (
        <SkeletonSection
          archetype="votar"
          reserveClassName={reserveClassName}
          contentClassName="mx-auto flex max-w-5xl flex-col gap-4"
          padding="px-5 py-4 sm:px-8 sm:py-8 lg:py-10"
        >
          {/* Top bar: badge de modo + acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton variant="box" className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton variant="box" className="h-11 w-32" />
              <Skeleton variant="box" className="h-11 w-28" />
            </div>
          </div>
          {/* Pregunta principal */}
          <div className="flex flex-col items-center gap-2">
            <Skeleton variant="box" className="h-8 w-72 max-w-full" />
            <Skeleton variant="box" className="h-4 w-80 max-w-full" />
          </div>
          {/* Arena: dos retratos enfrentados + VS al centro */}
          <div className="grid grid-cols-2 items-start gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-6">
            <Skeleton variant="box" className="aspect-[3/4] w-full sm:aspect-[2/3] sm:max-h-[55vh]" />
            <div className="hidden items-center justify-center sm:flex">
              <Skeleton variant="circle" className="h-12 w-12" />
            </div>
            <Skeleton variant="box" className="aspect-[3/4] w-full sm:aspect-[2/3] sm:max-h-[55vh]" />
          </div>
        </SkeletonSection>
      )

    case 'ranking':
      return (
        <SkeletonSection archetype="ranking" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-7xl">
          <HeroGhost />
          {/* Tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="box" className="h-9 w-28" />
            ))}
          </div>
          <FilterBarGhost />
          {/* Podio top-3 */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="box" className="h-40" />
            ))}
          </div>
          {/* Filas del ranking */}
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="box" className="h-16 w-full" />
            ))}
          </div>
        </SkeletonSection>
      )

    case 'catalogGrid':
      return (
        <SkeletonSection archetype="catalogGrid" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-7xl">
          <HeroGhost />
          <FilterBarGhost extras={3} />
          <CardGrid className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" count={12} />
        </SkeletonSection>
      )

    case 'animeGrid':
      return (
        <SkeletonSection archetype="animeGrid" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-7xl">
          <HeroGhost />
          <div className="as-panel mb-6 grid gap-3 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <Skeleton variant="box" className="h-11 w-full" />
            <Skeleton variant="box" className="hidden h-11 w-40 sm:block" />
          </div>
          <CardGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" count={6} />
        </SkeletonSection>
      )

    case 'characterDetail':
      return (
        <SkeletonSection archetype="characterDetail" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start md:gap-12">
            {/* Retrato */}
            <Skeleton variant="box" className="order-2 aspect-[2/3] max-h-[55vh] w-full md:order-1" />
            {/* Identidad + stats */}
            <div className="order-1 flex flex-col gap-4 md:order-2">
              <Skeleton variant="circle" className="h-20 w-20 sm:h-28 sm:w-28" />
              <Skeleton variant="box" className="h-10 w-3/4" />
              <Skeleton variant="box" className="h-4 w-1/2" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="box" className="h-20" />
                ))}
              </div>
              <Skeleton variant="box" className="h-24 w-full" />
              <div className="flex flex-wrap gap-2">
                <Skeleton variant="box" className="h-10 w-32" />
                <Skeleton variant="box" className="h-10 w-32" />
              </div>
            </div>
          </div>
          {/* "Más personajes de…" */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        </SkeletonSection>
      )

    case 'animeDetail':
      return (
        <SkeletonSection archetype="animeDetail" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-6xl">
          {/* Banner del anime */}
          <Skeleton variant="box" className="mb-6 h-56 w-full sm:h-72" />
          <CardGrid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" count={6} />
        </SkeletonSection>
      )

    case 'torneos':
      return (
        <SkeletonSection archetype="torneos" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-6xl">
          <HeroGhost />
          <CardGrid className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" count={6} />
        </SkeletonSection>
      )

    case 'torneoDetail':
      return (
        <SkeletonSection archetype="torneoDetail" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-6xl">
          <Skeleton variant="box" className="mb-3 h-4 w-32" />
          <Skeleton variant="box" className="mb-6 h-80 w-full" />
          {/* Bracket: columnas con cards apiladas */}
          <Skeleton variant="box" className="mb-3 h-6 w-32" />
          <div className="mb-8 flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, col) => (
              <div key={col} className="flex min-w-[150px] flex-1 flex-col justify-around gap-4">
                {Array.from({ length: Math.max(1, 4 - col) }).map((_, row) => (
                  <Skeleton key={row} variant="box" className="h-16 w-full" />
                ))}
              </div>
            ))}
          </div>
          {/* Roster */}
          <CardGrid className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" count={12} />
        </SkeletonSection>
      )

    case 'games':
      return (
        <SkeletonSection archetype="games" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-6xl">
          <HeroGhost />
          <Skeleton variant="box" className="mb-3 h-48 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="box" className="h-32 w-full" />
            ))}
          </div>
        </SkeletonSection>
      )

    case 'gameStage':
      return (
        <SkeletonSection archetype="gameStage" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-2xl">
          <div className="flex flex-col items-center gap-5 text-center">
            <Skeleton variant="box" className="h-5 w-32" />
            <Skeleton variant="box" className="h-9 w-64 max-w-full" />
            <Skeleton variant="box" className="h-4 w-72 max-w-full" />
            <Skeleton variant="box" className="mt-2 aspect-video w-full" />
            <div className="flex gap-3">
              <Skeleton variant="box" className="h-11 w-32" />
              <Skeleton variant="box" className="h-11 w-32" />
            </div>
          </div>
        </SkeletonSection>
      )

    case 'perfil':
      return (
        <SkeletonSection archetype="perfil" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-3xl">
          <div className="mb-6 flex flex-col gap-4">
            <Skeleton variant="box" className="h-5 w-40" />
            <Skeleton variant="box" className="h-10 w-56" />
            <Skeleton variant="box" className="h-4 w-72 max-w-full" />
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="box" className="h-20" />
            ))}
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="box" className="h-9 w-24" />
            ))}
          </div>
          <div className="grid gap-6">
            <Skeleton variant="box" className="h-40 w-full" />
            <Skeleton variant="box" className="h-40 w-full" />
          </div>
        </SkeletonSection>
      )

    default:
      return (
        <SkeletonSection archetype="generic" reserveClassName={reserveClassName} contentClassName="mx-auto max-w-6xl">
          <HeroGhost />
          <CardGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" count={6} />
        </SkeletonSection>
      )
  }
}

export default PageSkeleton
