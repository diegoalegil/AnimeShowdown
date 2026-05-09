import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Shield, Trophy, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { endpoints } from '../lib/api'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function AdminPage() {
  useDocumentTitle('Admin')
  const { user } = useAuth()

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
            <span className="font-mono text-accent">ADMIN</span>.
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            <Shield className="h-3 w-3" />
            Panel ADMIN
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Mantenimiento
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Crea personajes y torneos directamente contra el backend. Las creaciones aparecen tras refrescar la página de listas; el frontend no se entera porque tira de mock data.
          </p>
        </motion.header>
        <div className="grid gap-6">
          <FormPersonaje />
          <FormTorneo />
        </div>
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
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
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
