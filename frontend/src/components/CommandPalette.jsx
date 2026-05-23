import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Users,
  Trophy,
  Swords,
  TrendingUp,
  LogIn,
  UserPlus,
  Volume2,
  VolumeX,
  LogOut,
  Search,
  Tv,
  Sparkles,
  HelpCircle,
  Code2,
  Gamepad2,
  Eye,
  Type,
  Grid3X3,
  BookOpen,
} from 'lucide-react'
import {
  CATALOGO_PERSONAJES_HYDRATED_EVENT,
  personajes,
} from '../lib/personajes-core'
import { useTorneos } from '../lib/torneosQueries'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { playWhoosh } from '../lib/sounds'
import PersonajeImg from './PersonajeImg'

const rutas = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/personajes', label: 'Personajes', icon: Users },
  { to: '/animes', label: 'Animes', icon: Tv },
  { to: '/torneos', label: 'Torneos', icon: Trophy },
  { to: '/votar', label: 'Votar', icon: Swords },
  { to: '/games', label: 'Anime Games Hub', icon: Gamepad2 },
  { to: '/games/shadow-guess', label: 'Shadow Guess (Guess the Character)', icon: Eye },
  { to: '/games/anime-reveal', label: 'Anime Reveal (Guess the Anime)', icon: Type },
  { to: '/games/anigrid', label: 'AniGrid (Anidel · Wordle)', icon: Grid3X3 },
  { to: '/games/impostor-trial', label: 'Impostor Trial (Detector de Impostor)', icon: Sparkles },
  { to: '/omikuji', label: 'Omikuji — Suerte del día', icon: Sparkles },
  { to: '/glossary', label: 'Glosario otaku', icon: BookOpen },
  { to: '/logros', label: 'Logros — Catálogo de badges', icon: Trophy },
  { to: '/mi-top5', label: 'Mi Top 5 — Imagen compartible', icon: Sparkles },
  { to: '/games/elo-duel', label: 'ELO Duel (Higher or Lower)', icon: Sparkles },
  { to: '/ranking', label: 'Ranking ELO', icon: TrendingUp },
  { to: '/leaderboards', label: 'Pioneros', icon: TrendingUp },
  { to: '/faq', label: 'Preguntas frecuentes', icon: HelpCircle },
  { to: '/api-docs', label: 'API pública', icon: Code2 },
]

const rutasInvitado = [
  { to: '/login', label: 'Iniciar sesión', icon: LogIn },
  { to: '/register', label: 'Crear cuenta', icon: UserPlus },
]

