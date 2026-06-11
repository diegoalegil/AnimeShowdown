import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LogOut, Menu, Search, Shield, Shuffle, Swords, Volume2, VolumeX, X } from 'lucide-react'
import { AppLink, AppNavLink } from './AppLink'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import Avatar from './Avatar'
import LanguageToggle from './LanguageToggle'
import NotifBell from './NotifBell'
import SaldoChip from './SaldoChip'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { usePersonajeRuleta } from '../hooks/usePersonajeRuleta'
import { OPEN_COMMAND_PALETTE_EVENT } from './CommandPaletteLazyMount'
import { registerRitoAvatarTarget, unregisterRitoAvatarTarget } from '../lib/viewTransitions'

// Destino del morph del rito de acuñación (registro → home): la placa del
// nuevo luchador vuela hasta el avatar del header. Hay dos avatares (cluster
// móvil y UserBadge desktop) y el CSS decide cuál se ve, así que se registran
// ambos y el morph elige el visible en el momento de salir.
function RitoAvatarTarget({ children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    registerRitoAvatarTarget(el)
    return () => unregisterRitoAvatarTarget(el)
  }, [])
  return (
    <span ref={ref} className="inline-flex rounded-full">
      {children}
    </span>
  )
}

// Nota de producto: /votar sale de los enlaces regulares y pasa a
// CTA principal del header. El login deja de ser el botón accent (estaba
// pidiendo a un usuario nuevo registrarse antes de aportar valor) y
// queda como link ghost discreto: ahora la primera acción visible es
// participar (votar) y el login es secundario para usuarios existentes.
// Inicio se quita del nav (el logo ya lleva a home) y los enlaces
// secundarios (Eventos, PvP) se agrupan en un menú "Más", para que los
// principales quepan en una fila desde lg sin saturar el header.
const primaryNavLinks = [
  { to: '/personajes', i18nKey: 'personajes' },
  { to: '/cartas', i18nKey: 'cartas' },
  { to: '/torneos', i18nKey: 'torneos' },
  { to: '/games', i18nKey: 'games' },
  { to: '/ranking', i18nKey: 'ranking' },
]
const moreNavLinks = [
  { to: '/animes', i18nKey: 'animes' },
  { to: '/especiales', i18nKey: 'especiales' },
  { to: '/tier-lists', i18nKey: 'tierLists' },
  { to: '/fantasy', i18nKey: 'fantasy' },
  { to: '/feed', i18nKey: 'feed' },
  { to: '/eventos', i18nKey: 'eventos' },
  { to: '/duel-live', i18nKey: 'pvp' },
]

const navLinkBase = 'relative rounded-lg px-3 py-2 text-sm transition-colors'

function regularLinkClass({ isActive }) {
  return `${navLinkBase} font-medium ${
    isActive
      ? 'bg-white/5 font-bold text-fg-strong underline decoration-accent decoration-2 underline-offset-4 shadow-aura'
      : 'text-fg hover:bg-white/5 hover:text-fg-strong'
  }`
}

// CTA principal de torneo: carmesí fijo + brillo dorado muy controlado.
function ctaVotarClass({ isActive }) {
  return `${navLinkBase} ml-2 inline-flex items-center gap-1.5 whitespace-nowrap border border-accent/50 bg-gradient-to-b from-accent-hover to-accent font-black text-white shadow-aura inset-shadow-hairline-strong ${
    isActive ? 'brightness-110' : 'hover:-translate-y-0.5 hover:brightness-110'
  }`
}

// Login pasa a ghost: borde sutil, texto neutro, hover acent. No grita,
// pero está siempre a la vista para los usuarios que ya tienen cuenta.
function loginGhostClass({ isActive }) {
  return `${navLinkBase} ml-1 border font-medium ${
    isActive
      ? 'border-accent bg-accent-soft text-gold'
      : 'border-border text-fg-muted hover:border-accent hover:text-gold'
  }`
}

