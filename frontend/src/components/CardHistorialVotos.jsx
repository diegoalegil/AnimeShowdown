import { useState } from 'react'
import { Clock, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePerfilHistorial } from '../hooks/usePerfil'

/**
 * Card "Historial de votos" del perfil (Plan v2 §4.1).
 *
 * Listado paginado de los últimos votos del usuario. Cada entrada muestra:
 *   - Personaje al que votaste (avatar + nombre).
 *   - Oponente si era un enfrentamiento real, o etiqueta 'casual' si era
 *     un voto del modo random.
 *   - Fecha relativa.
 *   - Link al torneo si aplica.
 *
 * Inicial size=20 y un botón "Ver más" que sube la página.
 */
function CardHistorialVotos() {
  const [page, setPage] = useState(0)
  const size = 20
  const { data, isLoading } = usePerfilHistorial({ page, size })
  const items = data?.content ?? []
  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-sky-400" />
        <h2 className="text-lg font-bold text-fg-strong">
          Historial de votos
        </h2>
        {totalElements > 0 && (
          <span className="ml-auto inline-flex rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
            {totalElements}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-fg-muted">
          <Inbox className="h-6 w-6" />
          <p className="text-[12px]">
            Sin votos todavía. Tu próximo voto aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((v) => (
              <VotoItem key={v.id} voto={v} />
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[12px]">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-border bg-bg px-3 py-1 font-medium text-fg-strong transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Anteriores
              </button>
              <span className="text-fg-muted">
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={page >= totalPages - 1}
                className="rounded-md border border-border bg-bg px-3 py-1 font-medium text-fg-strong transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguientes →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function VotoItem({ voto }) {
  const fecha = formatRelativo(voto.fecha)
  const esCasual = !voto.enfrentamientoId

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2.5">
      <Link to={`/personajes/${voto.personajeSlug}`} className="shrink-0">
        <img
          src={voto.personajeImagenUrl}
          alt={voto.personajeNombre}
          loading="lazy"
          className="h-10 w-8 rounded object-cover object-top"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-fg-strong">
          <Link
            to={`/personajes/${voto.personajeSlug}`}
            className="hover:text-accent"
          >
            {voto.personajeNombre}
          </Link>
          {voto.oponenteNombre && (
            <span className="font-normal text-fg-muted">
              {' '}
              vs{' '}
              <Link
                to={`/personajes/${voto.oponenteSlug}`}
                className="hover:text-accent"
              >
                {voto.oponenteNombre}
              </Link>
            </span>
          )}
        </p>
        <p className="truncate text-[11px] text-fg-muted">
          {esCasual ? (
            <span className="inline-flex rounded bg-surface-alt px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
              Casual
            </span>
          ) : voto.torneoSlug ? (
            <Link
              to={`/torneos/${voto.torneoSlug}`}
              className="hover:text-accent"
            >
              {voto.torneoNombre}
            </Link>
          ) : (
            'En torneo'
          )}
        </p>
      </div>
      <time className="shrink-0 text-[11px] text-fg-muted">{fecha}</time>
    </li>
  )
}

function formatRelativo(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  const diffMs = Date.now() - fecha.getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} día${d > 1 ? 's' : ''}`
  return fecha.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  })
}

export default CardHistorialVotos
