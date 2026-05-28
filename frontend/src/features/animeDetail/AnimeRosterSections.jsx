import { useState } from 'react'
import { Link } from 'react-router-dom'
import PersonajeCard from '../../components/PersonajeCard'
import PersonajeImg from '../../components/PersonajeImg'

const ROSTER_PAGE = 24

function RankingRow({ rank, slug, nombre, elo }) {
  // Solo ELO base (estimado). Las W/L sintéticas no se muestran.
  const tone =
    rank === 1
      ? 'border-yellow-400/50 bg-yellow-500/5'
      : rank <= 3
        ? 'border-amber-400/40 bg-amber-500/5'
        : 'border-border bg-surface'
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className={`group flex items-center gap-4 rounded-lg border px-3 py-2.5 transition-all hover:-translate-x-1 hover:border-accent/40 sm:px-5 ${tone}`}
      >
        <span
          className={`w-8 shrink-0 font-mono text-base font-extrabold tabular-nums ${
            rank === 1
              ? 'text-yellow-300'
              : rank <= 3
                ? 'text-amber-300'
                : 'text-fg-muted'
          }`}
        >
          #{rank}
        </span>
        <PersonajeImg
          slug={slug}
          alt={nombre}
          loading="lazy"
          className="h-12 w-9 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
            {nombre}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-gold">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO base
          </p>
        </div>
      </Link>
    </li>
  )
}

function AnimeRosterSections({ anime, destacados, personajes, top10, total }) {
  // Paginación incremental del roster completo (E3): rosters grandes (One
  // Piece, Naruto…) montaban 50-100+ cards de golpe. Mostramos de 24 en 24.
  // El patrón {key, count} resetea al cambiar de anime sin useEffect
  // (compatible con el React Compiler, igual que en PersonajesPage).
  const [pag, setPag] = useState({ key: anime, count: ROSTER_PAGE })
  const visibles = pag.key === anime ? pag.count : ROSTER_PAGE
  const verMas = () => setPag({ key: anime, count: visibles + ROSTER_PAGE })
  return (
    <>
      <section className="mb-12">
        <div className="mb-4 flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Roster principal
          </span>
          <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
            Personajes destacados
          </h2>
          <p className="text-[13px] text-fg-muted">
            Los más reconocibles del universo {anime}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {destacados.map((personaje) => (
            <PersonajeCard
              key={personaje.slug}
              slug={personaje.slug}
              nombre={personaje.nombre}
              anime={personaje.anime}
            />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4 flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
            Top 10 · ELO base
          </span>
          <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
            Ranking interno de {anime}
          </h2>
          <p className="text-[13px] text-fg-muted">
            Orden estimado dentro del universo {anime}. El ranking competitivo
            con votos reales vive en el ranking filtrado de este anime.
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {top10.map((personaje, index) => (
            <RankingRow
              key={personaje.slug}
              rank={index + 1}
              slug={personaje.slug}
              nombre={personaje.nombre}
              elo={personaje.elo}
            />
          ))}
        </ol>
      </section>

      {personajes.length > destacados.length && (
        <section>
          <div className="mb-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              Todos
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              Los {total} personajes de {anime}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {personajes.slice(0, visibles).map((personaje) => (
              <PersonajeCard
                key={personaje.slug}
                slug={personaje.slug}
                nombre={personaje.nombre}
                anime={personaje.anime}
              />
            ))}
          </div>
          {visibles < personajes.length && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={verMas}
                className="as-button-ghost rounded-lg px-6 py-2.5 text-sm font-bold"
              >
                Cargar {Math.min(ROSTER_PAGE, personajes.length - visibles)} más
                <span className="ml-2 text-fg-muted">
                  ({visibles} de {personajes.length})
                </span>
              </button>
            </div>
          )}
        </section>
      )}

      <p className="mt-12 text-center text-[13px] text-fg-muted">
        Tu personaje favorito no sube solo.{' '}
        <Link to={`/votar?anime=${encodeURIComponent(anime)}`} className="text-gold hover:underline">
          Entra a votar
        </Link>{' '}
        y cambia el ranking de {anime}.
      </p>
    </>
  )
}

export default AnimeRosterSections