function normalizaBusqueda(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function buildPersonajesIndex() {
  return personajes.map((p) => ({
    personaje: p,
    searchable: normalizaBusqueda(`${p.nombre} ${p.anime} ${p.slug}`),
  }))
}

function CommandPalette({ initialOpen = false } = {}) {
  // Revisión (2026-05-17): initialOpen permite al wrapper LazyMount abrir
  // el dialog directamente al primer atajo, sin depender de re-dispatch
  // del KeyboardEvent (que podía tragarse en redes lentas porque el
  // listener interno aún no estaba registrado cuando se re-emitía).
  const [open, setOpen] = useState(initialOpen)
  const [search, setSearch] = useState('')
  const inputId = useId()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { muted, toggleMute } = useSound()
  const [personajesIndex, setPersonajesIndex] = useState(buildPersonajesIndex)
  // Lista del backend. Si aún no llegó (loading) o falló, mostramos el
  // resto del palette sin la sección "Torneos" — la búsqueda de personajes
  // sigue funcionando.
  const { data: torneos = [] } = useTorneos()
  const deferredSearch = useDeferredValue(search)
  const queryPersonajes = normalizaBusqueda(deferredSearch.trim())
  useEffect(() => {
    const onHydrated = () => setPersonajesIndex(buildPersonajesIndex())
    window.addEventListener(CATALOGO_PERSONAJES_HYDRATED_EVENT, onHydrated)
    return () => window.removeEventListener(CATALOGO_PERSONAJES_HYDRATED_EVENT, onHydrated)
  }, [])
  const personajesPalette = useMemo(() => {
    if (queryPersonajes.length < 2) return []
    const results = []
    for (const item of personajesIndex) {
      if (!item.searchable.includes(queryPersonajes)) continue
      results.push(item.personaje)
      if (results.length >= 40) break
    }
    return results
  }, [personajesIndex, queryPersonajes])

  useEffect(() => {
    const onKey = (e) => {
      // Revisión (2026-05-17): ESC cierra el dialog cuando ya no usamos
      // Command.Dialog (Radix lo manejaba antes). Tab no necesita trap
      // explicito porque el palette tiene solo un input focusable +
      // los items son keyboard-navigable via cmdk internamente.
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setSearch('')
        setOpen(false)
        return
      }
      // Revisión (2026-05-18, 5ª iter): escucha K y J. Antes solo K;
      // J solo funcionaba la primera vez (lo capturaba el wrapper
      // LazyMount para armar el mount, pero tras cerrar y volver a
      // pulsar J, el listener interno no respondía).
      if ((e.metaKey || e.ctrlKey)
          && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'j')) {
        e.preventDefault()
        setOpen((o) => {
          const next = !o
          if (next) {
            const muted = localStorage.getItem('animeshowdown.muted') === 'true'
            if (!muted) playWhoosh().catch(() => {})
          }
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Body scroll lock mientras el dialog está abierto (sustituye al lock
  // que hacía Radix Dialog antes).
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Revisión (2026-05-17, 4ª iter): focus trap + restore al cerrar.
  // Sin esto, Tab escapa al header/footer del fondo y al cerrar el
  // palette el foco se pierde a <body> en lugar de volver al trigger.
  //  - Al abrir: guarda el elemento con foco previo.
  //  - Tab/Shift+Tab dentro del dialog: rebota entre primer y último
  //    focusable del dialog.
  //  - Al cerrar: restaura el foco al elemento previo.
  // No usamos `inert` sobre #root porque el dialog vive dentro del árbol
  // React (no en un portal); inertar #root inertaría el dialog también.
  // El focus trap manual cubre el caso keyboard-only correctamente.
  const dialogRef = useRef(null)
  const lastFocusRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    // Captura el trigger ANTES de mover foco (autoFocus quitado del input).
    lastFocusRef.current = document.activeElement
    // Foco manual al primer input del dialog tras capturar el previo.
    const input = dialog.querySelector('input')
    if (input) try { input.focus({ preventScroll: true }) } catch { /* ignore */ }

    const focusables = () => Array.from(dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((el) => el.offsetParent !== null || el === document.activeElement)

    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', onKey)
    return () => {
      dialog.removeEventListener('keydown', onKey)
      // Restore focus al trigger original (header search, button, etc.)
      const prev = lastFocusRef.current
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus({ preventScroll: true }) } catch { /* element may be gone */ }
      }
    }
  }, [open])

  const go = (path) => {
    setOpen(false)
    setSearch('')
    const muted = localStorage.getItem('animeshowdown.muted') === 'true'
    if (!muted) playWhoosh()
    navigate(path)
  }

  if (!open) return null

  return (
    /*
      Revisión a11y (2026-05-17, 3ª iter): reemplazado Command.Dialog (que
      delega en Radix Dialog y emitía DialogContent requires a DialogTitle
      + aria-describedby a id inexistente porque cmdk@1.1.1 no expone los
      slots de Radix). Dialog manual: overlay + content con role/aria
      correctos y title/description sr-only con ids reales. Command (sin
      .Dialog) sólo aporta el filtrado fuzzy de cmdk.
    */
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
      aria-describedby={`${inputId}-desc`}
      className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[15vh] sm:px-4"
    >
      <h2 id={`${inputId}-title`} className="sr-only">
        Buscador rápido
      </h2>
      <p id={`${inputId}-desc`} className="sr-only">
        Busca personajes, torneos y secciones. Usa flechas para navegar y Enter para abrir.
      </p>
      <button
        type="button"
        aria-label="Cerrar buscador"
        className="fixed inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={() => {
          setSearch('')
          setOpen(false)
        }}
      />
      <Command
        label="Buscador rápido"
        className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-fg-muted" />
          {/*
            Revisión (2026-05-18, 5ª iter): sin autoFocus. Antes el input
            se autofocuseaba en el commit y mi useEffect del focus trap
            capturaba activeElement DESPUÉS — terminaba guardando el
            propio input como "trigger previo" y al cerrar intentaba
            restaurar a un nodo desmontado. Ahora el effect captura el
            previo PRIMERO y luego enfoca el input manualmente.
          */}
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Busca personajes, torneos o navega..."
            className="flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none"
          />
          <kbd className="hidden rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-fg-muted sm:inline-block">
            ESC
          </kbd>
        </div>
        <Command.List className="scrollbar-hide max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-10 text-center text-sm text-fg-muted">
            Sin resultados.
          </Command.Empty>
          {queryPersonajes.length >= 2 && (
            <PersonajesCommandGroup
              personajesPalette={personajesPalette}
              go={go}
            />
          )}
          <Command.Group
            heading="Páginas"
            className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
          >
            {rutas.map(({ to, label, icon: Icon }) => (
              <Command.Item
                key={to}
                value={`pagina ${label}`}
                onSelect={() => go(to)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-gold"
              >
                <Icon className="h-4 w-4 text-fg-muted" />
                {label}
              </Command.Item>
            ))}
            {!user &&
              rutasInvitado.map(({ to, label, icon: Icon }) => (
                <Command.Item
                  key={to}
                  value={`acceso ${label}`}
                  onSelect={() => go(to)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-gold"
                >
                  <Icon className="h-4 w-4 text-fg-muted" />
                  {label}
                </Command.Item>
              ))}
          </Command.Group>

          <Command.Group
            heading="Acciones"
            className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
          >
            <Command.Item
              value="sonido toggle"
              onSelect={() => {
                toggleMute()
                setSearch('')
                setOpen(false)
              }}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-gold"
            >
              {muted ? (
                <Volume2 className="h-4 w-4 text-fg-muted" />
              ) : (
                <VolumeX className="h-4 w-4 text-fg-muted" />
              )}
              {muted ? 'Activar sonidos' : 'Silenciar sonidos'}
            </Command.Item>
            {user && (
              <Command.Item
                value="cerrar sesion"
                onSelect={() => {
                  logout()
                  setSearch('')
                  setOpen(false)
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-gold"
              >
                <LogOut className="h-4 w-4 text-fg-muted" />
                Cerrar sesión
              </Command.Item>
            )}
          </Command.Group>

          <Command.Group
            heading="Torneos"
            className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
          >
            {torneos.map((t) => (
              <Command.Item
                key={t.slug}
                value={`torneo ${t.nombre}`}
                onSelect={() => go(`/torneos/${t.slug}`)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-gold"
              >
                <Trophy className="h-4 w-4 text-fg-muted" />
                {t.nombre}
                <span className="ml-auto text-[11px] text-fg-muted">
                  {t.numParticipantes} personajes
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          {queryPersonajes.length < 2 && (
            <Command.Group
              heading="Personajes"
              className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
            >
              <Command.Item
                disabled
                value="personajes escribe dos letras"
                className="rounded-md px-3 py-2 text-sm normal-case tracking-normal text-fg-muted"
              >
                Escribe al menos 2 letras para buscar entre todos los personajes.
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-[11px] text-fg-muted">
          <span>
            <kbd className="font-mono">⌘K</kbd> /{' '}
            <kbd className="font-mono">Ctrl K</kbd> para abrir
          </span>
          <span>
            <kbd className="font-mono">↑↓</kbd> navegar ·{' '}
            <kbd className="font-mono">↵</kbd> ir
          </span>
        </div>
      </Command>
    </div>
  )
}

function PersonajesCommandGroup({ personajesPalette, go }) {
  return (
    <Command.Group
      heading="Personajes"
      className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
    >
      {personajesPalette.length === 0 && (
        <Command.Item
          disabled
          value="personajes sin resultados"
          className="rounded-md px-3 py-2 text-sm normal-case tracking-normal text-fg-muted"
        >
          No hay personajes con esa búsqueda.
        </Command.Item>
      )}
      {personajesPalette.map((p) => (
        <Command.Item
          key={p.slug}
          value={`personaje ${p.nombre} ${p.anime}`}
          onSelect={() => go(`/personajes/${p.slug}`)}
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-gold"
        >
          <PersonajeImg
            slug={p.slug}
            src={p.imagenUrl}
            nombre={p.nombre}
            alt=""
            loading="lazy"
            sizes="32px"
            className="h-7 w-5 shrink-0 rounded object-cover object-top"
          />
          <span className="min-w-0 truncate">{p.nombre}</span>
          <span className="ml-auto max-w-[45%] truncate text-[11px] text-fg-muted">
            {p.anime}
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  )
}

export default CommandPalette
