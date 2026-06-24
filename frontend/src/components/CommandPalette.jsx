import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
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
  Flame,
  LogOut,
  Tv,
  Sparkles,
  Brain,
  HelpCircle,
  Code2,
  Gamepad2,
  Eye,
  Type,
  Grid3X3,
  Network,
  BookOpen,
  Activity,
  CalendarDays,
  FileText,
  Heart,
  PlusCircle,
  ShieldCheck,
  UserCircle,
} from 'lucide-react'
import {
  CATALOGO_PERSONAJES_HYDRATED_EVENT,
  personajes,
} from '../lib/personajes-core'
import { useTorneos } from '../lib/torneosQueries'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useCalmMode } from '../hooks/useCalmMode'
import { playWhoosh } from '../lib/sounds'
import PersonajeImg from './PersonajeImg'

const rutas = [
  { to: '/', label: 'Inicio', icon: Home, searchTerms: 'home portada' },
  { to: '/personajes', label: 'Personajes', icon: Users, searchTerms: 'catalogo roster' },
  { to: '/animes', label: 'Animes', icon: Tv, searchTerms: 'series universos' },
  { to: '/torneos', label: 'Torneos', icon: Trophy, searchTerms: 'brackets campeonatos' },
  { to: '/eventos', label: 'Eventos', icon: CalendarDays, searchTerms: 'temporadas especiales pulso' },
  { to: '/votar', label: 'Votar', icon: Swords, searchTerms: 'duelo arena versus' },
  { to: '/comparar', label: 'Comparar personajes', icon: Swords, searchTerms: 'comparar versus vs duelo personajes anime' },
  { to: '/duel-live', label: 'Duelos live PvP', icon: Swords, searchTerms: 'pvp directo versus' },
  { to: '/games', label: 'Anime Games Hub', icon: Gamepad2, searchTerms: 'juegos daily trials' },
  { to: '/juegos/anime', label: 'Juegos anime online', icon: Gamepad2, searchTerms: 'seo juegos anime online daily trials' },
  { to: '/misiones', label: 'Misiones diarias', icon: CalendarDays, searchTerms: 'mision diaria ritual racha progreso daily loop' },
  { to: '/games/shadow-guess', label: 'Shadow Guess (Guess the Character)', icon: Eye, searchTerms: 'guess character silueta personaje' },
  { to: '/games/anime-reveal', label: 'Anime Reveal (Guess the Anime)', icon: Type, searchTerms: 'guess anime adivinar serie' },
  { to: '/games/oraculo', label: 'Oráculo Anime (Akinator)', icon: Brain, searchTerms: 'oraculo akinator adivinar personaje reglas' },
  { to: '/games/anigrid', label: 'AniGrid (Anidel · Wordle)', icon: Grid3X3, searchTerms: 'wordle personajes anidel' },
  { to: '/games/nexo-anime', label: 'Nexo Anime (Conexiones)', icon: Network, searchTerms: 'conexiones parejas anime puzzle' },
  { to: '/games/impostor-trial', label: 'Impostor Trial (Detector de Impostor)', icon: Sparkles, searchTerms: 'traidor impostor trial' },
  { to: '/games/elo-duel', label: 'ELO Duel (Higher or Lower)', icon: Sparkles, searchTerms: 'higher lower elo racha' },
  { to: '/omikuji', label: 'Omikuji — Suerte del día', icon: Sparkles, searchTerms: 'suerte diario fortuna' },
  { to: '/descubre-personaje', label: 'Descubre personaje', icon: Sparkles, searchTerms: 'random aleatorio descubrir personaje anime' },
  { to: '/ranking', label: 'Ranking ELO', icon: TrendingUp, searchTerms: 'clasificacion leaderboard top' },
  { to: '/fantasy', label: 'Fantasy Showdown', icon: Trophy, searchTerms: 'draft presupuesto equipo semanal fantasy leaderboard' },
  { to: '/mi-ranking', label: 'Mi ranking personal', icon: Trophy, searchTerms: 'ranking personal votos locales top personajes' },
  { to: '/leaderboards', label: 'Pioneros', icon: TrendingUp, searchTerms: 'comunidad usuarios ranking' },
  { to: '/logros', label: 'Logros — Catálogo de badges', icon: Trophy, searchTerms: 'badges achievements rareza' },
  { to: '/mi-top5', label: 'Mi Top 5 — Imagen compartible', icon: Sparkles, searchTerms: 'share top favoritos' },
  { to: '/tier-lists', label: 'Tier lists — Creator', icon: Sparkles, searchTerms: 'tier list ranking export png' },
  { to: '/tv', label: 'Modo TV', icon: Tv, searchTerms: 'pantalla fullscreen directo' },
  { to: '/apoya', label: 'Apoya AnimeShowdown', icon: Heart, searchTerms: 'donar soporte apoyo' },
  { to: '/como-funciona', label: 'Cómo funciona', icon: HelpCircle, searchTerms: 'guia producto votar daily ranking' },
  { to: '/metodologia-elo', label: 'Metodología del ranking', icon: ShieldCheck, searchTerms: 'elo ranking votos metodologia' },
  { to: '/faq', label: 'Preguntas frecuentes', icon: HelpCircle, searchTerms: 'ayuda dudas' },
  { to: '/glossary', label: 'Glosario otaku', icon: BookOpen, searchTerms: 'terminos anime diccionario' },
  { to: '/api-docs', label: 'API pública', icon: Code2, searchTerms: 'swagger docs desarrolladores' },
  { to: '/status', label: 'Estado del servicio', icon: Activity, searchTerms: 'status uptime salud api' },
  { to: '/privacidad', label: 'Privacidad', icon: FileText, searchTerms: 'privacy datos legal' },
  { to: '/terminos', label: 'Términos', icon: FileText, searchTerms: 'terms condiciones legal' },
  { to: '/dmca', label: 'DMCA', icon: FileText, searchTerms: 'copyright legal takedown' },
]

