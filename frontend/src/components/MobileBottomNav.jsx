import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLink, AppNavLink } from './AppLink'
import { CheckCircle2, Gamepad2, Home, Swords, Trophy, UsersRound } from 'lucide-react'
import {
  DAILY_GAME_TARGET,
  DAILY_VOTE_TARGET,
  listenDailyProgress,
  readDailyProgress,
} from '../lib/dailyProgress'

const items = [
  { to: '/', i18nKey: 'inicio', icon: Home },
  { to: '/personajes', i18nKey: 'personajes', icon: UsersRound },
  { to: '/votar', i18nKey: 'votar', icon: Swords },
  { to: '/games', i18nKey: 'games', icon: Gamepad2 },
  { to: '/ranking', i18nKey: 'ranking', icon: Trophy },
]

function clamp(value, max) {
  return Math.min(Math.max(0, value), max)
}

function getMissionPrompt(progress, t) {
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
      title: t('mobileNav.mission.completedTitle'),
      detail: t('mobileNav.mission.completedDetail'),
      percent: 100,
      completed: true,
    }
  }

  if (votes < DAILY_VOTE_TARGET) {
    return {
      to: '/votar',
      icon: Swords,
      title: t('mobileNav.mission.todayTitle'),
      detail: t(
        DAILY_VOTE_TARGET - votes === 1
          ? 'mobileNav.mission.votesDetailSingular'
          : 'mobileNav.mission.votesDetail',
        { count: DAILY_VOTE_TARGET - votes },
      ),
      percent,
      completed: false,
    }
  }

  if (games < DAILY_GAME_TARGET) {
    return {
      to: '/games',
      icon: Gamepad2,
      title: t('mobileNav.mission.todayTitle'),
      detail: t('mobileNav.mission.gamesDetail'),
      percent,
      completed: false,
    }
  }

  return {
    to: '/ranking',
    icon: Trophy,
    title: t('mobileNav.mission.todayTitle'),
    detail: t('mobileNav.mission.rankingDetail'),
    percent,
    completed: false,
  }
}

function MobileBottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const [progress, setProgress] = useState(() => readDailyProgress())
  const mission = useMemo(() => getMissionPrompt(progress, t), [progress, t])

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
      aria-label={t('mobileNav.ariaLabel')}
      className="as-vt-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 shadow-elev-up pointer-fine:bg-bg/92 pointer-fine:backdrop-blur-xl md:hidden"
    >
      <AppLink
        to={mission.to}
        className={`mx-auto mb-2 flex max-w-lg items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
          mission.completed
            ? 'border-success/35 bg-success/10 text-success'
            : 'border-gold/25 bg-gold/10 text-fg-strong hover:border-gold/45 hover:bg-gold/15'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              mission.completed
                ? 'border-success/35 bg-success/15'
                : 'border-gold/30 bg-bg/45 text-gold'
            }`}
          >
            <MissionIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-black">
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
      </AppLink>
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map(({ to, i18nKey, icon: Icon }) => (
          <li key={to}>
            <AppNavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 text-[10px] leading-tight transition-colors sm:text-xs ${
                  isActive
                    ? 'bg-gold/15 font-black text-gold ring-2 ring-inset ring-gold/40'
                    : 'font-bold text-fg-muted hover:bg-white/5 hover:text-fg-strong'
                  }`
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {!mission.completed && mission.to === to && (
                  <span
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold shadow-aura-sm [--aura-color:rgb(197_161_90_/_0.9)]"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="max-w-full truncate">{t(`nav.${i18nKey}`)}</span>
            </AppNavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default MobileBottomNav
