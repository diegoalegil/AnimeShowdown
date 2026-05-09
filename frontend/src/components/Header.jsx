import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LogOut, Palette, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useTheme } from '../contexts/ThemeContext'

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/personajes', label: 'Personajes' },
  { to: '/animes', label: 'Animes' },
  { to: '/torneos', label: 'Torneos' },
  { to: '/votar', label: 'Votar' },
  { to: '/ranking', label: 'Ranking' },
]

const navLinkBase = 'rounded-md px-3.5 py-2 text-sm transition-colors'

function regularLinkClass({ isActive }) {
  return `${navLinkBase} font-medium ${
    isActive
      ? 'bg-surface-alt text-fg-strong'
      : 'text-fg hover:bg-surface-alt hover:text-fg-strong'
  }`
}

function ctaLinkClass({ isActive }) {
  return `${navLinkBase} ml-2 font-semibold text-white ${
    isActive ? 'bg-accent-hover' : 'bg-accent hover:bg-accent-hover'
  }`
}

function Header() {
  const { user, logout } = useAuth()
  const { muted, toggleMute, play } = useSound()
  const { cycleTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  const handleCycleTheme = () => {
    const nuevoNombre = cycleTheme()
    play('playLevelUp')
    toast(`Paleta: ${nuevoNombre}`, { duration: 1500 })
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
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            onClick={() => play('playClick')}
            className={regularLinkClass}
          >
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={handleCycleTheme}
          aria-label="Cambiar paleta de color"
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
          aria-label={muted ? 'Activar sonidos' : 'Silenciar sonidos'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        {user ? (
          <UserBadge user={user} onLogout={logout} />
        ) : (
          <NavLink
            to="/login"
            onClick={() => play('playClick')}
            className={ctaLinkClass}
          >
            Login
          </NavLink>
        )}
      </nav>
    </header>
  )
}

function UserBadge({ user, onLogout }) {
  return (
    <div className="ml-2 flex items-center gap-2.5 rounded-md bg-surface-alt px-2.5 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
        {user.nombre.charAt(0).toUpperCase()}
      </span>
      <span className="text-sm font-medium text-fg-strong">{user.nombre}</span>
      <button
        type="button"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        className="ml-1 inline-flex items-center text-fg-muted transition-colors hover:text-accent"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export default Header
