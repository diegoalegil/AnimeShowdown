import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  CalendarDays,
  Flame,
  Gamepad2,
  Share2,
  Swords,
  Trophy,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import DailyMissionPanel from '../components/DailyMissionPanel'
import PersonalRankingTeaser from '../components/PersonalRankingTeaser'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import {
  DAILY_GAME_TARGET,
  DAILY_VOTE_TARGET,
  listenDailyProgress,
  readDailyProgress,
  readDailyStreak,
  readRecentDailyProgress,
  recordDailyShare,
} from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'

function MisionesPage() {
  useSeo({
    title: 'Misiones diarias',
    description:
      'Completa la misión diaria de AnimeShowdown: vota 10 duelos, juega un daily trial, revisa el ranking y protege tu racha.',
    canonical: 'https://animeshowdown.dev/misiones',
  })

  const [, setTick] = useState(0)
  useEffect(
    () => listenDailyProgress(() => setTick((value) => value + 1)),
    [],
  )

  const progress = readDailyProgress()
  const streak = readDailyStreak()
  const days = readRecentDailyProgress(14)
  const completedDays = days.filter((day) => day.completed).length
  const startedDays = days.filter(
    (day) => day.votes > 0 || day.gamesCompleted > 0 || day.rankingViewed,
  ).length
  const votesLeft = Math.max(0, DAILY_VOTE_TARGET - progress.votes)
  const gameDone = progress.gamesCompleted >= DAILY_GAME_TARGET
  const rankingDone = progress.rankingViewed
  const nextStep = getNextStep(votesLeft, gameDone, rankingDone)

  const compartir = async () => {
    const text = [
      progress.completed
        ? `Completé mi misión diaria en AnimeShowdown — ${progress.date}.`
        : `Mi misión diaria de AnimeShowdown va al ${Math.round(getProgressPct(progress))}%.`,
      `${Math.min(progress.votes, DAILY_VOTE_TARGET)}/${DAILY_VOTE_TARGET} votos · ${Math.min(progress.gamesCompleted, DAILY_GAME_TARGET)}/${DAILY_GAME_TARGET} daily · ranking ${progress.rankingViewed ? 'revisado' : 'pendiente'}.`,
      `Racha actual: ${streak.current} día${streak.current === 1 ? '' : 's'}.`,
    ].join('\n')
    try {
      const result = await shareOrCopy({
        title: 'Mi misión diaria de AnimeShowdown',
        text,
        url: '/misiones',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Misión compartida' : 'Misión copiada')
    } catch (error) {
      toast.error('No se pudo compartir', {
        description: error?.message || 'Copia el resultado manualmente.',
      })
    }
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.games}
      className="py-10 sm:py-12"
      lateralKanji={{ left: '日', right: '課' }}
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Misiones', path: '/misiones' },
        ])}
      />
      <JsonLd id="misiones-page" schema={misionesSchema()} />

      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.games}
          icon={Flame}
          eyebrow="Misiones diarias"
          title="Tu ritual diario de AnimeShowdown"
          subtitle="Vota, juega un daily trial, mira cómo cambia el ranking y protege la racha. Todo empieza en local, sin obligar login antes de aportar valor."
          actions={
            <>
              <Link
                to={nextStep.to}
                className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
              >
                <nextStep.icon className="h-4 w-4" />
                {nextStep.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={compartir}
                className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <Share2 className="h-4 w-4" />
                Compartir progreso
              </button>
            </>
          }
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                Estado de hoy
              </p>
              <p className="mt-3 font-mono text-5xl font-black text-fg-strong">
                {Math.round(getProgressPct(progress))}%
              </p>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                {progress.completed
                  ? 'Completado. Mañana toca defender la racha.'
                  : `Siguiente paso: ${nextStep.short}.`}
              </p>
            </div>
          }
        />

        <DailyMissionPanel className="mb-6" />

        <PersonalRankingTeaser className="mb-6" compact />

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Flame} label="Racha actual" value={streak.current} detail={`récord ${streak.longest}`} />
          <SummaryTile icon={CalendarDays} label="14 días" value={`${completedDays}/14`} detail={`${startedDays} empezados`} />
          <SummaryTile icon={Share2} label="Share" value={progress.shared ? 'sí' : 'no'} detail="cuenta en el ritual social" />
        </section>

        <DailyCalendar days={days} />

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <ActionCard
            icon={Swords}
            title="Empuja el ranking"
            text="Vota duelos rápidos y completa la parte más importante del ritual."
            to="/votar"
          />
          <ActionCard
            icon={Gamepad2}
            title="Juega un daily"
            text="Shadow Guess, AniGrid o Impostor Trial sirven para cerrar la misión."
            to="/games"
          />
          <ActionCard
            icon={Trophy}
            title="Comprueba el cambio"
            text="El ranking es el cierre del loop: mira qué se movió después de participar."
            to="/ranking"
          />
        </section>
      </div>
    </VisualPageShell>
  )
}

