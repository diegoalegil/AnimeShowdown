import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints } from '../lib/api'
import { slugifyAnime } from '../lib/animes'
import WrappedCinematic from '../features/wrapped/WrappedCinematic'

// Evaluada una vez al cargar el módulo (fuera de render — purity).
const TEMPORADA = String(new Date().getFullYear())

/**
 * Tu Wrapped — el opening de tu temporada.
 *
 * <p>El éxito renderiza el scrollytelling full-viewport (WrappedCinematic):
 * capítulos con scroll-snap sobre la scene del fandom Nº1 real, números que
 * aterrizan con SLAM ligados al scroll y la tarjeta 1080×1920 exportable
 * pintada en canvas como capítulo final. Datos = endpoints.miWrapped, tal
 * cual; la scene se resuelve con slugifyAnime(fandomPrincipal) contra el
 * banco de marca.
 *
 * <p>Vista privada del propio usuario → noindex.
 */
function WrappedPage() {
  useSeo({ title: 'Tu Wrapped', noindex: true })
  const { user } = useAuth()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['wrapped'],
    queryFn: endpoints.miWrapped,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })

  if (!user) return <Navigate to="/login" replace />

  if (data) {
    return (
      <WrappedCinematic
        data={data}
        username={data.username}
        temporada={TEMPORADA}
        fandomSlug={data.fandomPrincipal ? slugifyAnime(data.fandomPrincipal) : null}
      />
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      {isPending ? (
        <p className="py-16 text-center text-[13px] text-fg-muted">Calculando tu resumen…</p>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-[13px] text-fg-muted">No pudimos cargar tu Wrapped.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            Reintentar
          </button>
        </div>
      ) : null}
    </main>
  )
}

export default WrappedPage
