import { useState } from 'react'
import { Navigate, Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Check,
  EyeOff,
  Inbox,
  ListTodo,
  MessageSquare,
  Shield,
  Trash2,
  Trophy,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints, ApiError } from '../lib/api'
import {
  useAprobarTorneo,
  useRechazarTorneo,
  useTorneosPendientes,
} from '../hooks/useTorneosCreados'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function AdminPage() {
  useSeo({ title: 'Admin', noindex: true })
  const { user } = useAuth()
  const location = useLocation()
  const [tab, setTab] = useState(
    location.pathname.endsWith('/comentarios') ? 'comentarios' : 'mantenimiento',
  )
  const { data: pendientes } = useTorneosPendientes()
  const pendientesCount = pendientes?.length ?? 0

  if (!user) return <Navigate to="/login" replace />
  if (user.rol !== 'ADMIN')
    return (
      <section className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <Shield className="h-10 w-10 text-fg-muted" />
          <h1 className="text-2xl font-bold tracking-tight">
            Acceso restringido
          </h1>
          <p className="text-fg-muted">
            Esta página es solo para usuarios con rol{' '}
            <span className="font-mono text-gold">ADMIN</span>.
          </p>
          <Link
            to="/"
            className="mt-2 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    )

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
            <Shield className="h-3 w-3" />
            Panel ADMIN
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Mantenimiento
          </h1>
        </motion.header>

        <div className="mb-6 grid grid-cols-1 gap-1 rounded-lg border border-border bg-bg p-1 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setTab('mantenimiento')}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              tab === 'mantenimiento'
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg-muted hover:text-fg-strong'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Crear
          </button>
          <button
            type="button"
            onClick={() => setTab('cola')}
            className={`relative inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              tab === 'cola'
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg-muted hover:text-fg-strong'
            }`}
          >
            <ListTodo className="h-4 w-4" />
            Cola de torneos
            {pendientesCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-bg">
                {pendientesCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('comentarios')}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              tab === 'comentarios'
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg-muted hover:text-fg-strong'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Comentarios
          </button>
        </div>

        {tab === 'mantenimiento' && (
          <div className="grid gap-6">
            <FormPersonaje />
            <FormTorneo />
          </div>
        )}
        {tab === 'cola' && <ColaTorneosPendientes />}
        {tab === 'comentarios' && <ColaComentariosPendientes />}
      </div>
    </section>
  )
}

function ColaTorneosPendientes() {
  const { data: pendientes, isLoading, isError } = useTorneosPendientes()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }
  if (isError) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-fg-muted">
        No se pudo cargar la cola. Reintenta en unos segundos.
      </p>
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
        description: 'Mínimo 5 caracteres para que el creador entienda el porqué.',
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
    mutationFn: ({ id, estado }) => endpoints.adminCambiarEstadoComentario(id, estado),
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
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }
  if (isError) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-fg-muted">
        No se pudo cargar la cola de comentarios.
      </p>
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
          pending={cambiarEstado.isPending}
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
    <article className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-fg-strong">
            {comentario.autor?.username ?? 'Usuario'}
          </p>
          <p className="text-[11px] text-fg-muted">
            {comentario.personajeSlug} · {formatFecha(comentario.creadoEn)} · {comentario.reportes} reportes
          </p>
        </div>
        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-200">
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
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          Aprobar
        </button>
        <button
          type="button"
          onClick={() => onEstado('OCULTO')}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <EyeOff className="h-4 w-4" />
          Ocultar
        </button>
        <button
          type="button"
          onClick={() => onEstado('ELIMINADO')}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      </div>
    </article>
  )
}

function FormPersonaje() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()
  const [error, setError] = useState(null)

  const onSubmit = async (data) => {
    setError(null)
    try {
      await endpoints.createPersonaje({
        slug: data.slug,
        nombre: data.nombre,
        anime: data.anime,
        descripcion: data.descripcion || null,
        imagenUrl: `/personajes/${data.slug}.webp`,
      })
      toast.success(`Personaje creado: ${data.nombre}`, {
        description: `Slug: ${data.slug} · Anime: ${data.anime}`,
      })
      reset()
    } catch (err) {
      setError(err.message || 'No se pudo crear')
      toast.error('Error al crear personaje', {
        description: err.message,
      })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-gold">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-fg-strong">
            Nuevo personaje
          </h2>
          <p className="text-[12px] text-fg-muted">
            POST /api/personajes (requiere JWT ADMIN)
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Slug"
          name="slug"
          register={register}
          rules={{
            required: 'Obligatorio',
            pattern: {
              value: /^[a-z0-9_]+$/,
              message: 'Solo minúsculas, números y _',
            },
          }}
          errors={errors}
          placeholder="eren_yeager"
        />
        <Field
          label="Nombre"
          name="nombre"
          register={register}
          rules={{ required: 'Obligatorio', maxLength: 100 }}
          errors={errors}
          placeholder="Eren Yeager"
        />
        <Field
          label="Anime"
          name="anime"
          register={register}
          rules={{ required: 'Obligatorio', maxLength: 100 }}
          errors={errors}
          placeholder="Attack on Titan"
        />
        <Field
          label="Descripción (opcional)"
          name="descripcion"
          register={register}
          rules={{ maxLength: 500 }}
          errors={errors}
          placeholder="Soldado del 104º que desafía a los titanes…"
          fullWidth
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="sm:col-span-2 mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Creando…' : 'Crear personaje'}
        </button>
        {error && (
          <p className="sm:col-span-2 text-[12px] text-red-400">{error}</p>
        )}
      </form>
    </div>
  )
}

function FormTorneo() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()
  const [error, setError] = useState(null)

  const onSubmit = async (data) => {
    setError(null)
    try {
      await endpoints.createTorneo({
        nombre: data.nombre,
        descripcion: data.descripcion || null,
      })
      toast.success(`Torneo creado: ${data.nombre}`)
      reset()
    } catch (err) {
      setError(err.message || 'No se pudo crear')
      toast.error('Error al crear torneo', {
        description: err.message,
      })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-gold">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-fg-strong">Nuevo torneo</h2>
          <p className="text-[12px] text-fg-muted">
            POST /api/torneos (requiere JWT ADMIN)
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
        <Field
          label="Nombre"
          name="nombre"
          register={register}
          rules={{ required: 'Obligatorio', maxLength: 100 }}
          errors={errors}
          placeholder="Battle of the Demon Slayers"
          fullWidth
        />
        <Field
          label="Descripción (opcional)"
          name="descripcion"
          register={register}
          rules={{ maxLength: 500 }}
          errors={errors}
          placeholder="Bracket de 8 cazadores del Cuerpo de Cazadores de Demonios"
          fullWidth
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Creando…' : 'Crear torneo'}
        </button>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
      </form>
    </div>
  )
}

function formatFecha(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function Field({ label, name, register, rules, errors, placeholder, fullWidth }) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <label
        htmlFor={name}
        className="text-[12px] font-medium text-fg-strong"
      >
        {label}
      </label>
      <input
        id={name}
        type="text"
        {...register(name, rules)}
        placeholder={placeholder}
        className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          errors[name] ? 'border-red-500' : 'border-border'
        }`}
      />
      {errors[name] && (
        <p className="text-[11px] text-red-400">{errors[name].message}</p>
      )}
    </div>
  )
}

export default AdminPage
