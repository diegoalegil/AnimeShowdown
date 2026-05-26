import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Menu, Shield, Swords, Volume2, VolumeX, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import Avatar from './Avatar'
import LanguageToggle from './LanguageToggle'
import NotifBell from './NotifBell'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'

// Nota de producto: /votar sale de navLinks regular y pasa a
// CTA principal del header. El login deja de ser el botón accent (estaba
// pidiendo a un usuario nuevo registrarse antes de aportar valor) y
// queda como link ghost discreto: ahora la primera acción visible es
// participar (votar) y el login es secundario para usuarios existentes.
const navLinks = [
  { to: '/', i18nKey: 'inicio' },
  { to: '/personajes', i18nKey: 'personajes' },
  { to: '/animes', i18nKey: 'animes' },
  { to: '/torneos', i18nKey: 'torneos' },
  { to: '/eventos', i18nKey: 'eventos' },
  { to: '/games', i18nKey: 'games' },
  { to: '/duel-live', i18nKey: 'pvp' },
  { to: '/ranking', i18nKey: 'ranking' },
]

const navLinkBase = 'relative rounded-md px-3.5 py-2 text-sm transition-colors'
const STORAGE_VOTES_COUNT = 'animeshowdown.votos_count'
const VOTES_COUNT_EVENT = 'animeshowdown:votes-count'

