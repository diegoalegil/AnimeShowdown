import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints } from '../lib/api'
import { shareOrCopy } from '../lib/share'
import WrappedSanctuary from '../features/wrapped-sanctuary/WrappedSanctuary'

// Una vez al cargar el módulo (fuera de render — purity), igual que WrappedPage.
const TEMPORADA = String(new Date().getFullYear())
const TEMPORADA_NUM = Number(TEMPORADA)

/**
 * Wrapped PÚBLICO de un usuario — vista de solo lectura para compartir por URL.
 *
 * <p>Consume {@code GET /api/wrapped/u/:username}, que el backend solo sirve si
 * el dueño hizo opt-in (si no, 404 → mensaje "privado o no existe", sin revelar
 * la cuenta). Reutiliza el MISMO santuario que la vista privada, pero sin el
 * toggle de opt-in (eso es del dueño) — el visitante solo puede mirar y volver
 * a compartir el enlace.
 *
 * <p>noindex: el usuario activó COMPARTIR por enlace, no estar en buscadores;
 * además puede revertir el opt-in en cualquier momento.
 */
function WrappedPublicPage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  useSeo({ title: `Wrapped de ${username}`, noindex: true })

  const { data, isPending } = useQuery({
    queryKey: ['wrapped-publico', username],
    queryFn: () => endpoints.wrappedPublico(username),
    enabled: Boolean(username),
    staleTime: 5 * 60_000,
    retry: false, // un 404 (privado/inexistente) no debe reintentarse
  })

  if (data) {
    const wrapped = { ...data, anio: TEMPORADA_NUM }
    const compartir = async () => {
      await shareOrCopy({
        title: `El Wrapped de ${data.username} en AnimeShowdown`,
        text: `Mira el Wrapped de ${data.username} en AnimeShowdown — ${data.votosTotales} votos${
          data.fandomPrincipal ? `, fandom Nº1: ${data.fandomPrincipal}` : ''
        }. Crea el tuyo.`,
        url: typeof window !== 'undefined' ? window.location.href : '/',
      })
    }
    return (
      <WrappedSanctuary
        wrapped={wrapped}
        onCompartir={compartir}
        onVolverArena={() => navigate(user ? '/wrapped' : '/votar')}
      />
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      {isPending ? (
        <p className="py-16 text-center text-[13px] text-fg-muted">Cargando el Wrapped…</p>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-[15px] font-semibold text-fg-strong">Wrapped no disponible</p>
          <p className="text-[13px] text-fg-muted">
            Este Wrapped es privado o no existe. Su dueño decide si compartirlo.
          </p>
          <button
            type="button"
            onClick={() => navigate(user ? '/wrapped' : '/votar')}
            className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            {user ? 'Ver mi Wrapped' : 'Descubre AnimeShowdown'}
          </button>
        </div>
      )}
    </main>
  )
}

export default WrappedPublicPage
