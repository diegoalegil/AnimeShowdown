import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeImg from '../../../../components/PersonajeImg'
import { useVotosPeriodoBatch } from '../../../../hooks/useVotosPeriodo'
import CardEyebrow from './CardEyebrow'
import PulseCard from './PulseCard'

function MoversCard({ movers }) {
  // Actividad reciente: 1 request batch para los
  // 3 movers visibles — añade "+N votos" debajo del delta de posición.
  // Misma queryKey que otros consumidores del mismo set → cache hit.
  const slugs = movers.map((m) => m.slug)
  const { bySlug: votosBySlug } = useVotosPeriodoBatch(slugs, { dias: 7 })

  if (movers.length === 0) return null

  return (
    <PulseCard tono="emerald">
      <CardEyebrow icon={TrendingUp} label="Movers · 7 días" tono="text-emerald-300" />
      <ul className="flex flex-col divide-y divide-border">
        {movers.map((m) => (
          <MoverRow
            key={m.slug}
            mover={m}
            actividad={votosBySlug.get(m.slug)}
          />
        ))}
      </ul>
      <Link
        to="/ranking"
        className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-300 hover:text-emerald-200"
      >
        Ver ranking completo
        <ArrowRight className="h-3 w-3" />
      </Link>
    </PulseCard>
  )
}

function MoverRow({ mover, actividad }) {
  const subio = mover.delta > 0
  const Icon = subio ? TrendingUp : TrendingDown
  const colorClase = subio ? 'text-emerald-300' : 'text-rose-300'
  const votosPeriodo = actividad?.votosPeriodoActual ?? 0

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]">
      <Link to={`/personajes/${mover.slug}`} className="shrink-0 transition-transform hover:scale-105">
        <PersonajeImg
          slug={mover.slug}
          src={mover.imagenUrl}
          alt={mover.nombre}
          loading="lazy"
          sizes="40px"
          className="h-10 w-8 rounded object-cover object-top"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/personajes/${mover.slug}`}
          className="line-clamp-1 text-[13px] font-semibold text-fg-strong hover:text-gold"
        >
          {mover.nombre}
        </Link>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {mover.anime}
          {votosPeriodo > 0 && (
            <span className="ml-1 font-mono tabular-nums text-emerald-300/80">
              · +{votosPeriodo} votos
            </span>
          )}
        </p>
      </div>
      <div
        className={`flex items-center gap-1 text-[13px] font-bold ${colorClase}`}
        title={`${subio ? 'Subió' : 'Bajó'} ${Math.abs(mover.delta)} posiciones · ${votosPeriodo} votos esta semana`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="tabular-nums">{Math.abs(mover.delta)}</span>
      </div>
    </li>
  )
}

export default MoversCard
