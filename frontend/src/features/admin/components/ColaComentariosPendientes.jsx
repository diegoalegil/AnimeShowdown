import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, EyeOff, MessageSquare, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import EmptyState from '../../../components/EmptyState'
import Skeleton from '../../../components/Skeleton'
import { endpoints, ApiError } from '../../../lib/api'

function ColaComentariosPendientes() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'comentarios', 'PENDIENTE_REVISION'],
    queryFn: () =>
      endpoints.adminComentarios({
        estado: 'PENDIENTE_REVISION',
        size: 50,
      }),
    refetchInterval: 30_000,
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }) =>
      endpoints.adminCambiarEstadoComentario(id, estado),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'comentarios'] })
      toast.success(
        vars.estado === 'VISIBLE'
          ? 'Comentario aprobado'
          : vars.estado === 'OCULTO'
            ? 'Comentario ocultado'
            : 'Comentario eliminado',
      )
    },
    onError: (err) => {
      toast.error('No se pudo moderar', {
        description:
          err instanceof ApiError
            ? err.message || `Error ${err.status}`
            : 'Revisa la conexión.',
      })
    },
  })

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
        title="No se pudo cargar la cola de comentarios"
        description="Reintenta en unos segundos para continuar moderando."
      />
    )
  }

  const comentarios = data?.content ?? []
  if (comentarios.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface py-12 text-fg-muted">
        <MessageSquare className="h-7 w-7" />
        <p className="text-sm">No hay comentarios pendientes de revisión.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {comentarios.map((comentario) => (
        <ComentarioRevisionCard
          key={comentario.id}
          comentario={comentario}
          // Solo la tarjeta en curso se deshabilita: antes isPending (global)
          // deshabilitaba TODA la cola al moderar un único comentario.
          pending={
            cambiarEstado.isPending &&
            cambiarEstado.variables?.id === comentario.id
          }
          onEstado={(estado) =>
            cambiarEstado.mutate({ id: comentario.id, estado })
          }
        />
      ))}
    </div>
  )
}

function ComentarioRevisionCard({ comentario, pending, onEstado }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-fg-strong">
            {comentario.autor?.username ?? 'Usuario'}
          </p>
          <p className="text-[11px] text-fg-muted">
            {comentario.personajeSlug} · {formatFecha(comentario.creadoEn)} ·{' '}
            {comentario.reportes} reportes
          </p>
        </div>
        <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] font-semibold text-warning">
          Pendiente
        </span>
      </div>
      <p className="mb-4 whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-fg">
        {comentario.contenido}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEstado('VISIBLE')}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-success disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          Aprobar
        </button>
        <button
          type="button"
          onClick={() => onEstado('OCULTO')}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning transition-colors hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <EyeOff className="h-4 w-4" />
          Ocultar
        </button>
        <button
          type="button"
          onClick={() => onEstado('ELIMINADO')}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      </div>
    </article>
  )
}

function formatFecha(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default ColaComentariosPendientes