// En móvil 390px el header ocupaba ~25% del primer
// viewport apilando logo + 7 navlinks + 5 iconos utility + login en
// flex-col. Refactor: en móvil solo logo + acción primaria (login o
// avatar+notif) + hamburger; nav y utility se abren en panel.
function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { muted, toggleMute, play } = useSound()
  // Nota de rendimiento 2026-05-18: CTAs principales del header con pointerdown
  // para que el sonido vaya por delante del click (más perceptible como
  // "instantáneo"). Aplica al "Votar ahora" desktop + "Votar" mobile.
  const ctaVotarDesktop = useInstantSoundPress('playClick')
  const ctaVotarMobile = useInstantSoundPress('playClick')
  const { girarRuleta, isLoading: ruletaLoading } = usePersonajeRuleta()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const scrolledRef = useRef(false)
  const mobileToggleRef = useRef(null)
  const mobilePanelRef = useRef(null)

  useEffect(() => {
    let frame = 0

    const updateScrolled = () => {
      frame = 0
      const nextScrolled = window.scrollY > 16
      if (scrolledRef.current === nextScrolled) return
      scrolledRef.current = nextScrolled
      setScrolled(nextScrolled)
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateScrolled)
    }

    updateScrolled()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
    }
  }, [])

  // Cuando el menu movil esta abierto, el fondo no debe scrollear y
  // el foco debe quedar atrapado dentro del panel:
  //   - Bloquear scroll del body con overflow: hidden mientras open.
  //   - Trap de Tab dentro del panel (Tab al ultimo → primero,
  //      Shift+Tab al primero → ultimo).
  //   - Escape cierra el menu y devuelve foco al toggle button.
  //   - Al abrir, mover foco al primer NavLink del panel.
  useEffect(() => {
    if (!mobileOpen) return undefined
    // Scroll-lock del body
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Mover foco al primer NavLink del panel tras animacion
    const focusTimer = window.setTimeout(() => {
      const first = mobilePanelRef.current?.querySelector(
        'a, button, [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    }, 50)
    // Handler combinado Escape + Tab trap
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMobileOpen(false)
        mobileToggleRef.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !mobilePanelRef.current) return
      const focusables = mobilePanelRef.current.querySelectorAll(
        'a, button, [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)
  const openQuickSearch = () => {
    play('playClick')
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
  }
  const handleRuleta = async ({ close = false } = {}) => {
    play('playClick')
    const personaje = await girarRuleta()
    if (personaje && close) closeMobile()
  }

  return (
    <header
      className={`as-vt-header sticky top-0 z-30 flex items-center justify-between gap-3 px-5 py-3 transition-[background-color,border-color,box-shadow] duration-200 sm:gap-6 sm:px-8 sm:py-4 ${
        scrolled
          ? 'border-b border-white/10 bg-bg/95 shadow-elev-2 pointer-fine:bg-bg/78 pointer-fine:backdrop-blur-2xl'
          : 'border-b border-white/8 bg-bg/90 pointer-fine:bg-bg/52 pointer-fine:backdrop-blur-xl'
      }`}
    >
      <AppLink to="/" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 min-[1120px]:flex-none">
        <img
          src="/logo.svg"
          alt=""
          width={40}
          height={40}
          className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
        />
        <span className="truncate text-base font-extrabold tracking-tight sm:text-lg">
          <span className="text-fg-strong">Anime</span>
          <span className="text-gold">Showdown</span>
        </span>
      </AppLink>

      {/* Nav desktop (≥1120px). 5 enlaces principales + menú "Más" + CTA caben
          en una fila con holgura; por debajo pasa al panel del hamburger.
          1024px (lg) era demasiado justo con el logotipo + estos elementos. */}
      <nav className="hidden flex-nowrap items-center justify-center gap-1 min-[1120px]:flex">
        {primaryNavLinks.map(({ to, i18nKey }) => (
          <AppNavLink
            key={to}
            to={to}
            onClick={() => play('playClick')}
            className={regularLinkClass}
          >
            {t(`nav.${i18nKey}`)}
          </AppNavLink>
        ))}
        <MoreMenu moreLinks={moreNavLinks} t={t} play={play} />
        <button
          type="button"
          onClick={() => handleRuleta()}
          disabled={ruletaLoading}
          aria-label={t('header.ruletaAria')}
          className={`${navLinkBase} inline-flex items-center gap-1.5 border border-gold/35 bg-gold/10 font-black text-gold shadow-aura transition-transform hover:-translate-y-0.5 hover:bg-gold/15 disabled:translate-y-0`}
        >
          <Shuffle className="h-3.5 w-3.5" />
          {ruletaLoading ? t('header.ruletaLoading') : t('nav.ruleta')}
        </button>
        {/* CTA principal: votar siempre visible, no requiere login. */}
        <AppNavLink
          to="/votar"
          onPointerDown={ctaVotarDesktop.onPointerDown}
          onClick={ctaVotarDesktop.onClick}
          className={ctaVotarClass}
        >
          <Swords className="h-4 w-4" />
          {t('header.ctaVotar')}
        </AppNavLink>
        <button
          type="button"
          onClick={openQuickSearch}
          aria-label={t('header.searchAria')}
          title={t('header.searchAria')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden text-[11px] 2xl:inline">{t('header.searchShort')}</span>
          <kbd className="hidden rounded-md border border-border bg-bg px-1 font-mono text-[10px] leading-none text-fg-muted 2xl:inline-block">
            ⌘K
          </kbd>
        </button>
        <LanguageToggle />
        <button
          type="button"
          onClick={() => {
            toggleMute()
            if (muted) play('playClick')
          }}
          aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        {user ? (
          <>
            <SaldoChip />
            <NotifBell />
            <UserBadge user={user} onLogout={logout} t={t} />
          </>
        ) : (
          <AppNavLink
            to="/login"
            onClick={() => play('playClick')}
            className={loginGhostClass}
          >
            {t('nav.login')}
          </AppNavLink>
        )}
      </nav>

      {/* Cluster móvil/tablet: avatar/notif si logueado, CTA Votar si no, +
          hamburger. El Login en mobile pasa al panel del hamburger
          (nota de producto 2026-05-18: primero participar, después
          registrarse — login secundario hasta que haya valor acumulado). */}
      <div className="flex items-center gap-1.5 min-[1120px]:hidden">
        {user ? (
          <>
            <SaldoChip className="px-1.5 py-0.5 text-xs" />
            <NotifBell />
            <AppLink
              to="/perfil"
              aria-label={t('nav.perfil')}
              onClick={() => play('playClick')}
            >
              <RitoAvatarTarget>
                <Avatar user={user} size={32} />
              </RitoAvatarTarget>
            </AppLink>
            <button
              type="button"
              onClick={openQuickSearch}
              aria-label={t('header.searchAria')}
              title={t('header.searchAria')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          /* Nota de producto: "Votar ahora" en 2 líneas comía
             demasiado del header móvil. Cambio a "Votar" + icono Swords:
             una palabra cabe en una línea y deja respirar al hamburger. */
          <AppNavLink
            to="/votar"
            onPointerDown={ctaVotarMobile.onPointerDown}
            onClick={ctaVotarMobile.onClick}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-accent/50 bg-gradient-to-b from-accent-hover to-accent px-3 text-[13px] font-black text-white shadow-aura"
          >
            <Swords className="h-3.5 w-3.5" />
            {t('header.ctaVotarCompact')}
          </AppNavLink>
        )}
        {!user && (
          <button
            type="button"
            onClick={openQuickSearch}
            aria-label={t('header.searchAria')}
            title={t('header.searchAria')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          ref={mobileToggleRef}
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-strong transition-colors hover:bg-surface-alt"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Panel móvil — absoluto bajo el header, click outside cierra. */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={closeMobile}
            className="fixed inset-0 top-0 z-20 bg-black/40 lg:hidden"
          />
          <div
            ref={mobilePanelRef}
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] overflow-y-auto border-b border-white/10 bg-bg/98 px-5 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-4 shadow-elev-2 pointer-fine:bg-bg/95 pointer-fine:backdrop-blur-2xl lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {[...primaryNavLinks, ...moreNavLinks].map(({ to, i18nKey }) => (
                <AppNavLink
                  key={to}
                  to={to}
                  onClick={() => { play('playClick'); closeMobile() }}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                      isActive
                        ? 'bg-surface-alt text-fg-strong'
                        : 'text-fg hover:bg-surface-alt'
                    }`
                  }
                >
                  {t(`nav.${i18nKey}`)}
                </AppNavLink>
              ))}
              <AppNavLink
                to="/votar"
                onClick={() => { play('playClick'); closeMobile() }}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                    isActive
                      ? 'bg-surface-alt text-fg-strong'
                      : 'text-fg hover:bg-surface-alt'
                  }`
                }
              >
                {t('nav.votar')}
              </AppNavLink>
              <button
                type="button"
                onClick={() => handleRuleta({ close: true })}
                disabled={ruletaLoading}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-black text-gold hover:bg-surface-alt disabled:opacity-55"
              >
                <Shuffle className="h-4 w-4" />
                {ruletaLoading ? t('header.ruletaLoading') : t('nav.ruleta')}
              </button>
              {!user && (
                <AppNavLink
                  to="/login"
                  onClick={() => { play('playClick'); closeMobile() }}
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-fg-muted hover:border-accent hover:text-gold"
                >
                  {t('nav.login')}
                </AppNavLink>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <LanguageToggle />
              <button
                type="button"
                onClick={() => { toggleMute(); if (muted) play('playClick') }}
                aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-alt hover:text-fg-strong"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => { logout(); closeMobile() }}
                  className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-[12px] font-semibold text-fg-strong"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('nav.salir')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  )
}

// Menú "Más" del nav desktop: disclosure accesible (botón + región de
// enlaces). Escape y click fuera cierran; el botón se resalta si la ruta
// activa está dentro del grupo.
function MoreMenu({ moreLinks, t, play }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const isActive = moreLinks.some(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`),
  )

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen((v) => !v); play('playClick') }}
        aria-haspopup="true"
        aria-expanded={open}
        className={`${navLinkBase} inline-flex items-center gap-1 font-medium ${
          isActive || open
            ? 'bg-white/5 text-fg-strong'
            : 'text-fg hover:bg-white/5 hover:text-fg-strong'
        }`}
      >
        {t('nav.mas', 'Más')}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-40 mt-2 min-w-44 overflow-hidden rounded-xl border border-white/10 bg-bg/98 p-1.5 shadow-elev-2 pointer-fine:bg-bg/95 pointer-fine:backdrop-blur-xl"
        >
          {moreLinks.map(({ to, i18nKey }) => (
            <AppNavLink
              key={to}
              to={to}
              onClick={() => { play('playClick'); setOpen(false) }}
              className={({ isActive: linkActive }) =>
                `flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${
                  linkActive
                    ? 'bg-surface-alt text-fg-strong'
                    : 'text-fg hover:bg-surface-alt hover:text-fg-strong'
                }`
              }
            >
              {t(`nav.${i18nKey}`)}
            </AppNavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function UserBadge({ user, onLogout, t }) {
  const isAdmin = user.rol === 'ADMIN'
  return (
    <div className="ml-2 flex items-center gap-2 rounded-lg bg-surface-alt px-2 py-1.5">
      <AppLink
        to="/perfil"
        aria-label={t('nav.perfil')}
        className="flex items-center gap-2.5"
      >
        <RitoAvatarTarget>
          <Avatar user={user} size={28} />
        </RitoAvatarTarget>
        <span className="text-sm font-medium text-fg-strong hover:text-gold">
          {user.username}
        </span>
      </AppLink>
      {isAdmin && (
        <AppLink
          to="/admin"
          aria-label={t('nav.admin')}
          className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-gold transition-colors hover:bg-accent/25"
        >
          <Shield className="h-3 w-3" />
          {t('nav.admin')}
        </AppLink>
      )}
      <button
        type="button"
        onClick={onLogout}
        aria-label={t('nav.salir')}
        className="ml-1 inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
      >
        <LogOut className="h-3.5 w-3.5" />
        {t('nav.salir')}
      </button>
    </div>
  )
}

export default Header
