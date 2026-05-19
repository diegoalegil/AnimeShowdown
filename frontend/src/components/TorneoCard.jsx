import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock, PlayCircle, Trophy, Users } from 'lucide-react'
import { getEstadoBadge } from '../lib/torneosQueries'
import { useSound } from '../contexts/SoundContext'
import { ocultaImgRota } from '../lib/imgFallback'
import { getTournamentVisual } from '../data/visual-assets'
import EditorialCover from './EditorialCover'

/**
 * Card individual de torneo en /torneos. Antes recibía el torneo legacy
 * desde data/torneos.js (con shape { participantes: slug[], winner: slug }).
 * Ahora recibe TorneoResumenDto del backend con avataresPrincipales y
 * ganadorSlug ya resueltos.
 */

const ESTADO_ICON = {
  SCHEDULED: Clock,
  IN_PROGRESS: PlayCircle,
  FINISHED: CheckCircle2,
}

// Audit producto (2026-05-18): cada estado tiene una acción dominante
// distinta. La card antes solo era una caja de info — ahora cierra con
// un CTA contextual al estado, así un usuario que escanea la lista de
// torneos entiende DE UN VISTAZO qué puede hacer en cada uno.
const ESTADO_CTA = {
  SCHEDULED: 'Ver participantes',
  IN_PROGRESS: 'Votar duelos abiertos',
  FINISHED: 'Ver resultados',
}

function TorneoCard({ torneo }) {
  const {
    slug,
    nombre,
    estado,
    numParticipantes,
    avataresPrincipales,
    ganadorSlug,
  } = torneo
  const badge = getEstadoBadge(estado)
  const Icon = ESTADO_ICON[estado] ?? Clock
  const { play } = useSound()
  const visual = getTournamentVisual(slug, nombre)

  const avatares = avataresPrincipales ?? []
  // Solo destacamos el campeón si tenemos el avatar resuelto entre los
  // primeros 5 (caso típico para bracket de 8). Para torneos donde el
  // ganador no esté entre los avataresPrincipales (no debería pasar, pero
  // defensivo) renderizamos solo el badge sin foto.
  const ganadorAvatar = ganadorSlug
    ? avatares.find((p) => p.slug === ganadorSlug)
    : null

  return (
    <Link
      to={`/torneos/${slug}`}
      onClick={() => play('playWhoosh')}
      className="as-panel group flex flex-col overflow-hidden rounded-xl border-border p-0 transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_0_50px_-22px_rgba(197,161,90,0.52)]"
    >
      <EditorialCover
        visual={visual}
        title={nombre}
        eyebrow="Bracket"
        meta={`${numParticipantes} participantes`}
        className="h-44 rounded-none border-0"
        compact
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-extrabold text-fg-strong group-hover:text-gold">
          {nombre}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
          <span className={`inline-flex items-center gap-1.5 ${badge.color}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wider">{badge.label}</span>
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {numParticipantes} participantes
          </span>
        </div>
        {ganadorAvatar && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-accent-soft p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-white">
              <Trophy className="h-4 w-4" />
            </div>
            <img
              src={ganadorAvatar.imagenUrl}
              alt=""
              onError={ocultaImgRota}
              className="h-9 w-9 rounded-md object-cover object-top"
            />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-fg-muted">
                Campeón
              </p>
              <p className="truncate text-sm font-bold text-fg-strong">
                {ganadorAvatar.nombre}
              </p>
            </div>
          </div>
        )}
        <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-accent opacity-80 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
          {ESTADO_CTA[estado] ?? 'Ver torneo'}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}

export default TorneoCard