function readLocalVoteCount() {
  try {
    const value = Number(localStorage.getItem(STORAGE_VOTES_COUNT) || '0')
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function regularLinkClass({ isActive }) {
  return `${navLinkBase} font-medium ${
    isActive
      ? 'bg-white/5 text-fg-strong shadow-[inset_0_-1px_0_var(--color-accent),0_12px_34px_-26px_var(--color-accent)]'
      : 'text-fg hover:bg-white/5 hover:text-fg-strong'
  }`
}

// CTA principal de torneo: carmesí fijo + brillo dorado muy controlado.
function ctaVotarClass({ isActive }) {
  return `${navLinkBase} ml-2 inline-flex items-center gap-1.5 border border-accent/50 bg-gradient-to-b from-accent-hover to-accent font-black text-white shadow-[0_0_34px_-16px_var(--color-accent),inset_0_1px_0_rgb(255_255_255_/_0.18)] ${
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
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [voteCount, setVoteCount] = useState(readLocalVoteCount)
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

  useEffect(() => {
    const refreshVoteCount = () => setVoteCount(readLocalVoteCount())
    window.addEventListener('storage', refreshVoteCount)
    window.addEventListener(VOTES_COUNT_EVENT, refreshVoteCount)
    return () => {
      window.removeEventListener('storage', refreshVoteCount)
      window.removeEventListener(VOTES_COUNT_EVENT, refreshVoteCount)
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

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between gap-3 px-5 py-3 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-200 sm:gap-6 sm:px-8 sm:py-4 ${
        scrolled
          ? 'border-b border-white/10 bg-bg/78 shadow-[0_18px_70px_-48px_rgb(0_0_0_/_0.9)] backdrop-blur-2xl'
          : 'border-b border-white/8 bg-bg/52 backdrop-blur-xl'
      }`}
    >
      <Link to="/" className="flex min-h-11 items-center gap-2.5">
        <img
          src="/logo.webp"
          alt=""
          width={40}
          height={40}
          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
        />
        <span className="text-base font-extrabold tracking-tight text-fg-strong sm:text-lg">
          AnimeShowdown
        </span>
      </Link>

      {/* Nav desktop (xl+). En móvil/tablet vive en el panel del hamburger. */}
      <nav className="hidden flex-wrap items-center justify-center gap-1 xl:flex">
        {navLinks.map(({ to, i18nKey }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => play('playClick')}
            className={regularLinkClass}
          >
            {t(`nav.${i18nKey}`)}
          </NavLink>
        ))}
        {/* CTA principal: votar siempre visible, no requiere login. */}
        <NavLink
          to="/votar"
          onPointerDown={ctaVotarDesktop.onPointerDown}
          onClick={ctaVotarDesktop.onClick}
          className={ctaVotarClass}
        >
          <Swords className="h-4 w-4" />
          {t('header.ctaVotar')}
          {voteCount > 0 && (
            <span
              className="ml-0.5 rounded-full bg-white/18 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white"
              aria-label={`${voteCount} votos en esta sesión`}
            >
              {voteCount}
            </span>
          )}
        </NavLink>
        <LanguageToggle />
        <button
          type="button"
          onClick={() => {
            toggleMute()
            if (muted) play('playClick')
          }}
          aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        {user ? (
          <>
            <NotifBell />
            <UserBadge user={user} onLogout={logout} t={t} />
          </>
        ) : (
          <NavLink
            to="/login"
            onClick={() => play('playClick')}
            className={loginGhostClass}
          >
            {t('nav.login')}
          </NavLink>
        )}
      </nav>

      {/* Cluster móvil: avatar/notif si logueado, CTA Votar si no, +
          hamburger. El Login en mobile pasa al panel del hamburger
          (nota de producto 2026-05-18: primero participar, después
          registrarse — login secundario hasta que haya valor acumulado). */}
      <div className="flex items-center gap-1.5 xl:hidden">
        {user ? (
          <>
            <NotifBell />
            <Link
              to="/perfil"
              aria-label={t('nav.perfil')}
              onClick={() => play('playClick')}
            >
              <Avatar user={user} size={32} />
            </Link>
          </>
        ) : (
          /* Nota de producto: "Votar ahora" en 2 líneas comía
             demasiado del header móvil. Cambio a "Votar" + icono Swords:
             una palabra cabe en una línea y deja respirar al hamburger. */
          <NavLink
            to="/votar"
            onPointerDown={ctaVotarMobile.onPointerDown}
            onClick={ctaVotarMobile.onClick}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-accent/50 bg-gradient-to-b from-accent-hover to-accent px-3 text-[13px] font-black text-white shadow-[0_0_24px_-14px_var(--color-accent)]"
          >
            <Swords className="h-3.5 w-3.5" />
            {t('header.ctaVotarCompact')}
            {voteCount > 0 && (
              <span
                className="rounded-full bg-white/18 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white"
                aria-label={`${voteCount} votos en esta sesión`}
              >
                {voteCount}
              </span>
            )}
          </NavLink>
        )}
        <button
          ref={mobileToggleRef}
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-strong transition-colors hover:bg-surface-alt"
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
            className="fixed inset-0 top-0 z-20 bg-black/40 xl:hidden"
          />
          <div
            ref={mobilePanelRef}
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] overflow-y-auto border-b border-white/10 bg-bg/95 px-5 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-4 shadow-[0_24px_80px_-44px_rgb(0_0_0_/_0.95)] backdrop-blur-2xl xl:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map(({ to, i18nKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => { play('playClick'); closeMobile() }}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
                      isActive
                        ? 'bg-surface-alt text-fg-strong'
                        : 'text-fg hover:bg-surface-alt'
                    }`
                  }
                >
                  {t(`nav.${i18nKey}`)}
                </NavLink>
              ))}
              <NavLink
                to="/votar"
                onClick={() => { play('playClick'); closeMobile() }}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
                    isActive
                      ? 'bg-surface-alt text-fg-strong'
                      : 'text-fg hover:bg-surface-alt'
                  }`
                }
              >
                {t('nav.votar')}
              </NavLink>
              {!user && (
                <NavLink
                  to="/login"
                  onClick={() => { play('playClick'); closeMobile() }}
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-fg-muted hover:border-accent hover:text-gold"
                >
                  {t('nav.login')}
                </NavLink>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <LanguageToggle />
              <button
                type="button"
                onClick={() => { toggleMute(); if (muted) play('playClick') }}
                aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-alt hover:text-fg-strong"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => { logout(); closeMobile() }}
                  className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-md border border-border bg-surface px-3 text-[12px] font-semibold text-fg-strong"
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

function UserBadge({ user, onLogout, t }) {
  const isAdmin = user.rol === 'ADMIN'
  return (
    <div className="ml-2 flex items-center gap-2 rounded-md bg-surface-alt px-2 py-1.5">
      <Link
        to="/perfil"
        aria-label={t('nav.perfil')}
        className="flex items-center gap-2.5"
      >
        <Avatar user={user} size={28} />
        <span className="text-sm font-medium text-fg-strong hover:text-gold">
          {user.username}
        </span>
      </Link>
      {isAdmin && (
        <Link
          to="/admin"
          aria-label={t('nav.admin')}
          className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold transition-colors hover:bg-accent/25"
        >
          <Shield className="h-3 w-3" />
          {t('nav.admin')}
        </Link>
      )}
      <button
        type="button"
        onClick={onLogout}
        aria-label={t('nav.salir')}
        className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
      >
        <LogOut className="h-3.5 w-3.5" />
        {t('nav.salir')}
      </button>
    </div>
  )
}

export default Header
