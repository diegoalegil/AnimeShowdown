import { Heart, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePerfilTop } from '../hooks/usePerfil'

/**
 * Card "Tu Top 5" del perfil (Plan v2 §4.1).
 *
 * Lista los 5 personajes más votados por el usuario, con avatar + nombre
 * + anime + count. Click → /personajes/{slug}.
 */
function CardTop5() {
  const { data: top, isLoading } = usePerfilTop({ limit: 5 })

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Heart className="h-4 w-4 text-rose-400" />
        <h2 className="text-lg font-bold text-fg-strong">Tu Top 5</h2>
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">
        Los personajes a los que más has votado.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : !top || top.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-fg-muted">
          <Inbox className="h-6 w-6" />
          <p className="text-[12px]">
            Aún no has votado a ningún personaje. Empieza desde{' '}
            <Link to="/votar" className="text-accent hover:underline">
              /votar
            </Link>
            .
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((p, idx) => (
            <li key={p.personajeId}>
              <Link
                to={`/personajes/${p.slug}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2.5 transition-colors hover:border-accent/40"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-alt text-[10px] font-bold tabular-nums text-fg-muted">
                  {idx + 1}
                </span>
                <img
                  src={p.imagenUrl}
                  alt=""
                  loading="lazy"
                  className="h-10 w-8 shrink-0 rounded object-cover object-top"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-fg-strong">
                    {p.nombre}
                  </p>
                  <p className="truncate text-[11px] text-fg-muted">
                    {p.anime}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
                  {p.votos} {p.votos === 1 ? 'voto' : 'votos'}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default CardTop5
