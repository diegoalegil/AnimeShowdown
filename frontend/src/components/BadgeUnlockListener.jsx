import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trophy } from 'lucide-react'
import { iconoDeBadge } from '../lib/badgeIcons'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useStompSubscription } from '../hooks/useStompSubscription'

let confettiPromise

function loadConfetti() {
  if (!confettiPromise) {
    confettiPromise = import('canvas-confetti').then((mod) => mod.default || mod)
  }
  return confettiPromise
}

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

    // 2) Confetti sobrio con la paleta fija de marca. Skip en
    //    reduced-motion para usuarios sensibles.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void loadConfetti()
        .then((confetti) => {
          confetti({
            particleCount: payload.rareza >= 4 ? 90 : 50,
            spread: 70,
            origin: { y: 0.7 },
            colors:
              payload.rareza === 5
                ? ['#c5a15a', '#e4c36f', '#f7e6a2'] // dorado para legendarios
                : payload.rareza === 4
                  ? ['#24c6dc', '#8ddfed', '#c4f4fb'] // eléctrico para épicos
                  : ['#9f1d2c', '#be2b38', '#c5a15a'], // carmesí + oro general
          })
        })
        .catch(() => {
          /* canvas-confetti puede fallar en jsdom o navegadores sin canvas */
        })
    }

    // 3) Toast 6s con el icono del badge. Click → logro concreto.
    toast.success(lastMessage.titulo || '¡Logro desbloqueado!', {
      description: lastMessage.mensaje,
      icon: <IconBadge className="h-5 w-5 text-amber-300" />,
      duration: 6000,
      action: {
        label: 'Ver',
        // Ajuste (2026-05-17): antes window.location.href forzaba un
        // hard reload — pierde el estado SPA, queryClient cache,
        // sesión WS abierta, etc. SPA navigate respeta el contexto.
        onClick: () => {
          const destino = payload.codigo
            ? `/logros?logro=${encodeURIComponent(payload.codigo)}`
            : '/logros'
          navigate(destino)
        },
      },
    })
  }, [lastMessage, play, navigate])

  return null
}

export default BadgeUnlockListener
