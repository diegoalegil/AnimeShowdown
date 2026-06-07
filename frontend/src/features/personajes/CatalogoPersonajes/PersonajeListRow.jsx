import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeImg from '../../../components/PersonajeImg'
import { getStatsPersonaje } from '../../../lib/personajes-core'

function PersonajeListRow({
  slug,
  nombre,
  anime,
  rank,
  elo: eloProp,
  imagen,
  imagenUrl,
  imagenColorDominante,
}) {
  // Solo ELO base (estimado por popularidad). Las W/L y el win rate de
  // getStatsPersonaje son sintéticos y se ocultan, igual que en la card,
  // para mantener paridad y no exhibir métricas de combate falsas.
  const elo = eloProp ?? getStatsPersonaje(slug).elo
  const imageSrc = imagenUrl ?? imagen

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
          src={imageSrc}
          alt={nombre}
          colorDominante={imagenColorDominante}
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded-lg object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <div
          className="text-right"
          title="ELO base estimado por popularidad. El ranking competitivo real está en /ranking."
        >
          <p className="font-mono text-sm font-bold text-gold">
            {elo}
            <span className="ml-0.5 text-[10px] font-bold text-gold/80">·b</span>
          </p>
          <p className="text-[10px] text-fg-muted">
            ELO base
          </p>
        </div>
        <span className="hidden items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1 text-[11px] font-semibold text-fg-muted transition-colors group-hover:border-accent/40 group-hover:text-gold md:inline-flex">
          Ver ficha
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  )
}

export default PersonajeListRow
