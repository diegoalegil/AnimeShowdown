import { useState } from 'react'
import { Navigate, Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Images,
  ListTodo,
  MessageSquare,
  Shield,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints } from '../lib/api'
import { useTorneosPendientes } from '../hooks/useTorneosCreados'
import AssetCoveragePanel from '../features/admin/components/AssetCoveragePanel'
import ColaComentariosPendientes from '../features/admin/components/ColaComentariosPendientes'
import ColaTorneosPendientes from '../features/admin/components/ColaTorneosPendientes'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function getAdminTabFromPath(pathname) {
  if (pathname.endsWith('/assets')) return 'assets'
  if (pathname.endsWith('/comentarios')) return 'comentarios'
  if (pathname.endsWith('/torneos')) return 'cola'
  return 'mantenimiento'
}

function AdminPage() {
  useSeo({ title: 'Admin', noindex: true })
  const { user } = useAuth()
  const location = useLocation()
  const tab = getAdminTabFromPath(location.pathname)
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <Shield className="h-3 w-3" />
            Panel ADMIN
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Mantenimiento
          </h1>
        </motion.header>

        <div className="mb-6 grid grid-cols-1 gap-1 rounded-lg border border-border bg-bg p-1 sm:grid-cols-4">
          <Link
            to="/admin"
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === 'mantenimiento'
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg-muted hover:text-fg-strong'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Crear
          </Link>
          <Link
            to="/admin/torneos"
            className={`relative inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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
          </Link>
          <Link
            to="/admin/comentarios"
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === 'comentarios'
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg-muted hover:text-fg-strong'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Comentarios
          </Link>
          <Link
            to="/admin/assets"
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === 'assets'
                ? 'bg-surface-alt text-fg-strong'
                : 'text-fg-muted hover:text-fg-strong'
            }`}
          >
            <Images className="h-4 w-4" />
            Assets
          </Link>
        </div>

        {tab === 'mantenimiento' && (
          <div className="grid gap-6">
            <FormPersonaje />
            <FormTorneo />
          </div>
        )}
        {tab === 'cola' && <ColaTorneosPendientes />}
        {tab === 'comentarios' && <ColaComentariosPendientes />}
        {tab === 'assets' && <AssetCoveragePanel />}
      </div>
    </section>
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
    <div className="rounded-2xl border border-border bg-surface p-6">
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
          <p className="sm:col-span-2 text-[12px] text-danger">{error}</p>
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
    <div className="rounded-2xl border border-border bg-surface p-6">
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
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </form>
    </div>
  )
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
        className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold ${
          errors[name] ? 'border-danger' : 'border-border'
        }`}
      />
      {errors[name] && (
        <p className="text-[11px] text-danger">{errors[name].message}</p>
      )}
    </div>
  )
}

export default AdminPage
