import { useEffect, useState } from 'react'
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
import { personajes, imagenPersonaje } from '../data/personajes'
import { useTorneos } from '../lib/torneosQueries'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { playWhoosh } from '../lib/sounds'

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
  { to: '/leaderboards', label: 'Top voters', icon: TrendingUp },
  { to: '/faq', label: 'Preguntas frecuentes', icon: HelpCircle },
  { to: '/api-docs', label: 'API pública', icon: Code2 },
]

const rutasInvitado = [
  { to: '/login', label: 'Iniciar sesión', icon: LogIn },
  { to: '/register', label: 'Crear cuenta', icon: UserPlus },
]

function CommandPalette({ initialOpen = false } = {}) {
  // Audit P2 (2026-05-17): initialOpen permite al wrapper LazyMount abrir
  // el dialog directamente al primer atajo, sin depender de re-dispatch
  // del KeyboardEvent (que podía tragarse en redes lentas porque el
  // listener interno aún no estaba registrado cuando se re-emitía).
  const [open, setOpen] = useState(initialOpen)
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { muted, toggleMute } = useSound()
  // Lista del backend. Si aún no llegó (loading) o falló, mostramos el
  // resto del palette sin la sección "Torneos" — la búsqueda de personajes
  // sigue funcionando.
  const { data: torneos = [] } = useTorneos()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => {
          const next = !o
          if (next) {
            const muted = localStorage.getItem('animeshowdown.muted') === 'true'
            if (!muted) playWhoosh()
          }
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (path) => {
    setOpen(false)
    const muted = localStorage.getItem('animeshowdown.muted') === 'true'
    if (!muted) playWhoosh()
    navigate(path)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Buscador rápido"
      description="Busca personajes, torneos y secciones. Usa flechas para navegar y Enter para abrir."
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      {/*
        Audit a11y (2026-05-17): cmdk@1.x usa Radix Dialog por debajo y
        emite warnings si falta DialogTitle/Description. Las renderizamos
        sr-only — la pantalla ya muestra el icono Search y el placeholder
        del input. Sin esto, consola escupia 'DialogContent requires a
        DialogTitle' en cada apertura.
      */}
      <h2 className="sr-only">Buscador rápido</h2>
      <p className="sr-only">
        Busca personajes, torneos y secciones. Usa flechas para navegar y Enter para abrir.
      </p>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-fg-muted" />
          <Command.Input
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
          <Command.Group
            heading="Páginas"
            className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
          >
            {rutas.map(({ to, label, icon: Icon }) => (
              <Command.Item
                key={to}
                value={`pagina ${label}`}
                onSelect={() => go(to)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-accent"
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
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-accent"
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
                setOpen(false)
              }}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-accent"
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
                  setOpen(false)
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-accent"
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
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-accent"
              >
                <Trophy className="h-4 w-4 text-fg-muted" />
                {t.nombre}
                <span className="ml-auto text-[11px] text-fg-muted">
                  {t.numParticipantes} personajes
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            heading="Personajes"
            className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
          >
            {personajes.map((p) => (
              <Command.Item
                key={p.slug}
                value={`personaje ${p.nombre} ${p.anime}`}
                onSelect={() => go(`/personajes/${p.slug}`)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-strong aria-selected:bg-surface-alt aria-selected:text-accent"
              >
                <img
                  src={imagenPersonaje(p.slug)}
                  alt=""
                  loading="lazy"
                  className="h-7 w-5 shrink-0 rounded object-cover object-top"
                />
                <span>{p.nombre}</span>
                <span className="ml-auto text-[11px] text-fg-muted">
                  {p.anime}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
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
      </div>
    </Command.Dialog>
  )
}

export default CommandPalette
