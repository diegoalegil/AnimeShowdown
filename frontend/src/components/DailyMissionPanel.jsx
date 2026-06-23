import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Flame,
  Gamepad2,
  Hourglass,
  Share2,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react'
import {
  DAILY_GAME_TARGET,
  DAILY_VOTE_TARGET,
  listenDailyProgress,
  readDailyProgress,
  readDailyStreak,
} from '../lib/dailyProgress'
import { getDailyResetCountdown } from '../lib/games'
import { shareWithToast } from '../lib/shareWithToast'
import { useAuth } from '../contexts/AuthContext'
import { useTodayKey } from '../hooks/useDailyGameState'
import { ANON_VOTE_LIMIT as ANON_VOTE_CAP } from '../lib/anonymousVoting'

// Tope de votos de invitado: única fuente de verdad es ANON_VOTE_LIMIT en
// lib/anonymousVoting. Un invitado NO puede llegar al objetivo diario de 10 votos sin
// registrarse: la barra se quedaría clavada al 50%. La copia para invitados
// refleja esto.

function clamp(value, max) {
  return Math.min(Math.max(0, value), max)
}

const COMPLETION_CELEBRATION_PREFIX = 'animeshowdown.daily-complete-celebrated.v1'

function readCelebrated(date) {
  try {
    return localStorage.getItem(`${COMPLETION_CELEBRATION_PREFIX}:${date}`) === '1'
  } catch {
    return true
  }
}

function markCelebrated(date) {
  try {
    localStorage.setItem(`${COMPLETION_CELEBRATION_PREFIX}:${date}`, '1')
  } catch {
    // Local celebration state is optional.
  }
}

function shouldReduceMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

async function celebrateDailyCompletion(date) {
  if (!date || readCelebrated(date)) return
  markCelebrated(date)
  if (shouldReduceMotion()) return
  try {
    const mod = await import('canvas-confetti')
    const confetti = mod.default || mod
    confetti({
      particleCount: 72,
      spread: 64,
      origin: { y: 0.72 },
      colors: ['#be2b38', '#c5a15a', '#34d399', '#f4f4f5'],
      disableForReducedMotion: true,
    })
  } catch {
    // Confetti is decorative; never block the mission panel.
  }
}

function MissionItem({ icon: Icon, label, detail, done, to }) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[4.5rem] items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5 ${
        done
          ? 'border-success/35 bg-success/10'
          : 'border-border bg-bg/45 hover:border-accent/45'
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
          done
            ? 'border-success/40 bg-success/15 text-success'
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
  const { user } = useAuth()
  const [progress, setProgress] = useState(() => readDailyProgress())
  const [streak, setStreak] = useState(() => readDailyStreak())
  const [resetCountdown, setResetCountdown] = useState(getDailyResetCountdown)
  const todayKey = useTodayKey()
  // Ajuste de estado al cambiar el día (patrón en-render de React, NO en effect):
  // al cruzar medianoche (timer de useTodayKey) o volver a la pestaña, re-leer
  // el progreso/racha; si no, el panel montado e inactivo mostraría el de ayer.
  const [diaMostrado, setDiaMostrado] = useState(todayKey)
  if (diaMostrado !== todayKey) {
    setDiaMostrado(todayKey)
    setProgress(readDailyProgress())
    setStreak(readDailyStreak())
  }

  useEffect(
    () =>
      listenDailyProgress(({ progress: nextProgress, streak: nextStreak }) => {
        setProgress(nextProgress)
        setStreak(nextStreak)
      }),
    [],
  )

  useEffect(() => {
    // Pausa con la pestaña oculta (mismo patrón que useServerCountdown): no
    // re-renderizamos el contador de reset en background; al volver refrescamos.
    const tick = () => { if (!document.hidden) setResetCountdown(getDailyResetCountdown()) }
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

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

  useEffect(() => {
    if (!completed) return
    void celebrateDailyCompletion(progress.date)
  }, [completed, progress.date])

  const compartirMision = async () => {
    const text = [
      `Completé mi misión diaria en AnimeShowdown — ${progress.date}.`,
      `${DAILY_VOTE_TARGET}/${DAILY_VOTE_TARGET} duelos votados · ${games}/${DAILY_GAME_TARGET} daily trial · ranking revisado.`,
      `Racha actual: ${streak.current} día${streak.current === 1 ? '' : 's'}.`,
    ].join('\n')
    await shareWithToast(
      {
        title: 'Misión diaria completada',
        text,
        url: '/misiones',
      },
      {
        clipboardSuccess: 'Misión copiada',
        errorDescription: 'Copia el resultado manualmente.',
        errorTitle: 'No se pudo compartir la misión',
        nativeSuccess: 'Misión compartida',
      },
    )
  }

  return (
    <section
      aria-labelledby="daily-mission-title"
      className={`as-panel relative overflow-hidden rounded-2xl border-accent/25 p-5 sm:p-6 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-gold to-success"
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
            <Flame className="h-3.5 w-3.5" />
            Misión de hoy
          </p>
          <h2 id="daily-mission-title" className="mt-1 text-2xl font-black tracking-tight text-fg-strong">
            {completed ? 'Ritual completado. Mañana toca defender la racha.' : 'Vota, juega y deja tu marca en el ranking.'}
          </h2>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[11px] font-black text-gold">
            <Hourglass className="h-3.5 w-3.5" />
            Reset en {resetCountdown.label}
          </p>
          {!compact && (
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              {user
                ? `Completa el loop diario de AnimeShowdown: ${DAILY_VOTE_TARGET} duelos, un daily trial y una visita al ranking que acabas de empujar.`
                : `Empieza sin registrarte: ${ANON_VOTE_CAP} duelos de invitado, un daily trial y una visita al ranking. Entra para subir a ${DAILY_VOTE_TARGET} votos y guardar tu racha.`}
            </p>
          )}
        </div>
        <div className="grid min-w-[13rem] grid-cols-3 overflow-hidden rounded-xl border border-border bg-bg/45 text-center">
          <div className="px-3 py-3">
            <p className="font-mono text-xl font-black text-fg-strong">{votes}/{DAILY_VOTE_TARGET}</p>
            <p className="text-[10px] text-fg-muted">votos</p>
          </div>
          <div className="border-x border-border px-3 py-3">
            <p className="font-mono text-xl font-black text-fg-strong">{games}/{DAILY_GAME_TARGET}</p>
            <p className="text-[10px] text-fg-muted">daily</p>
          </div>
          <div className="px-3 py-3">
            <p className="font-mono text-xl font-black text-gold">{streak.current}</p>
            <p className="text-[10px] text-fg-muted">racha</p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent via-gold to-success transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MissionItem
          icon={Swords}
          label={`Vota ${DAILY_VOTE_TARGET} duelos`}
          detail={
            votes >= DAILY_VOTE_TARGET
              ? 'Listo por hoy'
              : !user && votes >= ANON_VOTE_CAP
                ? `Tope de invitado (${ANON_VOTE_CAP}) — entra para seguir`
                : `Te faltan ${DAILY_VOTE_TARGET - votes}`
          }
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
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-success">
              <Sparkles className="h-3.5 w-3.5" />
              Ritual sellado
            </p>
            <p className="mt-1 text-[12px] leading-5 text-fg-muted">
              Racha protegida por hoy. El siguiente reset llega en {resetCountdown.label}.
            </p>
          </div>
          <button
            type="button"
            onClick={compartirMision}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] font-semibold text-success transition-colors hover:bg-success/20"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartir ritual
          </button>
        </div>
      )}
    </section>
  )
}

export default DailyMissionPanel