function getProgressPct(progress) {
  const votePart = Math.min(progress.votes, DAILY_VOTE_TARGET) / DAILY_VOTE_TARGET
  const gamePart = Math.min(progress.gamesCompleted, DAILY_GAME_TARGET) / DAILY_GAME_TARGET
  const rankingPart = progress.rankingViewed ? 1 : 0
  return ((votePart + gamePart + rankingPart) / 3) * 100
}

function getNextStep(votesLeft, gameDone, rankingDone) {
  if (votesLeft > 0) {
    return {
      to: '/votar',
      label: 'Votar duelos',
      short: `faltan ${votesLeft} votos`,
      icon: Swords,
    }
  }
  if (!gameDone) {
    return {
      to: '/games',
      label: 'Jugar daily',
      short: 'queda 1 daily trial',
      icon: Gamepad2,
    }
  }
  if (!rankingDone) {
    return {
      to: '/ranking',
      label: 'Ver ranking',
      short: 'falta revisar el ranking',
      icon: Trophy,
    }
  }
  return {
    to: '/votar',
    label: 'Seguir votando',
    short: 'misión completada',
    icon: Flame,
  }
}

function misionesSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Misiones diarias de AnimeShowdown',
    url: 'https://animeshowdown.dev/misiones',
    description:
      'Página de progreso local para completar votos, juegos diarios y revisión de ranking en AnimeShowdown.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev',
    },
  }
}

function SummaryTile({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-xl border border-border bg-surface/85 p-4">
      <Icon className="h-4 w-4 text-gold" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-black text-fg-strong">{value}</p>
      <p className="mt-1 text-[12px] text-fg-muted">{detail}</p>
    </div>
  )
}

function DailyCalendar({ days }) {
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
      }),
    [],
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
      }),
    [],
  )

  return (
    <section className="rounded-2xl border border-border bg-surface/85 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">
          Calendario daily
        </p>
        <h2 className="mt-1 text-xl font-black text-fg-strong">
          Últimos 14 días
        </h2>
      </div>
      <div className="grid grid-cols-7 gap-2 md:grid-cols-[repeat(14,minmax(0,1fr))]">
        {days.map((day) => {
          const parsed = new Date(`${day.date}T12:00:00`)
          const started = day.votes > 0 || day.gamesCompleted > 0 || day.rankingViewed
          return (
            <div
              key={day.date}
              className={`min-h-[5.4rem] rounded-xl border px-2 py-2 text-center ${
                day.completed
                  ? 'border-emerald-400/35 bg-emerald-500/10'
                  : started
                    ? 'border-gold/35 bg-gold-soft'
                    : 'border-border bg-bg/45'
              }`}
              title={`${dateFormatter.format(parsed)} · ${
                day.completed
                  ? 'ritual completado'
                  : started
                    ? 'ritual empezado'
                    : 'sin progreso'
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.08em] text-fg-muted">
                {dayFormatter.format(parsed)}
              </p>
              <p
                className={`mt-2 font-mono text-xl font-black ${
                  day.completed
                    ? 'text-emerald-200'
                    : started
                      ? 'text-gold'
                      : 'text-fg-muted'
                }`}
              >
                {day.completed ? '✓' : started ? '•' : '—'}
              </p>
              <p className="mt-1 text-[9px] text-fg-muted">
                {dateFormatter.format(parsed)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ActionCard({ icon: Icon, title, text, to }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-surface/85 p-5 transition-colors hover:border-accent/45 hover:bg-surface-alt"
    >
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-5 w-5 text-gold" />
        <ArrowRight className="h-4 w-4 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
      </div>
      <h2 className="mt-4 text-lg font-black text-fg-strong">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{text}</p>
    </Link>
  )
}

export default MisionesPage
