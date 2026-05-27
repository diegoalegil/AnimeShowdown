import { useMemo } from 'react'
import { Flame, Hourglass, Trophy } from 'lucide-react'

function StatTile({ icon: Icon, iconColor, label, value, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-alt">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {label}
        </p>
        <p className="truncate font-mono text-lg font-extrabold tabular-nums text-fg-strong">
          {value}
        </p>
      </div>
    </div>
  )
}

export function GamesHubStatsBar({ completadosHoy, totalDaily, eloBest, resetLabel }) {
  return (
    <div className="as-panel mb-6 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3 sm:p-5">
      <StatTile
        icon={Flame}
        iconColor="text-orange-400"
        label="Completados hoy"
        value={`${completadosHoy}/${totalDaily}`}
      />
      <StatTile
        icon={Trophy}
        iconColor="text-yellow-400"
        label="Mejor racha ELO Duel"
        value={eloBest != null ? `${eloBest}` : '—'}
      />
      <StatTile
        icon={Hourglass}
        iconColor="text-cyan-400"
        label="Próximo reset"
        value={resetLabel}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  )
}

export function DailyHistoryStrip({ days, streak }) {
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
    <section className="as-panel mb-6 rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">
            Calendario daily
          </p>
          <h2 className="mt-1 text-lg font-black text-fg-strong">
            Últimos 7 días de ritual
          </h2>
        </div>
        <p className="text-[12px] text-fg-muted">
          Racha actual <span className="font-mono font-black text-gold">{streak.current}</span>
          {' '}· récord <span className="font-mono font-black text-fg-strong">{streak.longest}</span>
        </p>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const parsed = new Date(`${day.date}T12:00:00`)
          const completed = day.completed
          const started = day.votes > 0 || day.gamesCompleted > 0 || day.rankingViewed
          return (
            <div
              key={day.date}
              className={`min-h-[5.75rem] rounded-xl border px-2 py-2 text-center ${
                completed
                  ? 'border-emerald-400/35 bg-emerald-500/10'
                  : started
                    ? 'border-gold/35 bg-gold-soft'
                    : 'border-border bg-bg/45'
              }`}
              title={`${dateFormatter.format(parsed)} · ${
                completed
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
                  completed
                    ? 'text-emerald-200'
                    : started
                      ? 'text-gold'
                      : 'text-fg-muted'
                }`}
              >
                {completed ? '✓' : started ? '•' : '—'}
              </p>
              <p className="mt-2 text-[10px] leading-4 text-fg-muted">
                {Math.min(day.votes, 10)}/10 votos
                <br />
                {Math.min(day.gamesCompleted, 1)}/1 daily
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
