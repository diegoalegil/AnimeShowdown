import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Flame, Gamepad2, Share2, Swords, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import {
  DAILY_GAME_TARGET,
  DAILY_VOTE_TARGET,
  listenDailyProgress,
  readDailyProgress,
  readDailyStreak,
  recordDailyShare,
} from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'

function clamp(value, max) {
  return Math.min(Math.max(0, value), max)
}

function MissionItem({ icon: Icon, label, detail, done, to }) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[4.5rem] items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5 ${
        done
          ? 'border-emerald-400/35 bg-emerald-500/10'
          : 'border-border bg-bg/45 hover:border-accent/45'
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
          done
            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
            : 'border-accent/35 bg-accent-soft text-gold'
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-fg-strong">{label}</span>
        <span className="block text-[12px] leading-5 text-fg-muted">{detail}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
    </Link>
  )
}

function DailyMissionPanel({ compact = false, className = '' }) {
  const [progress, setProgress] = useState(() => readDailyProgress())
  const [streak, setStreak] = useState(() => readDailyStreak())

  useEffect(
    () =>
      listenDailyProgress(({ progress: nextProgress, streak: nextStreak }) => {
        setProgress(nextProgress)
        setStreak(nextStreak)
      }),
    [],
  )

  const votes = clamp(progress.votes, DAILY_VOTE_TARGET)
  const games = clamp(progress.gamesCompleted, DAILY_GAME_TARGET)
  const rankingViewed = Boolean(progress.rankingViewed)
  const completed = progress.completed
  const progressPct = useMemo(() => {
    const votePart = votes / DAILY_VOTE_TARGET
    const gamePart = games / DAILY_GAME_TARGET
    const rankingPart = rankingViewed ? 1 : 0
    return Math.round(((votePart + gamePart + rankingPart) / 3) * 100)
  }, [votes, games, rankingViewed])

  const compartirMision = async () => {
    const text = [
      `Completé mi misión diaria en AnimeShowdown — ${progress.date}.`,
      `${DAILY_VOTE_TARGET}/${DAILY_VOTE_TARGET} duelos votados · ${games}/${DAILY_GAME_TARGET} daily trial · ranking revisado.`,
      `Racha actual: ${streak.current} día${streak.current === 1 ? '' : 's'}.`,
    ].join('\n')
    try {
      const result = await shareOrCopy({
        title: 'Misión diaria completada',
        text,
        url: '/games',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Misión compartida' : 'Misión copiada')
    } catch (error) {
      toast.error('No se pudo compartir la misión', {
        description: error?.message || 'Copia el resultado manualmente.',
      })
    }
  }

  return (
    <section
      aria-labelledby="daily-mission-title"
      className={`as-panel relative overflow-hidden rounded-2xl border-accent/25 p-5 sm:p-6 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-gold to-emerald-300"
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            <Flame className="h-3.5 w-3.5" />
            Misión de hoy
          </p>
          <h2 id="daily-mission-title" className="mt-1 text-2xl font-black tracking-tight text-fg-strong">
            {completed ? 'Ritual completado. Mañana toca defender la racha.' : 'Vota, juega y deja tu marca en el ranking.'}
          </h2>
          {!compact && (
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              Completa el loop diario de AnimeShowdown sin registrarte: 10 duelos,
              un daily trial y una visita al ranking que acabas de empujar.
            </p>
          )}
        </div>
        <div className="grid min-w-[13rem] grid-cols-3 overflow-hidden rounded-xl border border-border bg-bg/45 text-center">
          <div className="px-3 py-3">
            <p className="font-mono text-xl font-black text-fg-strong">{votes}/{DAILY_VOTE_TARGET}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">votos</p>
          </div>
          <div className="border-x border-border px-3 py-3">
            <p className="font-mono text-xl font-black text-fg-strong">{games}/{DAILY_GAME_TARGET}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">daily</p>
          </div>
          <div className="px-3 py-3">
            <p className="font-mono text-xl font-black text-gold">{streak.current}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">racha</p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent via-gold to-emerald-300 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MissionItem
          icon={Swords}
          label="Vota 10 duelos"
          detail={votes >= DAILY_VOTE_TARGET ? 'Listo por hoy' : `Te faltan ${DAILY_VOTE_TARGET - votes}`}
          done={votes >= DAILY_VOTE_TARGET}
          to="/votar"
        />
        <MissionItem
          icon={Gamepad2}
          label="Completa 1 juego diario"
          detail={games >= DAILY_GAME_TARGET ? 'Daily trial completado' : 'Shadow Guess, AniGrid o Impostor'}
          done={games >= DAILY_GAME_TARGET}
          to="/games"
        />
        <MissionItem
          icon={Trophy}
          label="Mira el ranking vivo"
          detail={
            rankingViewed
              ? progress.shared
                ? 'Ranking revisado y compartido'
                : 'Ranking revisado'
              : 'Revisa qué cambió hoy'
          }
          done={rankingViewed}
          to="/ranking"
        />
      </div>

      {completed && (
        <button
          type="button"
          onClick={compartirMision}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20"
        >
          <Share2 className="h-3.5 w-3.5" />
          Misión completa: compartir ritual de hoy.
        </button>
      )}
    </section>
  )
}

export default DailyMissionPanel
