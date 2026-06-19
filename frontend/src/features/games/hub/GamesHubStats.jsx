import { Flame, Hourglass, Trophy } from 'lucide-react'

function StatTile({ icon: Icon, iconColor, label, value, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-alt">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-fg-muted">
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
        iconColor="text-medal-bronze"
        label="Completados hoy"
        value={`${completadosHoy}/${totalDaily}`}
      />
      <StatTile
        icon={Trophy}
        iconColor="text-medal-gold"
        label="Mejor racha ELO Duel"
        value={eloBest != null ? `${eloBest}` : '—'}
      />
      <StatTile
        icon={Hourglass}
        iconColor="text-electric"
        label="Próximo reset"
        value={resetLabel}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  )
}
