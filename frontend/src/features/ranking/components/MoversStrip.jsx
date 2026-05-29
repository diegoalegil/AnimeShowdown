import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import PersonajeImg from '../../../components/PersonajeImg'
import { useRankingMovimientos } from '../../../hooks/useRanking'

function MoversStrip() {
  const { data: movs } = useRankingMovimientos({ dias: 7, limit: 30 })
  const top3 = useMemo(() => {
    if (!Array.isArray(movs)) return []
    return movs
      .filter((m) => m.delta != null && m.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
  }, [movs])

  if (top3.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-success/30 bg-success/5 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-success" />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-success">
          Movers de la semana
        </h2>
        <span className="ml-auto text-[11px] text-fg-muted">últimos 7 días</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {top3.map((m) => (
          <MoverChip key={m.slug} mover={m} />
        ))}
      </ul>
    </div>
  )
}

function MoverChip({ mover }) {
  const subio = mover.delta > 0
  const Icon = subio ? TrendingUp : TrendingDown
  const colorClase = subio
    ? 'border-success/40 bg-success/10 text-success'
    : 'border-danger/40 bg-danger/10 text-danger'
  const verbo = subio ? 'subió' : 'bajó'
  return (
    <li>
      <Link
        to={`/personajes/${mover.slug}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-accent/40"
      >
        <PersonajeImg
          slug={mover.slug}
          src={mover.imagenUrl}
          alt={mover.nombre}
          loading="lazy"
          sizes="48px"
          className="h-12 w-9 shrink-0 rounded object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[13px] font-bold text-fg-strong group-hover:text-gold">
            {mover.nombre}
          </p>
          <p className="line-clamp-1 text-[11px] text-fg-muted">{mover.anime}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] font-extrabold ${colorClase}`}
          title={`${verbo} ${Math.abs(mover.delta)} posiciones vs hace 7 días`}
        >
          <Icon className="h-3 w-3" />
          {Math.abs(mover.delta)}
        </span>
      </Link>
    </li>
  )
}

export default MoversStrip
