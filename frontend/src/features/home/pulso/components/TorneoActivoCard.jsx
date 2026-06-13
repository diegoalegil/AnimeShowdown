import { ArrowRight, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import EditorialCover from '../../../../components/EditorialCover'
import { getTournamentVisual } from '../../../../data/visual-assets'
import CardEyebrow from './CardEyebrow'
import PulseCard from './PulseCard'

function TorneoActivoCard({ torneo }) {
  if (!torneo) {
    return (
      <PulseCard tono="cyan">
        <CardEyebrow icon={Trophy} label="Torneo activo" tono="text-electric" />
        <p className="text-[13px] text-fg-muted">
          Sin torneos en marcha ahora mismo. La comunidad enciende brackets
          nuevos cada poco — o crea tú el siguiente.
        </p>
      </PulseCard>
    )
  }

  const enCurso = torneo.estado === 'IN_PROGRESS'
  const estadoLabel = enCurso ? 'En curso' : 'Próximamente'
  const visual = getTournamentVisual(torneo.slug, torneo.nombre)

  return (
    <Link
      to={`/torneos/${torneo.slug}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-electric/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-electric/60 sm:p-5"
    >
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />
      <CardEyebrow icon={Trophy} label="Torneo activo" tono="relative text-electric" />
      <div className="relative flex flex-col gap-1">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-tight text-fg-strong drop-shadow-scrim">
          {torneo.nombre}
        </h3>
        <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              enCurso ? 'bg-success' : 'bg-electric'
            }`}
          />
          {estadoLabel}
          {torneo.totalParticipantes ? (
            <>
              {' · '}
              {torneo.totalParticipantes} participantes
            </>
          ) : null}
        </p>
      </div>
      <span className="relative mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-electric transition-transform group-hover:translate-x-0.5">
        Ver bracket
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

export default TorneoActivoCard
