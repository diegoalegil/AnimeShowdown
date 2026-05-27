import { useState } from 'react'
import { AlertTriangle, Check, Inbox, Trophy, X } from 'lucide-react'
import { toast } from 'sonner'
import EmptyState from '../../../components/EmptyState'
import Skeleton from '../../../components/Skeleton'
import { ApiError } from '../../../lib/api'
import {
  useAprobarTorneo,
  useRechazarTorneo,
  useTorneosPendientes,
} from '../../../hooks/useTorneosCreados'

function ColaTorneosPendientes() {
  const { data: pendientes, isLoading, isError } = useTorneosPendientes()

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="line" className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se pudo cargar la cola"
        description="Reintenta en unos segundos para revisar torneos pendientes."
      />
    )
  }
  if (!pendientes || pendientes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface py-12 text-fg-muted">
        <Inbox className="h-7 w-7" />
        <p className="text-sm">No hay torneos pendientes de revisión.</p>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      {pendientes.map((t) => (
        <RevisionCard key={t.id} torneo={t} />
      ))}
    </div>
  )
}

function RevisionCard({ torneo }) {
  const aprobar = useAprobarTorneo()
  const rechazar = useRechazarTorneo()
  const [mostrandoMotivo, setMostrandoMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')

  const handleAprobar = async () => {
    try {
      await aprobar.mutateAsync(torneo.id)
      toast.success('Torneo aprobado', {
        description: `"${torneo.nombre}" ya está en juego.`,
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('Error al aprobar', { description: msg })
    }
  }

  const handleRechazar = async () => {
    if (motivo.trim().length < 5) {
      toast.error('Motivo demasiado corto', {
        description:
          'Mínimo 5 caracteres para que el creador entienda el porqué.',
      })
      return
    }
    try {
      await rechazar.mutateAsync({ id: torneo.id, motivo: motivo.trim() })
      toast.success('Torneo rechazado', {
        description: 'El creador recibirá una notificación con el motivo.',
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('Error al rechazar', { description: msg })
    }
  }

  const pending = aprobar.isPending || rechazar.isPending

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-fg-strong">{torneo.nombre}</p>
          {torneo.descripcion && (
            <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">
              {torneo.descripcion}
            </p>
          )}
          <p className="mt-1 text-[11px] text-fg-muted">
            Enviado el{' '}
            {new Date(torneo.fechaCreacion).toLocaleString('es-ES', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        </div>
      </div>

      {!mostrandoMotivo ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAprobar}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {aprobar.isPending ? 'Aprobando…' : 'Aprobar'}
          </button>
          <button
            type="button"
            onClick={() => setMostrandoMotivo(true)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Rechazar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
          <label
            htmlFor={`motivo-${torneo.id}`}
            className="text-[12px] font-medium text-rose-200"
          >
            Motivo del rechazo
          </label>
          <textarea
            id={`motivo-${torneo.id}`}
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder="Mínimo 5 caracteres — esto se lo enseña el frontend al creador."
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRechazar}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              {rechazar.isPending ? 'Enviando…' : 'Confirmar rechazo'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrandoMotivo(false)
                setMotivo('')
              }}
              disabled={pending}
              className="text-[12px] text-fg-muted transition-colors hover:text-fg-strong disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ColaTorneosPendientes
