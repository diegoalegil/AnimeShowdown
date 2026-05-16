import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Inbox, Trophy } from 'lucide-react'
import {
  useMarcarLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
  useUnreadCount,
} from '../hooks/useNotificaciones'

/**
 * Campanita de notificaciones en el header (Plan v2 §2.13).
 *
 * Botón con badge del count de no leídas. Click → dropdown con últimas 10.
 * Cada item se puede marcar como leída individualmente; también hay un
 * "marcar todas leídas". El dropdown se cierra al hacer click fuera.
 *
 * Live updates: el hook subyacente useNotificaciones se suscribe al user
 * queue STOMP; cuando llega un push el badge se incrementa solo y el
 * dropdown muestra la nueva al abrir.
 */
function NotifBell() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const { data: countData } = useUnreadCount()
  const unread = countData?.count ?? 0

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
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && <NotifDropdown onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

function NotifDropdown({ onClose }) {
  const { data, isLoading } = useNotificaciones({ size: 10 })
  const marcarLeida = useMarcarLeida()
  const marcarTodasLeidas = useMarcarTodasLeidas()

  const items = data?.content ?? []
  const hayNoLeidas = items.some((n) => !n.leida)

  return (
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-surface shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-fg-strong">Notificaciones</h3>
        {hayNoLeidas && (
          <button
            type="button"
            onClick={() => marcarTodasLeidas.mutate()}
            disabled={marcarTodasLeidas.isPending}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted transition-colors hover:text-accent disabled:opacity-50"
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
  SISTEMA: Bell,
}

function NotifItem({ notif, onClick }) {
  const Icon = tipoIcono[notif.tipo] ?? Bell
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg ${
          notif.leida ? 'opacity-70' : ''
        }`}
      >
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            notif.leida
              ? 'bg-surface-alt text-fg-muted'
              : 'bg-accent/15 text-accent'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-fg-strong">
              {notif.titulo}
            </span>
            {!notif.leida && (
              <span
                aria-label="Sin leer"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
            )}
          </span>
          {notif.mensaje && (
            <span className="mt-0.5 line-clamp-2 text-[12px] text-fg-muted">
              {notif.mensaje}
            </span>
          )}
          <time className="mt-1 block text-[11px] text-fg-muted">
            {formatRelativo(notif.creadoEn)}
          </time>
        </span>
      </button>
    </li>
  )
}

/** "hace 2 min", "hace 3 h", "hace 5 días", fallback a fecha corta. */
function formatRelativo(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  const diffMs = Date.now() - fecha.getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} día${d > 1 ? 's' : ''}`
  return fecha.toLocaleDateString()
}

export default NotifBell
