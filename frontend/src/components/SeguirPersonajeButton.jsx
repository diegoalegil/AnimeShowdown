import { useNavigate, useLocation } from 'react-router-dom'
import { Heart, HeartOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useToggleFavorito } from '../hooks/useFavoritos'

/**
 * Botón "Seguir" / "Siguiendo" para la ficha de personaje.
 *
 * <p>Mi roster:
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
    // El toast espera al resultado real: en error el cache hace rollback, así
    // que un toast de éxito optimista daría un feedback falso ("Sigues a X"
    // mientras se revierte). La carta (corazón) sí cambia optimista.
    toggle({
      onSuccess: () => {
        if (previo) toast(`Has dejado de seguir a ${nombre}`, { duration: 1800 })
        else toast.success(`Sigues a ${nombre}`, { duration: 1800 })
      },
      onError: () => {
        toast.error(
          previo ? `No se pudo dejar de seguir a ${nombre}` : `No se pudo seguir a ${nombre}`,
        )
      },
    })
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

  // Tres estilos dentro de la identidad fija: invitado ghost, siguiendo
  // con oro tenue, no siguiendo ghost con borde de torneo.
  const stateClasses = !user
    ? 'border border-gold/35 bg-gold/8 text-gold hover:border-gold/60 hover:bg-gold/14'
    : isFollowing
      ? 'border border-gold/55 bg-gold/14 text-gold hover:bg-gold/20'
      : 'border border-border bg-surface text-fg-strong hover:border-gold/45 hover:text-gold'

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
