import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Award,
  Bell,
  CheckCheck,
  Check,
  ChevronRight,
  Inbox,
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
  const hasAccessToken = useAccessTokenReady()

  const { data: countData } = useUnreadCount({ enabled: hasAccessToken })
  const unread = hasAccessToken ? countData?.count ?? 0 : 0

  // Cerrar al hacer click fuera o presionar Escape.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <NotifDropdown
            enabled={hasAccessToken}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
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
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-0 top-10 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/30"
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
    </motion.div>
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

const tipoStyle = {
  BIENVENIDA: {
    item: 'border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-surface to-surface hover:border-emerald-400/50',
    icon: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
    unread: 'bg-emerald-300',
  },
  BADGE_DESBLOQUEADO: {
    item: 'border-amber-500/30 bg-gradient-to-r from-amber-500/12 via-surface to-surface hover:border-amber-400/60 hover:from-amber-500/18',
    icon: 'border-amber-400/30 bg-amber-500/15 text-amber-300 shadow-[0_0_18px_-8px_rgba(251,191,36,0.9)]',
    unread: 'bg-amber-300',
  },
  TORNEO_APROBADO: {
    item: 'border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-surface to-surface hover:border-emerald-400/50',
    icon: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
    unread: 'bg-emerald-300',
  },
  TORNEO_RECHAZADO: {
    item: 'border-rose-500/25 bg-gradient-to-r from-rose-500/10 via-surface to-surface hover:border-rose-400/50',
    icon: 'border-rose-400/30 bg-rose-500/15 text-rose-300',
    unread: 'bg-rose-300',
  },
  TORNEO_INICIADO: {
    item: 'border-accent/25 bg-gradient-to-r from-accent/10 via-surface to-surface hover:border-accent/50',
    icon: 'border-accent/30 bg-accent/15 text-gold',
    unread: 'bg-accent',
  },
  TORNEO_FINALIZADO: {
    item: 'border-accent/25 bg-gradient-to-r from-accent/10 via-surface to-surface hover:border-accent/50',
    icon: 'border-accent/30 bg-accent/15 text-gold',
    unread: 'bg-accent',
  },
  SEGUIDOR_NUEVO: {
    item: 'border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-surface to-surface hover:border-sky-400/50',
    icon: 'border-sky-400/30 bg-sky-500/15 text-sky-300',
    unread: 'bg-sky-300',
  },
  SISTEMA: {
    item: 'border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-surface to-surface hover:border-violet-400/50',
    icon: 'border-violet-400/30 bg-violet-500/15 text-violet-300',
    unread: 'bg-violet-300',
  },
  DEFAULT: {
    item: 'border-border bg-surface hover:border-accent/30 hover:bg-bg/60',
    icon: 'border-border bg-surface-alt text-fg-muted',
    unread: 'bg-accent',
  },
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
