import { ArrowRight, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeImg from '../../../../components/PersonajeImg'
import { formatRelativeSafe } from '../../../../lib/dateUtils'
import CardEyebrow from './CardEyebrow'
import PulseCard from './PulseCard'

function UltimosVotosCard({ votos }) {
  const items = (votos || []).slice(0, 4)

  if (items.length === 0) {
    return (
      <PulseCard tono="violet">
        <CardEyebrow icon={Radio} label="Últimos votos" tono="text-violet-300" />
        <p className="text-[13px] text-fg-muted">
          Esperando votos. Sé tú el primero del día.
        </p>
        <Link
          to="/votar"
          className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-violet-300 hover:text-violet-200"
        >
          Vota ahora
          <ArrowRight className="h-3 w-3" />
        </Link>
      </PulseCard>
    )
  }

  return (
    <PulseCard tono="violet">
      <CardEyebrow icon={Radio} label="Últimos votos" tono="text-violet-300" />
      <ul className="flex flex-col divide-y divide-border">
        {items.map((v, i) => (
          <VotoRow key={`${v.fecha}-${i}`} voto={v} />
        ))}
      </ul>
      <Link
        to="/ranking"
        className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-violet-300 hover:text-violet-200"
      >
        Ver ranking en vivo
        <ArrowRight className="h-3 w-3" />
      </Link>
    </PulseCard>
  )
}

function VotoRow({ voto }) {
  const { ganador, rival, username, fecha } = voto
  if (!ganador) return null

  return (
    <li className="flex items-center gap-2 py-2 text-[12px]">
      <Link to={`/personajes/${ganador.slug}`} className="shrink-0">
        <PersonajeImg
          slug={ganador.slug}
          src={ganador.imagenUrl}
          alt={ganador.nombre}
          loading="lazy"
          sizes="28px"
          className="h-7 w-7 rounded object-cover object-top"
        />
      </Link>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="line-clamp-1">
          <span className="font-semibold text-fg-strong">
            {username ?? 'alguien'}
          </span>{' '}
          <span className="text-fg-muted">votó por</span>{' '}
          <Link
            to={`/personajes/${ganador.slug}`}
            className="font-semibold text-fg-strong hover:text-gold"
          >
            {ganador.nombre}
          </Link>
          {rival && (
            <>
              {' '}
              <span className="text-fg-muted">vs</span>{' '}
              <Link
                to={`/personajes/${rival.slug}`}
                className="text-fg-muted hover:text-gold"
              >
                {rival.nombre}
              </Link>
            </>
          )}
        </p>
        {fecha && (
          <p className="text-[10px] text-fg-muted">{formatRelativo(fecha)}</p>
        )}
      </div>
    </li>
  )
}

/**
 * Formato relativo simple: "hace 3 min", "hace 2 h", "hace 5 d", o la
 * fecha corta si es más antiguo. El helper central evita que una fecha
 * inválida llegue al UI como "Invalid Date".
 */
function formatRelativo(isoString) {
  return formatRelativeSafe(isoString)
}

export default UltimosVotosCard
