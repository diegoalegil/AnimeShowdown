import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  Bell,
  CheckCheck,
  Check,
  ChevronRight,
  Inbox,
  TrendingUp,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react'
import {
  useMarcarLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
  useUnreadCount,
} from '../hooks/useNotificaciones'
import { getToken, onTokenChange } from '../lib/api'
import { formatRelativeSafe } from '../lib/dateUtils'

/**
 * Campanita de notificaciones en el header.
 *
 * Botón con badge del count de no leídas. Click → dropdown con últimas 10.
 * Cada item se puede marcar como leída individualmente; también hay un
 * "marcar todas leídas". El dropdown se cierra al hacer click fuera.
 *
 * Live updates: el hook subyacente useNotificaciones se suscribe al user
 * queue STOMP; cuando llega un push el badge se incrementa solo y el
 * dropdown muestra la nueva al abrir.
 */
function useAccessTokenReady() {
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()))

  useEffect(() => onTokenChange((token) => setHasToken(Boolean(token))), [])

  return hasToken
}

function NotifBell() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const hasAccessToken = useAccessTokenReady()

  const { data: countData } = useUnreadCount({ enabled: hasAccessToken })
  const unread = hasAccessToken ? countData?.count ?? 0 : 0

  const closeAndRestoreFocus = () => {
    setOpen(false)
    // Restaura el foco al botón disparador al cerrar el popover.
    triggerRef.current?.focus()
  }

  // Cerrar al hacer click fuera o presionar Escape.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closeAndRestoreFocus()
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeAndRestoreFocus()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <NotifDropdown
          enabled={hasAccessToken}
          onClose={closeAndRestoreFocus}
        />
      )}
    </div>
  )
}

