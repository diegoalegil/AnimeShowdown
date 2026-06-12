import { memo } from 'react'
import {
  Crown,
  Swords,
} from 'lucide-react'
import { AppLink } from '../../../components/AppLink'
import PersonajeCutImg from '../../../components/PersonajeCutImg'
import PersonajeImg from '../../../components/PersonajeImg'
import LiveNumber from './LiveNumber'

/**
 * Tinte de movimiento de la tabla viva: useFlipList anima la opacidad del
 * overlay que corresponda (up=success / down=danger) cuando la fila cambia
 * de posición en caliente. En reposo ambos quedan a opacity 0.
 */
function FlipFlashOverlays() {
  return (
    <>
      <span
        aria-hidden="true"
        data-flip-flash="up"
        className="pointer-events-none absolute inset-0 rounded-lg bg-success/15 opacity-0"
      />
      <span
        aria-hidden="true"
        data-flip-flash="down"
        className="pointer-events-none absolute inset-0 rounded-lg bg-danger/15 opacity-0"
      />
    </>
  )
}

/* RankRowElo se retiró: la pestaña ELO la pinta FederationTable (el
   Registro de la Federación). Estas filas siguen sirviendo a las pestañas
   de votos (Histórico / Este mes / Por anime / intención) hasta que el
   Registro parametrice la cifra acuñada. */

export const RankRowVotos = memo(function RankRowVotos({
  rank,
  personaje,
  votos,
  movimiento = null,
}) {
  if (!personaje?.slug) return null
  return (
    <li data-flip-key={personaje.slug}>
      <div className="group relative flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:gap-3 sm:px-5">
        <FlipFlashOverlays />
        <AppLink
          to={`/personajes/${personaje.slug}`}
          aria-label={`Rank #${rank} — ${personaje.nombre} de ${personaje.anime}, ${votos} votos`}
          title={`${personaje.nombre} de ${personaje.anime}`}
          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
        >
          <RankBadge rank={rank} />
          <PersonajeImg
            slug={personaje.slug}
            src={personaje.imagenUrl}
            nombre={personaje.nombre}
            colorDominante={personaje.imagenColorDominante}
            alt={personaje.nombre}
            loading="lazy"
            className="h-14 w-10 shrink-0 rounded-lg object-cover object-top sm:hidden"
          />
          <PersonajeCutImg
            slug={personaje.slug}
            alt={personaje.nombre}
            loading="lazy"
            sizes="56px"
            className="hidden h-14 w-14 shrink-0 rounded-lg border border-white/10 sm:block"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
                {personaje.nombre}
              </p>
              {movimiento && <MovimientoBadge movimiento={movimiento} />}
            </div>
            <p className="truncate text-[12px] text-fg-muted">
              {personaje.anime}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-base font-bold text-gold">
              <LiveNumber value={votos} />
            </p>
            <p className="text-[10px] text-fg-muted">
              votos
            </p>
          </div>
        </AppLink>
        <ChallengeLink slug={personaje.slug} nombre={personaje.nombre} />
      </div>
    </li>
  )
})

function ChallengeLink({ slug, nombre }) {
  return (
    <AppLink
      to={`/votar?personaje=${encodeURIComponent(slug)}`}
      aria-label={`Retar a ${nombre} en un duelo`}
      title={`Retar a ${nombre}`}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 text-[12px] font-black text-gold transition-colors hover:bg-accent/20"
    >
      <Swords className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Retar</span>
    </AppLink>
  )
}

function RankBadge({ rank }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold ${
        rank === 1
          ? 'bg-medal-gold/15 text-medal-gold'
          : rank === 2
            ? 'bg-medal-silver/15 text-medal-silver'
            : rank === 3
              ? 'bg-medal-bronze/15 text-medal-bronze'
              : 'bg-surface-alt text-fg-muted'
      }`}
    >
      {rank === 1 ? <Crown className="h-5 w-5" /> : rank}
    </span>
  )
}

function MovimientoBadge({ movimiento }) {
  if (movimiento.esNuevo) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md border border-accent/40 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-gold">
        Nuevo
      </span>
    )
  }
  const delta = movimiento.delta
  if (delta == null || delta === 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center font-mono text-[11px] font-bold text-fg-muted"
        title="Mantiene posición vs hace 7 días"
      >
        =
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-success"
        title={`Subió ${delta} posiciones vs hace 7 días`}
      >
        ↑{delta}
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-danger"
      title={`Bajó ${Math.abs(delta)} posiciones vs hace 7 días`}
    >
      ↓{Math.abs(delta)}
    </span>
  )
}
