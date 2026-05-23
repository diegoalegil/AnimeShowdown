import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { CheckCircle2, Gamepad2, Home, Swords, Trophy, UsersRound } from 'lucide-react'
import {
  DAILY_GAME_TARGET,
  DAILY_VOTE_TARGET,
  listenDailyProgress,
  readDailyProgress,
} from '../lib/dailyProgress'

const items = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/personajes', label: 'Personajes', icon: UsersRound },
  { to: '/votar', label: 'Votar', icon: Swords },
  { to: '/games', label: 'Juegos', icon: Gamepad2 },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
]

function clamp(value, max) {
  return Math.min(Math.max(0, value), max)
}

function getMissionPrompt(progress) {
  const votes = clamp(progress.votes, DAILY_VOTE_TARGET)
  const games = clamp(progress.gamesCompleted, DAILY_GAME_TARGET)
  const rankingViewed = Boolean(progress.rankingViewed)
  const percent = Math.round(
    ((votes / DAILY_VOTE_TARGET + games / DAILY_GAME_TARGET + (rankingViewed ? 1 : 0)) / 3) * 100,
  )

  if (progress.completed) {
    return {
      to: '/misiones',
      icon: CheckCircle2,
      title: 'Ritual completo',
      detail: 'Racha protegida. Mañana hay otra ronda.',
      percent: 100,
      completed: true,
    }
  }

  if (votes < DAILY_VOTE_TARGET) {
    return {
      to: '/votar',
      icon: Swords,
      title: 'Misión de hoy',
      detail: `Faltan ${DAILY_VOTE_TARGET - votes} votos para cerrar la arena.`,
      percent,
      completed: false,
    }
  }

  if (games < DAILY_GAME_TARGET) {
    return {
      to: '/games',
      icon: Gamepad2,
      title: 'Misión de hoy',
      detail: 'Completa 1 daily trial para mantener el ritmo.',
      percent,
      completed: false,
    }
  }

  return {
    to: '/ranking',
    icon: Trophy,
    title: 'Misión de hoy',
    detail: 'Mira cómo se movió el ranking después de votar.',
    percent,
    completed: false,
  }
}

function MobileBottomNav() {
  const location = useLocation()
  const [progress, setProgress] = useState(() => readDailyProgress())
  const mission = useMemo(() => getMissionPrompt(progress), [progress])

  useEffect(
    () =>
      listenDailyProgress(({ progress: nextProgress }) => {
        setProgress(nextProgress)
      }),
    [],
  )

  if (location.pathname.startsWith('/tv')) return null

  const MissionIcon = mission.icon

  return (
    <nav
      aria-label="Navegación móvil principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/92 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_60px_-36px_rgb(0_0_0_/_0.95)] backdrop-blur-xl md:hidden"
    >
      <Link
        to={mission.to}
        className={`mx-auto mb-2 flex max-w-lg items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
          mission.completed
            ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
            : 'border-gold/25 bg-gold/10 text-fg-strong hover:border-gold/45 hover:bg-gold/15'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              mission.completed
                ? 'border-emerald-400/35 bg-emerald-500/15'
                : 'border-gold/30 bg-bg/45 text-gold'
            }`}
          >
            <MissionIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-black uppercase tracking-[0.13em]">
              {mission.title}
            </span>
            <span className="block truncate text-[10px] font-semibold text-fg-muted">
              {mission.detail}
            </span>
          </span>
        </span>
        <span className="shrink-0 font-mono text-sm font-black text-gold">
          {mission.percent}%
        </span>
      </Link>
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 text-[10px] font-bold leading-tight transition-colors sm:text-xs ${
                  isActive
                    ? 'bg-gold/15 text-gold'
                    : 'text-fg-muted hover:bg-white/5 hover:text-fg-strong'
                  }`
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {!mission.completed && mission.to === to && (
                  <span
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold shadow-[0_0_10px_rgb(197_161_90_/_0.9)]"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default MobileBottomNav