const rutasInvitado = [
  { to: '/login', label: 'Iniciar sesión', icon: LogIn, searchTerms: 'login entrar cuenta' },
  { to: '/register', label: 'Crear cuenta', icon: UserPlus, searchTerms: 'registro signup' },
  { to: '/forgot-password', label: 'Recuperar contraseña', icon: HelpCircle, searchTerms: 'reset password contraseña' },
]

// Destinos sugeridos cuando el campo está vacío: aceleran el descubrimiento
// para quien abre el palette por primera vez sin saber qué teclear. Solo rutas
// SIEMPRE válidas (sin depender de la hidratación del catálogo): el loop de
// producto (votar/ranking), un juego destacado y un personaje aleatorio real
// (la ruta /descubre-personaje lo resuelve, sin inventar nombres aquí).
const sugerencias = [
  { to: '/votar', label: 'Votar un duelo', icon: Swords, hint: 'el bucle principal' },
  { to: '/ranking', label: 'Ranking ELO', icon: TrendingUp, hint: 'quién manda hoy' },
  { to: '/descubre-personaje', label: 'Descubre un personaje', icon: Sparkles, hint: 'aleatorio' },
  { to: '/games/shadow-guess', label: 'Shadow Guess', icon: Eye, hint: 'juego diario' },
]

const rutasUsuario = [
  { to: '/perfil', label: 'Mi perfil', icon: UserCircle, searchTerms: 'cuenta ajustes usuario' },
  { to: '/torneos/crear', label: 'Crear torneo', icon: PlusCircle, searchTerms: 'nuevo bracket campeonato' },
]

