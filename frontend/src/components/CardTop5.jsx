import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePerfilTop } from '../hooks/usePerfil'
import { pickVacio } from './Kaomoji'
import KanjiSpinner from './KanjiSpinner'
import PersonajeImg from './PersonajeImg'

/**
 * Card "Top personajes" del perfil.
 *
 * Lista los personajes más votados por un usuario, con avatar + nombre
 * + anime + count. Click → /personajes/{slug}.
 *
 * <p>Sin props pinta el top del usuario autenticado (perfil propio).
 * Con {@code data} pinta lo que le pasen — usado en perfil público.
 * {@code titulo} y {@code mensajeVacio} permiten personalizar el copy
 * cuando es de otra persona ("Top 5 de Diego" en vez de "Tu Top 5").
 */
function CardTop5({
  data: dataProp = null,
  titulo = 'Tu Top 5',
  mensajeIntro = 'Los personajes a los que más has votado.',
  mensajeVacio = null,
}) {
  const enabled = dataProp === null
  const { data: dataHook, isLoading: isLoadingHook } = usePerfilTop({
    limit: 5,
    enabled,
  })
  const top = dataProp ?? dataHook
  const isLoading = dataProp === null && isLoadingHook

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Heart className="h-4 w-4 text-danger" />
        <h2 className="text-lg font-bold text-fg-strong">{titulo}</h2>
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">{mensajeIntro}</p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <KanjiSpinner size="sm" />
        </div>
      ) : !top || top.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-fg-muted">
          <p className="font-mono text-2xl text-fg-muted/80">
            {pickVacio('top5')}
          </p>
          {mensajeVacio ? (
            <p className="text-[12px]">{mensajeVacio}</p>
          ) : (
            <p className="text-[12px]">
              Aún no has votado a ningún personaje. Empieza desde{' '}
              <Link to="/votar" className="text-gold hover:underline">
                /votar
              </Link>
              .
            </p>
          )}
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
                <PersonajeImg
                  slug={p.slug}
                  src={p.imagenUrl}
                  alt={p.nombre}
                  loading="lazy"
                  sizes="40px"
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
