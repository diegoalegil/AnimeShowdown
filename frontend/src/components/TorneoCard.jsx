import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, PlayCircle, Trophy, Users } from 'lucide-react'
import {
  imagenPersonaje,
  getPersonajeBySlug,
} from '../data/personajes'
import { estadoBadge } from '../data/torneos'
import { useSound } from '../contexts/SoundContext'

const estadoIcon = {
  'en-curso': PlayCircle,
  finalizado: CheckCircle2,
  proximo: Clock,
}

function TorneoCard({ torneo }) {
  const { slug, nombre, estado, participantes, winner } = torneo
  const badge = estadoBadge[estado]
  const Icon = estadoIcon[estado]
  const winnerPersonaje = winner ? getPersonajeBySlug(winner) : null
  const { play } = useSound()

  return (
    <Link
      to={`/torneos/${slug}`}
      onClick={() => play('playWhoosh')}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-1 hover:border-accent/40"
    >
      <div className="mb-4 flex items-center">
        <div className="flex -space-x-3">
          {participantes.slice(0, 5).map((s) => (
            <img
              key={s}
              src={imagenPersonaje(s)}
              alt=""
              loading="lazy"
              className="h-10 w-10 rounded-full border-2 border-surface object-cover object-top"
            />
          ))}
        </div>
        {participantes.length > 5 && (
          <span className="ml-3 text-[12px] font-medium text-fg-muted">
            +{participantes.length - 5}
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
          {participantes.length}
        </span>
      </div>
      {winnerPersonaje && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-accent-soft p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-white">
            <Trophy className="h-4 w-4" />
          </div>
          <img
            src={imagenPersonaje(winner)}
            alt=""
            className="h-9 w-9 rounded-md object-cover object-top"
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-fg-muted">
              Campeón
            </p>
            <p className="truncate text-sm font-bold text-fg-strong">
              {winnerPersonaje.nombre}
            </p>
          </div>
        </div>
      )}
    </Link>
  )
}

export default TorneoCard
