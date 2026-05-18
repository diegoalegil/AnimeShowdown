import { useNavigate, useLocation } from 'react-router-dom'
import { Heart, HeartOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useToggleFavorito } from '../hooks/useFavoritos'

/**
 * Botón "Seguir" / "Siguiendo" para la ficha de personaje.
 *
 * <p>Plan producto (2026-05-18 — Mi roster):
 * <ul>
 *   <li>Usuario logueado: estado real desde el backend, toggle con
 *       optimistic update (ver useToggleFavorito).</li>
 *   <li>Usuario invitado: click lleva a /login?next=&lt;ruta-actual&gt;
 *       para que vuelva a la ficha tras autenticarse.</li>
 *   <li>Toast sutil al cambiar estado para feedback claro sin modal.</li>
 * </ul>
 */
function SeguirPersonajeButton({ slug, nombre }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isFollowing, isPending, isReady, toggle } = useToggleFavorito(slug)

  const onClick = () => {
    if (!user) {
      // Guardamos el next como query string. /login lo lee y redirige
      // tras autenticación exitosa. Encodeamos para que rutas con
      // espacios o querystrings propios sobrevivan.
      const next = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?next=${next}`)
      return
    }
    const previo = isFollowing
    toggle()
    // Toast optimista — el rollback de useToggleFavorito al error
    // ya restaura el cache; el toast queda como "se intentó". Si
    // necesitas mostrar error, el caller puede observar isError.
    if (previo) {
      toast(`Has dejado de seguir a ${nombre}`, { duration: 1800 })
    } else {
      toast.success(`Sigues a ${nombre}`, { duration: 1800 })
    }
  }

  // Loading / pre-auth check: deshabilitamos hasta saber el estado real.
  const labelLoading = user && !isReady
  const Icon = labelLoading
    ? Loader2
    : isFollowing
      ? Heart
      : HeartOff
  const label = !user
    ? 'Sigue al personaje'
    : labelLoading
      ? 'Cargando…'
      : isFollowing
        ? 'Siguiendo'
        : 'Seguir'

  const baseClasses = 'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50'

  // Tres estilos: invitado (ghost rosa), siguiendo (relleno accent
  // semi-transparente con corazón lleno), no siguiendo (ghost border).
  const stateClasses = !user
    ? 'border border-pink-400/40 bg-pink-500/5 text-pink-200 hover:border-pink-400/60 hover:bg-pink-500/15'
    : isFollowing
      ? 'border border-pink-400/60 bg-pink-500/15 text-pink-100 hover:bg-pink-500/25'
      : 'border border-border bg-surface text-fg-strong hover:border-pink-400/50 hover:text-pink-200'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending || labelLoading}
      aria-pressed={user ? Boolean(isFollowing) : undefined}
      aria-label={
        !user
          ? `Inicia sesión para seguir a ${nombre}`
          : isFollowing
            ? `Dejar de seguir a ${nombre}`
            : `Seguir a ${nombre}`
      }
      className={`${baseClasses} ${stateClasses}`}
    >
      <Icon
        className={`h-4 w-4 ${labelLoading ? 'animate-spin' : ''} ${
          user && isFollowing ? 'fill-current' : ''
        }`}
      />
      {label}
    </button>
  )
}

export default SeguirPersonajeButton
