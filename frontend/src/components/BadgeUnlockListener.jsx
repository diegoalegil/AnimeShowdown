import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trophy } from 'lucide-react'
import { iconoDeBadge } from '../lib/badgeIcons'
import { kanjiDeBadge } from '../lib/badgeKanji'
import { rarezaToKey } from '../features/logros/medal-rarity'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useStompSubscription } from '../hooks/useStompSubscription'

// Acuñación de medalla: lazy con el mismo espíritu que el canvas-confetti
// al que sustituye — cero bytes en el bundle raíz hasta el primer logro.
const MedalMint = lazy(() => import('../features/logros/MedalMint'))

/**
 * Side-effect global: escucha el user-queue WS y dispara la ceremonia de
 * acuñación + toast + sound cuando llega una notificación BADGE_DESBLOQUEADO.
 *
 * La medalla gira con grosor real, se acuña con squash y estallido de tinta
 * sumi-e (variantes por rareza) y muestra el KANJI REAL del badge
 * (lib/badgeKanji). El sonido suena en el frame exacto del golpe. Sustituye
 * al canvas-confetti genérico; el toast de sonner se conserva porque lleva
 * el CTA "Ver" al logro concreto.
 *
 * Solo se monta cuando hay user logueado. Con prefers-reduced-motion la
 * ceremonia se omite (el propio MedalMint degrada, pero ni lo cargamos) y
 * el sonido suena al llegar, como siempre.
 */
function BadgeUnlockListener() {
  const { user } = useAuth()
  const { play } = useSound()
  const navigate = useNavigate()
  const [unlock, setUnlock] = useState(null)
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

    // 1) Ceremonia de acuñación (o sonido directo bajo reduced-motion).
    //    setState diferido a microtask: el effect solo reacciona al push del
    //    WS (mismo patrón que DueloLivePage con aplicarEstado).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        play('playLevelUp')
      } catch {
        /* ignore */
      }
    } else {
      queueMicrotask(() =>
        setUnlock({
          titulo: lastMessage.titulo || '¡Logro desbloqueado!',
          rarity: rarezaToKey(payload.rareza),
          kanji: (payload.codigo && kanjiDeBadge(payload.codigo)) || '章',
        }),
      )
    }

    // 2) Toast 6s con el icono del badge. Click → logro concreto.
    toast.success(lastMessage.titulo || '¡Logro desbloqueado!', {
      description: lastMessage.mensaje,
      icon: <IconBadge className="h-5 w-5 text-gold" />,
      duration: 6000,
      action: {
        label: 'Ver',
        onClick: () => {
          const destino = payload.codigo
            ? `/logros?logro=${encodeURIComponent(payload.codigo)}`
            : '/logros'
          navigate(destino)
        },
      },
    })
  }, [lastMessage, play, navigate])

  if (!unlock) return null
  return (
    <Suspense fallback={null}>
      <MedalMint
        title={unlock.titulo}
        rarity={unlock.rarity}
        kanji={unlock.kanji}
        onStrike={() => {
          try {
            play('playLevelUp')
          } catch {
            /* ignore */
          }
        }}
        onDone={() => setUnlock(null)}
      />
    </Suspense>
  )
}

export default BadgeUnlockListener
