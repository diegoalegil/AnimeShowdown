import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeImg from '../../../components/PersonajeImg'
import { getStatsPersonaje } from '../../../lib/personajes-core'

function PersonajeListRow({ slug, nombre, anime, rank }) {
  const { elo, wins, losses } = getStatsPersonaje(slug)
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null

  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 sm:px-5"
      >
        {rank && rank <= 100 && (
          <span className="hidden w-10 shrink-0 font-mono text-[13px] font-extrabold text-fg-muted sm:block">
            #{rank}
          </span>
        )}
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <div className="hidden text-right text-[12px] sm:block">
          <p className="text-fg-muted">
            <span className="font-semibold text-emerald-300">{wins}V</span>
            {' · '}
            <span className="font-semibold text-rose-300">{losses}D</span>
          </p>
          {winRate != null && (
            <p className="font-mono text-[11px] font-semibold text-emerald-300/80">
              {winRate}% WR
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-gold">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
        <span className="hidden items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-[11px] font-semibold text-fg-muted transition-colors group-hover:border-accent/40 group-hover:text-gold md:inline-flex">
          Ver ficha
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  )
}

export default PersonajeListRow
