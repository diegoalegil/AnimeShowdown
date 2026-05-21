import { NavLink, useLocation } from 'react-router-dom'
import { Home, Swords, Trophy, UsersRound } from 'lucide-react'

const items = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/personajes', label: 'Personajes', icon: UsersRound },
  { to: '/votar', label: 'Votar', icon: Swords },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
]

function MobileBottomNav() {
  const location = useLocation()
  if (location.pathname.startsWith('/tv')) return null

  return (
    <nav
      aria-label="Navegación móvil principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/92 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_60px_-36px_rgb(0_0_0_/_0.95)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-colors ${
                  isActive
                    ? 'bg-gold/15 text-gold'
                    : 'text-fg-muted hover:bg-white/5 hover:text-fg-strong'
                }`
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default MobileBottomNav
