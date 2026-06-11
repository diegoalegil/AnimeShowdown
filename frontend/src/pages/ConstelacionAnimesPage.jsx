import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { List, Sparkles } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { construirGruposConstelacion } from '../features/animes/constelacion-grupos'
import UniverseConstellation from '../features/animes/UniverseConstellation'

/**
 * Vista constelación del índice de animes: cielo nocturno navegable con los
 * universos como emblemas unidos por trazos de constelación, agrupados por
 * su taxonomía temática (anime-identities). Vista alternativa inmersiva —
 * la canónica e indexable sigue siendo /animes.
 */
function ConstelacionAnimesPage() {
  useSeo({
    title: 'Constelación de universos',
    description:
      'Explora los universos anime de AnimeShowdown como un cielo de constelaciones temáticas: batalla, romance, terror, mecha y más.',
    noindex: true,
  })
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const grupos = useMemo(
    () => construirGruposConstelacion(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const totales = useMemo(
    () => grupos.reduce((s, g) => s + g.list.reduce((t, u) => t + u.chars, 0), 0),
    [grupos],
  )
  const universos = useMemo(
    () => grupos.reduce((s, g) => s + g.list.length, 0),
    [grupos],
  )

  return (
    <div className="bg-bg">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-bg/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span aria-hidden="true" lang="ja" className="text-2xl font-bold leading-none text-gold" style={{ fontFamily: 'var(--font-jp)' }}>
            宙
          </span>
          <h1 className="text-[15px] font-semibold text-fg-strong">Universos</h1>
          <span className="hidden truncate font-mono text-[11px] text-fg-muted sm:inline">
            {universos} universos · {totales.toLocaleString('es-ES')} personajes
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
            <Sparkles className="h-3.5 w-3.5" />
            Constelación
          </span>
        </nav>
      </header>

      {grupos.length > 0 ? (
        <UniverseConstellation grupos={grupos} seed={7} />
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
          Cargando el cielo de universos…
        </div>
      )}
    </div>
  )
}

export default ConstelacionAnimesPage
