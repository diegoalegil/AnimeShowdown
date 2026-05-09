import { Trophy } from 'lucide-react'
import {
  imagenPersonaje,
  getPersonajeBySlug,
  getStatsPersonaje,
} from '../data/personajes'

function generarBracket(slugs) {
  if (slugs.length < 2) return { rounds: [], campeon: slugs[0] ?? null }
  let current = [...slugs]
  const rounds = []
  while (current.length > 1) {
    const matches = []
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i]
      const b = current[i + 1]
      const eloA = getStatsPersonaje(a).elo
      const eloB = getStatsPersonaje(b).elo
      const winner = eloA >= eloB ? a : b
      matches.push({ a, b, winner })
    }
    rounds.push(matches)
    current = matches.map((m) => m.winner)
  }
  return { rounds, campeon: current[0] }
}

const TITULOS = {
  4: ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
  3: ['Cuartos', 'Semifinal', 'Final'],
  2: ['Semifinal', 'Final'],
  1: ['Final'],
}

function Bracket({ slugs, ganadorReal }) {
  const { rounds, campeon } = generarBracket(slugs)
  if (rounds.length === 0) return null
  const titulos = TITULOS[rounds.length] || []
  const campeonFinal = ganadorReal || campeon

  return (
    <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
      <div className="flex min-w-max items-stretch gap-3">
        {rounds.map((round, ri) => (
          <div
            key={ri}
            className="flex min-w-[180px] flex-col justify-around gap-3"
          >
            <h3 className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              {titulos[ri] || `Ronda ${ri + 1}`}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.map((match, mi) => (
                <BracketMatch key={mi} match={match} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex min-w-[180px] flex-col items-stretch justify-around">
          <h3 className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
            Campeón
          </h3>
          <ChampionSlot slug={campeonFinal} />
        </div>
      </div>
    </div>
  )
}

function BracketMatch({ match }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-1.5">
      <BracketSlot slug={match.a} winner={match.winner === match.a} />
      <div className="my-1 h-px bg-border" />
      <BracketSlot slug={match.b} winner={match.winner === match.b} />
    </div>
  )
}

function BracketSlot({ slug, winner }) {
  const p = getPersonajeBySlug(slug)
  if (!p) return null
  return (
    <div
      className={`flex items-center gap-2 rounded px-1.5 py-1 ${
        winner ? 'bg-accent-soft' : ''
      }`}
    >
      <img
        src={imagenPersonaje(slug)}
        alt=""
        loading="lazy"
        className="h-6 w-6 shrink-0 rounded object-cover object-top"
      />
      <span
        className={`min-w-0 flex-1 truncate text-[12px] font-medium ${
          winner ? 'text-fg-strong' : 'text-fg-muted'
        }`}
      >
        {p.nombre}
      </span>
      {winner && (
        <Trophy className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
      )}
    </div>
  )
}

function ChampionSlot({ slug }) {
  const p = getPersonajeBySlug(slug)
  if (!p) return null
  return (
    <div
      className="mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-accent/40 bg-accent-soft p-3"
      style={{ boxShadow: '0 0 30px rgb(255 46 99 / 0.25)' }}
    >
      <img
        src={imagenPersonaje(slug)}
        alt={p.nombre}
        className="aspect-[2/3] w-full max-w-[110px] rounded-lg object-cover object-top"
      />
      <div className="text-center">
        <p className="text-sm font-bold text-fg-strong">{p.nombre}</p>
        <p className="text-[11px] text-fg-muted">{p.anime}</p>
      </div>
    </div>
  )
}

export default Bracket
