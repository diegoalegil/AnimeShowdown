import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/personajes', label: 'Personajes' },
  { to: '/torneos', label: 'Torneos' },
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

  return (
    <header className="flex flex-col items-stretch gap-3.5 border-b border-border bg-surface px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-4">
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
            className={regularLinkClass}
          >
            {label}
          </NavLink>
        ))}
        {user ? (
          <UserBadge user={user} onLogout={logout} />
        ) : (
          <NavLink to="/login" className={ctaLinkClass}>
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
        className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
      >
        Salir
      </button>
    </div>
  )
}

export default Header
