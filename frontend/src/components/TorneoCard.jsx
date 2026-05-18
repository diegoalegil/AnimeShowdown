import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock, PlayCircle, Trophy, Users } from 'lucide-react'
import { getEstadoBadge } from '../lib/torneosQueries'
import { useSound } from '../contexts/SoundContext'

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
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-1 hover:border-accent/40"
    >
      <div className="mb-4 flex items-center">
        <div className="flex -space-x-3">
          {avatares.map((p) => (
            <img
              key={p.slug}
              src={p.imagenUrl}
              alt=""
              loading="lazy"
              className="h-10 w-10 rounded-full border-2 border-surface object-cover object-top"
            />
          ))}
        </div>
        {numParticipantes > avatares.length && (
          <span className="ml-3 text-[12px] font-medium text-fg-muted">
            +{numParticipantes - avatares.length}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-fg-strong group-hover:text-accent">
        {nombre}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
        <span className={`inline-flex items-center gap-1.5 ${badge.color}`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wider">{badge.label}</span>
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {numParticipantes}
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
      <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-accent opacity-70 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
        {ESTADO_CTA[estado] ?? 'Ver torneo'}
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

export default TorneoCard
