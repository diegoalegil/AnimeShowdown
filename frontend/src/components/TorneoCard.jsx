import { Link } from 'react-router-dom'
import {
  imagenPersonaje,
  getPersonajeBySlug,
} from '../data/personajes'
import { estadoBadge } from '../data/torneos'

function TorneoCard({ torneo }) {
  const { slug, nombre, estado, participantes, winner } = torneo
  const badge = estadoBadge[estado]
  const winnerPersonaje = winner ? getPersonajeBySlug(winner) : null

  return (
    <Link
      to={`/torneos/${slug}`}
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
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
          <span className="uppercase tracking-wider">{badge.label}</span>
        </span>
        <span>·</span>
        <span>{participantes.length} personajes</span>
      </div>
      {winnerPersonaje && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-accent-soft p-2.5">
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