const rutasAdmin = [
  { to: '/admin', label: 'Panel admin', icon: ShieldCheck, searchTerms: 'moderacion administrador' },
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
  // initialOpen permite al wrapper LazyMount abrir
  // el dialog directamente al primer atajo, sin depender de re-dispatch
  // del KeyboardEvent (que podía tragarse en redes lentas porque el
  // listener interno aún no estaba registrado cuando se re-emitía).
  const [open, setOpen] = useState(initialOpen)
  const [search, setSearch] = useState('')
  const inputId = useId()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { muted, toggleMute } = useSound()
  const { calm, toggle: toggleCalm } = useCalmMode()
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
      // ESC cierra el dialog cuando ya no usamos
      // Command.Dialog (Radix lo manejaba antes). Tab no necesita trap
      // explicito porque el palette tiene solo un input focusable +
      // los items son keyboard-navigable via cmdk internamente.
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setSearch('')
        setOpen(false)
        return
      }
      // escucha K y J. Antes solo K;
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

  // focus trap + restore al cerrar.
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

  // Hairline carmesí que persigue la selección + contador del pie. cmdk
  // gestiona la selección con aria-selected; aquí solo medimos el item
  // seleccionado y movemos el rail por translateY/height vía ref — cero
  // re-renders. Un MutationObserver (aria-selected + childList) cubre
  // flechas, puntero y refiltrados; el rAF coalesce ráfagas.
  const listRef = useRef(null)
  const railRef = useRef(null)
  const counterRef = useRef(null)
  const decorRafRef = useRef(null)
  const syncListDecor = useCallback(() => {
    cancelAnimationFrame(decorRafRef.current)
    decorRafRef.current = requestAnimationFrame(() => {
      const list = listRef.current
      if (!list) return
      if (counterRef.current) {
        const n = list.querySelectorAll('[cmdk-item]:not([aria-disabled="true"])').length
        counterRef.current.textContent = n === 1 ? '1 resultado' : `${n} resultados`
      }
      const rail = railRef.current
      if (!rail) return
      const item = list.querySelector('[cmdk-item][aria-selected="true"]')
      if (!item) {
        rail.style.opacity = '0'
        return
      }
      const pad = Math.round(item.offsetHeight * 0.15)
      rail.style.opacity = '1'
      rail.style.height = `${item.offsetHeight - pad * 2}px`
      rail.style.transform = `translateY(${item.offsetTop + pad}px)`
    })
  }, [])
  useEffect(() => {
    if (!open) return undefined
    syncListDecor()
    const list = listRef.current
    const observer = new MutationObserver(syncListDecor)
    if (list) {
      // Solo aria-selected y altas/bajas de items: los writes de estilo del
      // propio rail no entran en el filtro — sin bucle de mutaciones.
      observer.observe(list, { subtree: true, childList: true, attributeFilter: ['aria-selected'] })
    }
    return () => {
      observer.disconnect()
      cancelAnimationFrame(decorRafRef.current)
    }
  }, [open, syncListDecor])

  if (!open) return null

  return (
    /*
      a11y: reemplazado Command.Dialog (que
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
      className="fixed inset-0 z-50 flex items-start justify-center max-sm:px-0 max-sm:pt-0 px-3 pt-[15vh] sm:px-4"
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
        tabIndex={-1}
        className="fixed inset-0 cursor-default bg-black/75"
        onClick={() => {
          setSearch('')
          setOpen(false)
        }}
      />
      <Command
        label="Buscador rápido"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border-gold-subtle bg-surface shadow-2xl max-sm:rounded-t-none max-sm:border-x-0 max-sm:border-t-0"
      >
        {/* Marca de agua del archivo — decorativa, bajo el contenido. */}
        <div
          aria-hidden="true"
          className="font-kanji-serif pointer-events-none absolute -top-9 right-1 z-0 select-none text-[210px] leading-none text-gold opacity-5"
        >
          検
        </div>
        <div className="relative z-10 flex items-center gap-3 border-b border-border-gold-subtle px-4 py-3">
          <span aria-hidden="true" className="font-kanji-serif text-[15px] leading-none text-gold/70">
            検
          </span>
          {/*
            sin autoFocus. Antes el input
            se autofocuseaba en el commit y mi useEffect del focus trap
            capturaba activeElement DESPUÉS — terminaba guardando el
            propio input como "trigger previo" y al cerrar intentaba
            restaurar a un nodo desmontado. Ahora el effect captura el
            previo PRIMERO y luego enfoca el input manualmente.
          */}
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Busca personajes, torneos o comandos…"
            className="flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none"
          />
          <kbd className="hidden rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-fg-muted sm:inline-block">
            ESC
          </kbd>
        </div>
        <Command.List ref={listRef} className="scrollbar-hide relative z-10 max-h-[60vh] overflow-y-auto p-2">
          {/* La hairline que persigue: posicionada por syncListDecor vía ref. */}
          <div aria-hidden="true" ref={railRef} className="as-cmdk-rail absolute left-0 top-0 w-0.5" />
          <Command.Empty className="py-9 text-center">
            <span className="relative mx-auto block w-fit overflow-hidden leading-none">
              <span className="font-kanji-serif block text-[76px] text-gold/80">無</span>
              <span aria-hidden="true" className="as-cmdk-mu-cover absolute inset-0 bg-surface" />
            </span>
            <span className="as-cmdk-mu-text mt-2 block text-sm text-fg-muted">
              Nada en los archivos
            </span>
          </Command.Empty>
          {search.trim() === '' && (
            <Command.Group
              heading="Sugerencias"
              className="font-mono text-[11px] text-fg-muted"
            >
              {sugerencias.map(({ to, label, icon: Icon, hint }) => (
                <Command.Item
                  key={`sug-${to}`}
                  value={`sugerencia ${label} ${to}`}
                  onSelect={() => go(to)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-gold-subtle bg-gold/[0.04] px-3 py-2 text-sm text-fg-strong aria-selected:border-border-gold aria-selected:bg-gold/[0.08]"
                >
                  <Icon className="h-4 w-4 text-gold" />
                  <span className="flex-1">{label}</span>
                  <span className="text-[11px] normal-case tracking-normal text-fg-muted">{hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {queryPersonajes.length >= 2 && (
            <PersonajesCommandGroup
              personajesPalette={personajesPalette}
              go={go}
            />
          )}
          <Command.Group
            heading="Páginas"
            className="font-mono text-[11px] text-fg-muted"
          >
            {rutas.map(({ to, label, icon: Icon, searchTerms = '' }) => (
              <Command.Item
                key={to}
                value={`pagina ${label} ${to} ${searchTerms}`}
                onSelect={() => go(to)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
              >
                <Icon className="h-4 w-4 text-fg-muted" />
                {label}
              </Command.Item>
            ))}
            {!user &&
              rutasInvitado.map(({ to, label, icon: Icon, searchTerms = '' }) => (
                <Command.Item
                  key={to}
                  value={`acceso ${label} ${to} ${searchTerms}`}
                  onSelect={() => go(to)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
                >
                  <Icon className="h-4 w-4 text-fg-muted" />
                  {label}
                </Command.Item>
              ))}
            {user &&
              rutasUsuario.map(({ to, label, icon: Icon, searchTerms = '' }) => (
                <Command.Item
                  key={to}
                  value={`usuario ${label} ${to} ${searchTerms}`}
                  onSelect={() => go(to)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
                >
                  <Icon className="h-4 w-4 text-fg-muted" />
                  {label}
                </Command.Item>
              ))}
            {user?.rol === 'ADMIN' &&
              rutasAdmin.map(({ to, label, icon: Icon, searchTerms = '' }) => (
                <Command.Item
                  key={to}
                  value={`admin ${label} ${to} ${searchTerms}`}
                  onSelect={() => go(to)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
                >
                  <Icon className="h-4 w-4 text-fg-muted" />
                  {label}
                </Command.Item>
              ))}
          </Command.Group>

          <Command.Group
            heading="Acciones"
            className="mt-2 font-mono text-[11px] text-fg-muted"
          >
            <Command.Item
              value="sonido toggle"
              onSelect={() => {
                toggleMute()
                setSearch('')
                setOpen(false)
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
            >
              {muted ? (
                <Volume2 className="h-4 w-4 text-fg-muted" />
              ) : (
                <VolumeX className="h-4 w-4 text-fg-muted" />
              )}
              {muted ? 'Activar sonidos' : 'Silenciar sonidos'}
            </Command.Item>
            <Command.Item
              value="modo calma linterna reducir animaciones movimiento"
              onSelect={() => {
                toggleCalm()
                setSearch('')
                setOpen(false)
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
            >
              <Flame className="h-4 w-4 text-fg-muted" />
              {calm ? 'Desactivar modo calma' : 'Activar modo calma'}
            </Command.Item>
            {user && (
              <Command.Item
                value="cerrar sesion"
                onSelect={() => {
                  logout()
                  setSearch('')
                  setOpen(false)
                }}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
              >
                <LogOut className="h-4 w-4 text-fg-muted" />
                Cerrar sesión
              </Command.Item>
            )}
          </Command.Group>

          {torneos.length > 0 && (
            <Command.Group
              heading="Torneos"
              className="mt-2 font-mono text-[11px] text-fg-muted"
            >
              {torneos.map((t) => (
                <Command.Item
                  key={t.slug}
                  value={`torneo ${t.nombre}`}
                  onSelect={() => go(`/torneos/${t.slug}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg aria-selected:text-fg-strong"
                >
                  <Trophy className="h-4 w-4 text-fg-muted" />
                  {t.nombre}
                  <span className="ml-auto text-[11px] text-fg-muted">
                    {t.numParticipantes} personajes
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {queryPersonajes.length < 2 && (
            <Command.Group
              heading="Personajes"
              className="mt-2 font-mono text-[11px] text-fg-muted"
            >
              <Command.Item
                disabled
                value="personajes escribe dos letras"
                className="rounded-lg px-3 py-2 text-sm normal-case tracking-normal text-fg-muted"
              >
                Escribe al menos 2 letras para buscar entre todos los personajes.
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
        <div className="relative z-10 flex items-center gap-4 border-t border-border-gold-subtle px-4 py-2 font-mono text-[11px] text-fg-muted">
          <span>
            <kbd>↑↓</kbd> navegar
          </span>
          <span>
            <kbd>↵</kbd> abrir
          </span>
          <span>
            <kbd>esc</kbd> cerrar
          </span>
          <span ref={counterRef} className="ml-auto text-fg-muted" />
        </div>
        {/* Corte de tinta: cover de entrada que se retira con filo dorado.
            Animación CSS de montaje — se reproduce en cada apertura porque
            el palette desmonta entero al cerrarse. */}
        <div aria-hidden="true" className="as-cmdk-cover pointer-events-none absolute inset-0 z-20 bg-canvas">
          <div className="as-cmdk-edge absolute inset-y-0 right-0 w-[3px]" />
        </div>
      </Command>
    </div>
  )
}

function PersonajesCommandGroup({ personajesPalette, go }) {
  return (
    <Command.Group
      heading="Personajes"
      className="font-mono text-[11px] text-fg-muted"
    >
      {personajesPalette.length === 0 && (
        <Command.Item
          disabled
          value="personajes sin resultados"
          className="rounded-lg px-3 py-2 text-sm normal-case tracking-normal text-fg-muted"
        >
          No hay personajes con esa búsqueda.
        </Command.Item>
      )}
      {personajesPalette.map((p) => (
        <Command.Item
          key={p.slug}
          value={`personaje ${p.nombre} ${p.anime}`}
          onSelect={() => go(`/personajes/${p.slug}`)}
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-fg aria-selected:text-fg-strong"
        >
          <PersonajeImg
            slug={p.slug}
            src={p.imagenUrl}
            nombre={p.nombre}
            alt={p.nombre}
            loading="lazy"
            sizes="32px"
            className="h-[45px] w-[30px] shrink-0 rounded border border-border-gold-subtle object-cover object-top"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{p.nombre}</span>
            <span className="truncate text-[11px] text-fg-muted">{p.anime}</span>
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  )
}

export default CommandPalette
