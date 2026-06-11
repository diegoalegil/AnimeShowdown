import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import LegendaryGallery from '../features/cartas/LegendaryGallery'

/**
 * Salón Legendario: galería pública de todas las cartas ESPECIAL curadas
 * (arte de autor). Showcase / marketing — cualquiera ve el arte; el dueño las
 * consigue en sobres y las usa. Consume GET /api/cartas/especiales (público).
 *
 * El estado de éxito es la museografía de "galería a oscuras"
 * (LegendaryGallery): estanterías de 4 con spotlights que se encienden al
 * entrar al viewport, penumbra compartida en hover y placa de museo por
 * pieza. Loading/error/empty conservan su presentación de siempre.
 */
function EspecialesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cartas', 'especiales'],
    queryFn: endpoints.especialesCuradas,
    staleTime: 5 * 60 * 1000,
  })

  const cartas = Array.isArray(data) ? data : []
  const conPiezas = !isLoading && !isError && cartas.length > 0

  if (conPiezas) return <LegendaryGallery cartas={cartas} />

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-fg-strong sm:text-3xl">
          Salón Legendario
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-fg-muted">
          El arte de autor de AnimeShowdown. Cada carta especial es única —
          consíguelas abriendo sobres.
        </p>
      </header>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-2xl bg-surface/40"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="py-12 text-center text-sm text-fg-muted">
          No se pudo cargar el Salón. Inténtalo más tarde.
        </p>
      )}

      {!isLoading && !isError && cartas.length === 0 && (
        <p className="py-12 text-center text-sm text-fg-muted">
          Aún no hay cartas especiales. Vuelve pronto.
        </p>
      )}
    </main>
  )
}

export default EspecialesPage
