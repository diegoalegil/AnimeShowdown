import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { endpoints } from '../lib/api'

/**
 * Time machine del ELO (Plan v2 §11.1).
 *
 * <p>Pinta una línea SVG simple con la evolución de votos acumulados
 * del personaje en los últimos 30 días. Sin librerías de gráficos —
 * el SVG cabe en una función. Tooltip básico al hover sobre puntos.
 */
function EloHistoryChart({ slug }) {
  const { data, isLoading } = useQuery({
    queryKey: ['personaje', slug, 'elo-history', 30],
    queryFn: () => endpoints.personajeEloHistory(slug, { dias: 30 }),
    enabled: Boolean(slug),
    staleTime: 30 * 60_000,
  })

  const stats = useMemo(() => computarStats(data), [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-surface p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }
  if (!data || data.length === 0 || stats == null) {
    return null
  }
  if (stats.rango === 0) {
    // Personaje sin actividad — pintar una nota es ruido. No renderizamos.
    return null
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold text-fg-strong">
            ELO últimos 30 días
          </h2>
        </div>
        <p className="font-mono text-[12px] text-fg-muted tabular-nums">
          <span className={stats.delta > 0 ? 'text-emerald-300' : stats.delta < 0 ? 'text-rose-300' : 'text-fg-muted'}>
            {stats.delta > 0 ? '+' : ''}
            {stats.delta}
          </span>{' '}
          votos · ahora{' '}
          <strong className="text-fg-strong">{stats.actual}</strong>
        </p>
      </div>
      <Sparkline points={data} stats={stats} />
      <div className="mt-2 flex justify-between text-[10px] text-fg-muted">
        <span>{formatearFecha(data[0].fecha)}</span>
        <span>{formatearFecha(data[data.length - 1].fecha)}</span>
      </div>
    </div>
  )
}

function Sparkline({ points, stats }) {
  const W = 600
  const H = 90
  const padX = 4
  const padY = 6

  const minV = stats.min
  const rango = stats.rango
  const pts = points.map((p, i) => {
    const x = padX + (i * (W - padX * 2)) / Math.max(1, points.length - 1)
    const y =
      H - padY - ((p.votosAcumulados - minV) / rango) * (H - padY * 2)
    return { x, y, votos: p.votosAcumulados, fecha: p.fecha }
  })
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  // Área bajo la línea con gradient suave.
  const area =
    `M ${pts[0].x.toFixed(1)} ${H - padY} ` +
    pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${H - padY} Z`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-24 w-full"
      role="img"
      aria-label={`Evolución de votos de los últimos 30 días, de ${stats.inicial} a ${stats.actual}`}
    >
      <defs>
        <linearGradient id="elo-history-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(255, 46, 99)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(255, 46, 99)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#elo-history-fill)" />
      <path
        d={path}
        stroke="rgb(255, 46, 99)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Puntos sutiles solo en el primero y el último. */}
      <circle cx={pts[0].x} cy={pts[0].y} r="3" fill="rgb(255, 46, 99)" opacity="0.5" />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="3.5"
        fill="rgb(255, 46, 99)"
      />
    </svg>
  )
}

function computarStats(data) {
  if (!data || data.length === 0) return null
  let min = data[0].votosAcumulados
  let max = data[0].votosAcumulados
  for (const p of data) {
    if (p.votosAcumulados < min) min = p.votosAcumulados
    if (p.votosAcumulados > max) max = p.votosAcumulados
  }
  const inicial = data[0].votosAcumulados
  const actual = data[data.length - 1].votosAcumulados
  const rango = max - min
  return {
    min,
    max,
    inicial,
    actual,
    delta: actual - inicial,
    rango: rango > 0 ? rango : 1,
  }
}

function formatearFecha(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return iso
  }
}

export default EloHistoryChart
