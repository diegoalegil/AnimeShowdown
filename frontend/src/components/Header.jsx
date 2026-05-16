import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Palette, Shield, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useTheme } from '../contexts/ThemeContext'
import Avatar from './Avatar'
import LanguageToggle from './LanguageToggle'
import NotifBell from './NotifBell'

const navLinks = [
  { to: '/', i18nKey: 'inicio' },
  { to: '/personajes', i18nKey: 'personajes' },
  { to: '/animes', i18nKey: 'animes' },
  { to: '/torneos', i18nKey: 'torneos' },
  { to: '/votar', i18nKey: 'votar' },
  { to: '/higher-or-lower', i18nKey: 'higherOrLower' },
  { to: '/ranking', i18nKey: 'ranking' },
]

const navLinkBase = 'rounded-md px-3.5 py-2 text-sm transition-colors'

function regularLinkClass({ isActive }) {
  return `${navLinkBase} font-medium ${
    isActive
      ? 'bg-surface-alt text-fg-strong'
      : 'text-fg hover:bg-surface-alt hover:text-fg-strong'
  }`
}

// CTA principal del header (Login). Texto en --color-bg (#0d0d12) sobre
// magenta --color-accent: contraste 5.4:1 cumple WCAG AA (Plan v2 §3.9).
// Antes era text-white sobre el mismo bg → solo 3.6:1, fallaba AA.
function ctaLinkClass({ isActive }) {
  return `${navLinkBase} ml-2 font-semibold text-bg ${
    isActive ? 'bg-accent-hover' : 'bg-accent hover:bg-accent-hover'
  }`
}

function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { muted, toggleMute, play } = useSound()
  const { cycleTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  const handleCycleTheme = () => {
    const nuevoNombre = cycleTheme()
    play('playLevelUp')
    toast(t('header.paletaToast', { nombre: nuevoNombre }), { duration: 1500 })
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-30 flex flex-col items-stretch gap-3.5 px-5 py-3.5 transition-[background-color,backdrop-filter,border-color] duration-200 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-4 ${
        scrolled
          ? 'border-b border-border bg-surface/70 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent backdrop-blur-0'
      }`}
    >
      <Link
        to="/"
        className="flex items-center justify-center gap-3 sm:justify-start"
      >
        <img
          src="/logo.webp"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
        />
        <span className="text-lg font-extrabold tracking-tight text-fg-strong">
          AnimeShowdown
        </span>
      </Link>
      <nav className="flex flex-wrap items-center justify-center gap-1">
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
        <LanguageToggle />
        <button
          type="button"
          onClick={handleCycleTheme}
          aria-label={t('header.cambiarTema')}
          className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-alt hover:text-accent"
        >
          <Palette className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            toggleMute()
            if (muted) play('playClick')
          }}
          aria-label={muted ? t('header.activarSonidos') : t('header.silenciar')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
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
            className={ctaLinkClass}
          >
            {t('nav.login')}
          </NavLink>
        )}
      </nav>
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
        <span className="text-sm font-medium text-fg-strong hover:text-accent">
          {user.username}
        </span>
      </Link>
      {isAdmin && (
        <Link
          to="/admin"
          aria-label={t('nav.admin')}
          className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent/25"
        >
          <Shield className="h-3 w-3" />
          {t('nav.admin')}
        </Link>
      )}
      <button
        type="button"
        onClick={onLogout}
        aria-label={t('nav.salir')}
        className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
      >
        <LogOut className="h-3.5 w-3.5" />
        {t('nav.salir')}
      </button>
    </div>
  )
}

export default Header
