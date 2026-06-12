import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  useMarcarLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
  useUnreadCount,
} from '../hooks/useNotificaciones'
import { getToken, onTokenChange } from '../lib/api'
import { formatRelativeSafe } from '../lib/dateUtils'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'

/**
 * Campanita de notificaciones en el header — los despachos oficiales.
 *
 * Botón con badge del count de no leídas. Click → dropdown con últimas 10,
 * cada una leída como un despacho sellado: sello lacrado en miniatura por
 * tipo (kanji con significado, color por token), hairline de tinta carmesí
 * para lo no leído (muere en opacity al marcarse, sin desmontar el nodo) y
 * fecha de registro en mono en la esquina. La fila entera es el target —
 * sin chevron ni dot: la categoría vive en el sello, el estado en la tinta.
 *
 * Live updates: el hook subyacente se suscribe al user queue STOMP; al
 * llegar un push el badge se incrementa solo y dispara UNA onda dorada
 * (one-shot re-keyed por contador, jamás loop).
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
  const reducedMotion = useReducedMotionPref()

  const { data: countData } = useUnreadCount({ enabled: hasAccessToken })
  const unread = hasAccessToken ? countData?.count ?? 0 : 0

  // Onda dorada one-shot cuando el count SUBE en caliente (push STOMP).
  // Patrón "ajustar estado durante el render": la primera hidratación del
  // count solo fija la línea base — recargar con no-leídas no ondea.
  const [prevUnread, setPrevUnread] = useState(null)
  const [wave, setWave] = useState(0)
  if (countData !== undefined && prevUnread === null) {
    setPrevUnread(unread)
  } else if (countData !== undefined && unread !== prevUnread) {
    setPrevUnread(unread)
    if (unread > prevUnread) setWave((w) => w + 1)
  }
  // La onda se desmonta por TIMER, no por animationend: reduced-motion (y la
  // emulación del e2e) anulan la animación por CSS y ese evento nunca llega.
  // Efímera de verdad: cero nodos muertos junto al badge.
  useEffect(() => {
    if (wave === 0) return undefined
    const t = setTimeout(() => setWave(0), 800)
    return () => clearTimeout(t)
  }, [wave])

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
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {/* La onda vive FUERA del botón (hermana posicionada sobre él): el
          contenido del botón es contrato del e2e — un único span, el badge. */}
      {wave > 0 && !reducedMotion && (
        <span
          key={wave}
          aria-hidden="true"
          className="as-notif-onda pointer-events-none absolute -inset-1 rounded-full border-2 border-gold opacity-0"
        />
      )}

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
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            lang="ja"
            aria-hidden="true"
            className="inline-flex h-[22px] w-[22px] shrink-0 -rotate-3 items-center justify-center rounded-full border-[1.5px] border-hanko/60 font-jp text-[11px] font-bold leading-none text-hanko"
          >
            報
          </span>
          <div>
            <h3 className="font-display text-[15px] font-bold leading-tight text-fg-strong">
              Despachos oficiales
            </h3>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              Comunicados de la federación para tu cuenta.
            </p>
          </div>
        </div>
        {hayNoLeidas && (
          <button
            type="button"
            onClick={() => marcarTodasLeidas.mutate()}
            disabled={marcarTodasLeidas.isPending}
            className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-fg-muted transition-colors hover:text-gold disabled:opacity-50"
          >
            Marcar todas
          </button>
        )}
      </header>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <GhostDespachos />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-9">
            <span
              lang="ja"
              aria-hidden="true"
              className="font-display text-6xl leading-none text-gold/15"
            >
              静
            </span>
            <p className="text-[12px] text-fg-muted">Sin novedades en el dojo.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
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

/** Ghost-despachos de carga con el barrido de marca (.skl, transform-only). */
function GhostDespachos() {
  return (
    <div role="status" aria-label="Cargando despachos">
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-start gap-3 border-b border-border/40 py-3 pl-[18px] pr-4"
        >
          <span className="skl h-9 w-9 shrink-0 rounded-full bg-surface-alt" />
          <span className="min-w-0 flex-1">
            <span className="skl block h-3.5 w-2/5 rounded bg-surface-alt" />
            <span className="skl mt-2 block h-3 w-4/5 rounded bg-surface-alt" />
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Mapa tipo → sello. Kanji con significado real; color SIEMPRE vía tokens.
 * SISTEMA migra de rarity-epic (morado, fuera de marca aquí) a --color-hanko,
 * el bermellón del sello oficial. La tinta carmesí usa text-accent-text (el
 * accent puro como texto falla AA sobre el lienzo); borde y hairline sí
 * beben de accent.
 */
const TIPO_SELLO = {
  BIENVENIDA: { kanji: '迎', cls: 'border-success/60 bg-success/12 text-success' },
  TORNEO_APROBADO: { kanji: '認', cls: 'border-success/60 bg-success/12 text-success' },
  TORNEO_RECHAZADO: { kanji: '否', cls: 'border-danger/60 bg-danger/12 text-danger' },
  TORNEO_INICIADO: { kanji: '戦', cls: 'border-accent/70 bg-accent/15 text-accent-text' },
  TORNEO_FINALIZADO: { kanji: '決', cls: 'border-gold/60 bg-gold/12 text-gold' },
  BADGE_DESBLOQUEADO: { kanji: '章', cls: 'border-gold/60 bg-gold/12 text-gold-bright' },
  SEGUIDOR_NUEVO: { kanji: '縁', cls: 'border-info/60 bg-info/12 text-info' },
  FAVORITO_MOVIMIENTO: { kanji: '昇', cls: 'border-electric/60 bg-electric/10 text-electric' },
  SISTEMA: { kanji: '報', cls: 'border-hanko/60 bg-hanko/12 text-hanko' },
  DEFAULT: { kanji: '報', cls: 'border-border bg-surface-alt text-fg-muted' },
}

function SelloDespacho({ tipo }) {
  const sello = TIPO_SELLO[tipo] ?? TIPO_SELLO.DEFAULT
  return (
    <span
      lang="ja"
      aria-hidden="true"
      className={`as-sello-despacho inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] font-jp text-[15px] font-bold leading-none ${sello.cls}`}
    >
      {sello.kanji}
    </span>
  )
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

function NotifItem({ notif, onClick }) {
  const target = enlaceDeNotif(notif)
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${target ? 'Abrir' : 'Marcar'} notificación: ${notif.titulo}`}
        className={`group relative flex w-full items-start gap-3 py-3 pl-[18px] pr-4 text-left transition-[background-color,opacity] duration-150 hover:bg-surface-alt ${
          notif.leida ? 'opacity-75 hover:opacity-100' : ''
        }`}
      >
        {/* Tinta de no-leído: muere en opacity, el nodo no se desmonta. */}
        <span
          aria-hidden="true"
          className={`absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-accent-text to-accent transition-opacity duration-500 ${
            notif.leida ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <SelloDespacho tipo={notif.tipo} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold leading-5 text-fg-strong">
              {notif.titulo}
            </span>
            <time className="shrink-0 font-mono text-[10.5px] text-fg-muted/85">
              {formatRelativo(notif.creadoEn)}
            </time>
          </span>
          {notif.mensaje && (
            <span className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">
              {notif.mensaje}
            </span>
          )}
        </span>
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
