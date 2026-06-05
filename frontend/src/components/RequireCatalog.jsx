import { useEffect, useState } from 'react'
import PageSkeleton from './PageSkeleton'

// Gate del catálogo de personajes. Solo deja pasar children cuando el catálogo
// está hidratado. Mientras carga muestra un <PageSkeleton> con la forma de la
// ruta (V-2: nunca un spinner genérico ni pantalla en blanco). Si el backend
// falla o tarda demasiado, ofrece reintentar; si responde vacío, lo avisa.
//
// Vivía inline en App.jsx; se extrajo para poder testear el gate de forma
// aislada (RequireCatalog.test.tsx) sin arrastrar todo el árbol de App.

function CatalogoError({ onRetry }) {
  return (
    <div className="as-stage as-stage-visual as-stage-home flex flex-1 items-center justify-center px-5 py-20">
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="as-panel flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center"
      >
        <p className="text-sm font-semibold text-gold">
          Catálogo no disponible
        </p>
        <h1 className="text-2xl font-black text-fg-strong">
          No pudimos cargar los personajes
        </h1>
        <p className="text-sm leading-6 text-fg-muted">
          AnimeShowdown necesita el catálogo para montar rankings, juegos y fichas sin datos incompletos.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="as-button-primary mt-2 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-bold transition"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}

function CatalogoVacio({ onRetry }) {
  return (
    <div className="as-stage as-stage-visual as-stage-home flex flex-1 items-center justify-center px-5 py-20">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="as-panel flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center"
      >
        <p className="text-sm font-semibold text-gold">
          Catálogo vacío
        </p>
        <h1 className="text-2xl font-black text-fg-strong">
          Aún no hay personajes para mostrar
        </h1>
        <p className="text-sm leading-6 text-fg-muted">
          El backend respondió correctamente pero el catálogo está vacío. Si
          eres operador, ejecuta el seed o aplica las migraciones pendientes.
          Si eres usuario, vuelve en un rato — estamos preparando el roster.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="as-button-primary mt-2 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-bold transition"
        >
          Volver a comprobar
        </button>
      </div>
    </div>
  )
}

function useCatalogoLoadingTimeout(isLoading) {
  const [attempt, setAttempt] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading || timedOut) return undefined

    const id = window.setTimeout(() => setTimedOut(true), 12000)
    return () => window.clearTimeout(id)
  }, [attempt, isLoading, timedOut])

  return [
    isLoading && timedOut,
    () => {
      setTimedOut(false)
      setAttempt((value) => value + 1)
    },
  ]
}

// Wrapper que sólo deja pasar children cuando el catálogo de personajes está
// hidratado. Las rutas de soporte/auth/legal/status cargan independiente para
// que sigan disponibles aunque falle /api/personajes/catalogo.
function RequireCatalog({
  catalogoQuery,
  loadingPathname = '',
  loadingReserveClassName = '',
  children,
}) {
  // Diferenciamos dos estados distintos:
  //   - loading: catalogoQuery aún no resolvió.
  //   - loaded-empty: el backend respondió, pero con [] (DB nueva, seed
  //     no aplicado, migración en curso, entorno de staging vacío...).
  const hasData = Array.isArray(catalogoQuery.data) && catalogoQuery.data.length > 0
  const isLoading = catalogoQuery.isPending || catalogoQuery.isFetching
  const isError = catalogoQuery.isError
  const isLoadedEmpty =
    !hasData && !isLoading && !isError && Array.isArray(catalogoQuery.data)
  const [hasTimedOut, resetTimeout] = useCatalogoLoadingTimeout(isLoading)
  const handleRetry = () => {
    resetTimeout()
    catalogoQuery.refetch()
  }

  if (hasData) return children
  if (isError || hasTimedOut) return <CatalogoError onRetry={handleRetry} />
  if (isLoadedEmpty) return <CatalogoVacio onRetry={handleRetry} />
  return <PageSkeleton pathname={loadingPathname} reserveClassName={loadingReserveClassName} />
}

export default RequireCatalog
