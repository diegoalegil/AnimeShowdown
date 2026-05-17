import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Trophy } from 'lucide-react'
import { iconoDeBadge } from '../lib/badgeIcons'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useStompSubscription } from '../hooks/useStompSubscription'

/**
 * Side-effect global: escucha el user-queue WS y dispara toast + sound +
 * confetti cuando llega una notificación BADGE_DESBLOQUEADO (Plan v2 §4.2).
 *
 * No renderiza nada visible — solo se monta cuando hay user logueado y
 * registra el listener. La campanita ({@code NotifBell}) sigue mostrando
 * el icono en la lista de notificaciones; este componente añade el
 * feedback inmediato y celebratorio.
 */
function BadgeUnlockListener() {
  const { user } = useAuth()
  const { play } = useSound()
  const navigate = useNavigate()
  const { lastMessage } = useStompSubscription(
    user ? '/user/queue/notificaciones' : null,
  )

  useEffect(() => {
    if (!lastMessage || lastMessage?.tipo !== 'BADGE_DESBLOQUEADO') return

    // Parseamos el payload JSON crudo que envía el backend con
    // codigo + icono + rareza. Si falta o es malformado, fallback sano.
    let payload = {}
    try {
      payload = lastMessage.payload ? JSON.parse(lastMessage.payload) : {}
    } catch {
      /* payload inválido, seguimos con defaults */
    }
    const IconBadge = payload.icono ? iconoDeBadge(payload.icono) : Trophy

    // 1) Sonido — el playLevelUp ya respeta el toggle global de mute.
    try {
      play('playLevelUp')
    } catch {
      /* ignore */
    }

    // 2) Confetti suave verde esmeralda (color de unlock/achievement).
    //    Skip en reduced-motion para usuarios sensibles.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        confetti({
          particleCount: payload.rareza >= 4 ? 90 : 50,
          spread: 70,
          origin: { y: 0.7 },
          colors:
            payload.rareza === 5
              ? ['#fbbf24', '#f59e0b', '#fde68a'] // dorado para legendarios
              : payload.rareza === 4
                ? ['#a855f7', '#c084fc', '#ddd6fe'] // morado épico
                : ['#10b981', '#34d399', '#6ee7b7'], // verde general
        })
      } catch {
        /* canvas-confetti puede fallar en jsdom o navegadores sin canvas */
      }
    }

    // 3) Toast 6s con el icono del badge. Click → /perfil.
    toast.success(lastMessage.titulo || '¡Logro desbloqueado!', {
      description: lastMessage.mensaje,
      icon: <IconBadge className="h-5 w-5 text-amber-300" />,
      duration: 6000,
      action: {
        label: 'Ver',
        // Audit (2026-05-17): antes window.location.href forzaba un
        // hard reload — pierde el estado SPA, queryClient cache,
        // sesión WS abierta, etc. SPA navigate respeta el contexto.
        onClick: () => navigate('/perfil'),
      },
    })
  }, [lastMessage, play, navigate])

  return null
}

export default BadgeUnlockListener