function NotifDropdown({ enabled, onClose }) {
  const { data, isLoading } = useNotificaciones({
    size: 10,
    enabled,
    subscribeToPush: false,
  })
  const marcarLeida = useMarcarLeida()
  const marcarTodasLeidas = useMarcarTodasLeidas()
  const navigate = useNavigate()

  const items = data?.content ?? []
  const hayNoLeidas = items.some((n) => !n.leida)

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Panel de notificaciones"
      className="absolute right-0 top-10 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/30 motion-safe:animate-[notifDropdownIn_150ms_ease-out]"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-fg-strong">Notificaciones</h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Logros, torneos y avisos de tu cuenta.
          </p>
        </div>
        {hayNoLeidas && (
          <button
            type="button"
            onClick={() => marcarTodasLeidas.mutate()}
            disabled={marcarTodasLeidas.isPending}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted transition-colors hover:text-gold disabled:opacity-50"
          >
            <CheckCheck className="h-3 w-3" />
            Marcar todas
          </button>
        )}
      </header>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <p className="px-4 py-6 text-center text-[12px] text-fg-muted">
            Cargando…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-fg-muted">
            <Inbox className="h-6 w-6" />
            <p className="text-[12px]">No tienes notificaciones todavía.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <NotifItem
                key={n.id}
                notif={n}
                onClick={() => {
                  if (!n.leida) marcarLeida.mutate(n.id)
                  const target = enlaceDeNotif(n)
                  if (target) navigate(target)
                  onClose()
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const tipoIcono = {
  BIENVENIDA: Trophy,
  TORNEO_INICIADO: Trophy,
  TORNEO_FINALIZADO: Trophy,
  TORNEO_APROBADO: Check,
  TORNEO_RECHAZADO: X,
  BADGE_DESBLOQUEADO: Award,
  SEGUIDOR_NUEVO: UserPlus,
  FAVORITO_MOVIMIENTO: TrendingUp,
  SISTEMA: Bell,
}

/**
 * Devuelve la ruta a la que debe navegar el click sobre una notif, o
 * null si no tiene navegación (en cuyo caso solo se marca como leída).
 * El payload viene como JSON-string; lo parseamos defensivamente porque
 * notificaciones viejas pueden no traer todos los campos.
 */
function enlaceDeNotif(notif) {
  if (!notif?.tipo) return null
  let datos
  try {
    datos = notif.payload ? JSON.parse(notif.payload) : {}
  } catch {
    datos = {}
  }

  switch (notif.tipo) {
    case 'BIENVENIDA':
      return '/perfil'
    case 'BADGE_DESBLOQUEADO':
      return datos?.codigo
        ? `/logros?logro=${encodeURIComponent(datos.codigo)}`
        : '/logros'
    case 'SEGUIDOR_NUEVO':
      return datos?.seguidorUsername
        ? `/u/${encodeURIComponent(datos.seguidorUsername)}`
        : '/perfil'
    case 'FAVORITO_MOVIMIENTO':
      return datos?.slug ? `/personajes/${encodeURIComponent(datos.slug)}` : '/ranking'
    case 'TORNEO_APROBADO':
    case 'TORNEO_INICIADO':
    case 'TORNEO_FINALIZADO':
      return datos?.slug ? `/torneos/${encodeURIComponent(datos.slug)}` : '/torneos'
    case 'TORNEO_RECHAZADO':
      // Rechazados no están en /torneos públicos. Llevamos al creador a su
      // perfil donde la card "Mis torneos" muestra el motivo.
      return '/perfil?tab=torneos'
    case 'SISTEMA':
      return '/perfil'
    default:
      return null
  }
}

// Card plana con hairline neutro; el color del tipo vive en el icono y en el
// dot de no-leído para mantener la lista más legible.
const NOTIF_ITEM = 'border-border bg-surface hover:bg-surface-alt'

const tipoStyle = {
  BIENVENIDA: { item: NOTIF_ITEM, icon: 'border-border bg-success/12 text-success', unread: 'bg-success' },
  BADGE_DESBLOQUEADO: { item: NOTIF_ITEM, icon: 'border-border bg-gold/12 text-gold', unread: 'bg-gold' },
  TORNEO_APROBADO: { item: NOTIF_ITEM, icon: 'border-border bg-success/12 text-success', unread: 'bg-success' },
  TORNEO_RECHAZADO: { item: NOTIF_ITEM, icon: 'border-border bg-danger/12 text-danger', unread: 'bg-danger' },
  TORNEO_INICIADO: { item: NOTIF_ITEM, icon: 'border-border bg-accent/12 text-gold', unread: 'bg-accent' },
  TORNEO_FINALIZADO: { item: NOTIF_ITEM, icon: 'border-border bg-accent/12 text-gold', unread: 'bg-accent' },
  SEGUIDOR_NUEVO: { item: NOTIF_ITEM, icon: 'border-border bg-info/12 text-info', unread: 'bg-info' },
  SISTEMA: { item: NOTIF_ITEM, icon: 'border-border bg-rarity-epic/12 text-rarity-epic', unread: 'bg-rarity-epic' },
  DEFAULT: { item: NOTIF_ITEM, icon: 'border-border bg-surface-alt text-fg-muted', unread: 'bg-accent' },
}

function NotifItem({ notif, onClick }) {
  const Icon = tipoIcono[notif.tipo] ?? Bell
  const style = tipoStyle[notif.tipo] ?? tipoStyle.DEFAULT
  const target = enlaceDeNotif(notif)
  return (
    <li className="p-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${target ? 'Abrir' : 'Marcar'} notificación: ${notif.titulo}`}
        className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all duration-150 ${style.item} ${
          notif.leida ? 'opacity-80 hover:opacity-100' : ''
        }`}
      >
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            notif.leida ? 'border-border bg-surface-alt text-fg-muted' : style.icon
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="line-clamp-1 text-[13px] font-bold leading-5 text-fg-strong">
              {notif.titulo}
            </span>
            {!notif.leida && (
              <span
                aria-label="Sin leer"
                className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${style.unread}`}
              />
            )}
          </span>
          {notif.mensaje && (
            <span className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">
              {notif.mensaje}
            </span>
          )}
          <time className="mt-2 block text-[11px] font-medium text-fg-muted/85">
            {formatRelativo(notif.creadoEn)}
          </time>
        </span>
        {target && (
          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-fg-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-fg-strong" />
        )}
      </button>
    </li>
  )
}

/** "hace 2 min", "hace 3 h", "hace 5 días", fallback a fecha corta. */
function formatRelativo(iso) {
  return formatRelativeSafe(iso, {
    dayLabel: (days) => `hace ${days} día${days > 1 ? 's' : ''}`,
  })
}

export default NotifBell
