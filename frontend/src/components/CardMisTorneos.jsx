import { Link } from 'react-router-dom'
import { Sparkles, Trophy } from 'lucide-react'
import { useMisTorneos } from '../hooks/useTorneosCreados'
import { pickVacio } from './Kaomoji'

/**
 * Card "Mis torneos" del perfil (Plan v2 §4.9).
 *
 * Lista los torneos que el usuario ha creado, con pill de estado de
 * revisión (PENDIENTE / APROBADO / RECHAZADO) y motivo en caso de
 * rechazo. Si el user nunca ha creado un torneo muestra un CTA al
 * form de creación. Si no hay user (no debería pasar — la página
 * padre PerfilPage redirige a /login) no renderiza nada.
 */
function CardMisTorneos() {
  const { data: torneos, isLoading } = useMisTorneos()

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h2 className="text-lg font-bold text-fg-strong">Mis torneos</h2>
        {!isLoading && torneos && torneos.length > 0 && (
          <span className="ml-auto inline-flex rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
            {torneos.length}
          </span>
        )}
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">
        Los torneos que has creado. Tras enviarlos, un admin los revisa antes
        de hacerlos públicos.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : !torneos || torneos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-fg-muted">
          <p className="font-mono text-2xl text-fg-muted/80">
            {pickVacio('mis-torneos')}
          </p>
          <p className="text-[12px]">
            Aún no has creado ningún torneo. Elige tus 8 o 16 favoritos y
            ponlos a luchar.
          </p>
          <Link
            to="/torneos/crear"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Crear mi primer torneo
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {torneos.map((t) => (
            <ItemTorneo key={t.id} torneo={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

const PILLS = {
  PENDIENTE: {
    text: 'En revisión',
    cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  APROBADO: {
    text: 'Aprobado',
    cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  RECHAZADO: {
    text: 'Rechazado',
    cls: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  },
  NO_APLICA: {
    text: 'Publicado',
    cls: 'border-border bg-bg text-fg-muted',
  },
}

function ItemTorneo({ torneo }) {
  const pill = PILLS[torneo.estadoRevision] ?? PILLS.NO_APLICA
  const visible =
    torneo.estadoRevision === 'APROBADO' || torneo.estadoRevision === 'NO_APLICA'

  const contenido = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-fg-strong">
            {torneo.nombre}
          </p>
          <span
            className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pill.cls}`}
          >
            {pill.text}
          </span>
        </div>
        {torneo.descripcion && (
          <p className="mt-1 line-clamp-1 text-[11px] text-fg-muted">
            {torneo.descripcion}
          </p>
        )}
        {torneo.estadoRevision === 'RECHAZADO' && torneo.motivoRechazo && (
          <p className="mt-1 text-[11px] text-rose-300/80">
            <strong className="font-semibold">Motivo:</strong>{' '}
            {torneo.motivoRechazo}
          </p>
        )}
      </div>
    </div>
  )

  if (visible) {
    return (
      <li>
        <Link
          to={`/torneos/${torneo.slug}`}
          className="block rounded-lg border border-border bg-bg p-3 transition-colors hover:border-accent/40"
        >
          {contenido}
        </Link>
      </li>
    )
  }
  return (
    <li className="rounded-lg border border-border bg-bg p-3">{contenido}</li>
  )
}

export default CardMisTorneos
