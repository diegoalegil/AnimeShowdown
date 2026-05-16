import { Trophy, Lock } from 'lucide-react'

/**
 * Renderiza un bracket de eliminación directa con datos vivos del backend.
 *
 * Plan v2 §1.1 + §17.1 — antes el componente recibía `slugs` (array plano
 * de participantes) y computaba el ganador local por ELO, lo que producía
 * dos bugs:
 *   1. Los torneos 'proximo' mostraban estructura completa hasta la final
 *      como si las rondas hubieran ocurrido — el render no respetaba el
 *      estado real del torneo.
 *   2. Los ganadores eran inventados, no reflejaban los votos reales.
 *
 * Ahora el componente solo lee los DTOs que llegan del backend:
 *
 *   props.enfrentamientos: EnfrentamientoDto[] ya ordenados por
 *     (ronda asc, id asc). Cada uno con `personaje1`/`personaje2`
 *     posiblemente null (rondas futuras sin resolver) y `ganador`
 *     null hasta que la ronda se cierre.
 *   props.ganadorSlug: slug del campeón si el torneo está FINISHED.
 *   props.totalRondas: para etiquetar columnas (Octavos / Cuartos / etc.).
 *   props.estado: SCHEDULED / IN_PROGRESS / FINISHED (informativo —
 *     el render progresivo emerge naturalmente del shape de los datos).
 */

const TITULOS = {
  4: ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
  3: ['Cuartos', 'Semifinal', 'Final'],
  2: ['Semifinal', 'Final'],
  1: ['Final'],
}

function Bracket({ enfrentamientos, ganadorSlug, totalRondas }) {
  if (!enfrentamientos || enfrentamientos.length === 0) {
    return null
  }

  // Agrupa los matches por ronda. enfrentamientos ya viene ordenado por
  // (ronda, id) del backend, así que la inserción mantiene el orden visual.
  const porRonda = new Map()
  for (const enf of enfrentamientos) {
    const r = enf.ronda
    if (!porRonda.has(r)) porRonda.set(r, [])
    porRonda.get(r).push(enf)
  }
  const rondas = [...porRonda.keys()].sort((a, b) => a - b)
  const titulos = TITULOS[totalRondas] || []

  // Campeón resuelto con dos fuentes (alineado con TorneoQueryService):
  //   1. ganadorSlug del DTO (campo Torneo.ganadorPersonaje).
  //   2. ganador del match de la última ronda en el array.
  const ultimoMatch = porRonda.get(rondas[rondas.length - 1])?.[0]
  const campeon =
    findPersonajePorSlug(enfrentamientos, ganadorSlug) ??
    ultimoMatch?.ganador ??
    null

  return (
    <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
      <div className="flex min-w-max items-stretch gap-3">
        {rondas.map((ronda, i) => (
          <div
            key={ronda}
            className="flex min-w-[180px] flex-col justify-around gap-3"
          >
            <h3 className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              {titulos[i] || `Ronda ${ronda}`}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {porRonda.get(ronda).map((match) => (
                <BracketMatch key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex min-w-[180px] flex-col items-stretch justify-around">
          <h3 className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
            Campeón
          </h3>
          {campeon ? (
            <ChampionSlot personaje={campeon} />
          ) : (
            <ChampionPlaceholder />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Busca un personaje (PersonajeMiniDto) por slug entre todos los matches
 * — fallback para el campeón cuando solo nos pasan ganadorSlug y no la
 * entidad completa.
 */
function findPersonajePorSlug(enfrentamientos, slug) {
  if (!slug) return null
  for (const e of enfrentamientos) {
    if (e.personaje1?.slug === slug) return e.personaje1
    if (e.personaje2?.slug === slug) return e.personaje2
    if (e.ganador?.slug === slug) return e.ganador
  }
  return null
}

function BracketMatch({ match }) {
  const ambosPersonajes = match.personaje1 && match.personaje2

  // Match vacío (slot de ronda futura sin resolver): placeholder difuminado.
  // Sigue el patrón ya existente del ChampionPlaceholder (border-dashed +
  // Lock + texto) para coherencia visual.
  if (!ambosPersonajes) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-alt/30 px-2 py-3 opacity-60">
        <Lock className="h-3 w-3 text-fg-muted" aria-hidden="true" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
          Por decidir
        </span>
      </div>
    )
  }

  const ganadorId = match.ganador?.id
  return (
    <div className="rounded-lg border border-border bg-surface p-1.5">
      <BracketSlot
        personaje={match.personaje1}
        winner={ganadorId === match.personaje1.id}
      />
      <div className="my-1 h-px bg-border" />
      <BracketSlot
        personaje={match.personaje2}
        winner={ganadorId === match.personaje2.id}
      />
    </div>
  )
}

function BracketSlot({ personaje, winner }) {
  return (
    <div
      className={`flex items-center gap-2 rounded px-1.5 py-1 ${
        winner ? 'bg-accent-soft' : ''
      }`}
    >
      <img
        src={personaje.imagenUrl}
        alt=""
        loading="lazy"
        className="h-6 w-6 shrink-0 rounded object-cover object-top"
      />
      <span
        className={`min-w-0 flex-1 truncate text-[12px] font-medium ${
          winner ? 'text-fg-strong' : 'text-fg-muted'
        }`}
      >
        {personaje.nombre}
      </span>
      {winner && (
        <Trophy className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
      )}
    </div>
  )
}

function ChampionSlot({ personaje }) {
  return (
    <div
      className="mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-accent/40 bg-accent-soft p-3"
      style={{ boxShadow: '0 0 30px rgb(255 46 99 / 0.25)' }}
    >
      <img
        src={personaje.imagenUrl}
        alt={personaje.nombre}
        className="aspect-[2/3] w-full max-w-[110px] rounded-lg object-cover object-top"
      />
      <div className="text-center">
        <p className="text-sm font-bold text-fg-strong">{personaje.nombre}</p>
        <p className="text-[11px] text-fg-muted">{personaje.anime}</p>
      </div>
    </div>
  )
}

function ChampionPlaceholder() {
  return (
    <div className="mt-3 flex aspect-[2/3] max-w-[110px] flex-col items-center justify-center gap-2 self-center rounded-xl border-2 border-dashed border-border bg-surface-alt/40 p-3 text-center">
      <Lock className="h-5 w-5 text-fg-muted" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        Por decidir
      </p>
      <p className="text-[10px] text-fg-muted">El torneo aún no ha terminado</p>
    </div>
  )
}

export default Bracket
