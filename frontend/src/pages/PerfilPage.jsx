import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Mail, Shield, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { endpoints, ApiError } from '../lib/api'
import Avatar from '../components/Avatar'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PerfilPage() {
  useDocumentTitle('Mi perfil')
  const { user, updateUser } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Mi cuenta
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Perfil
          </h1>
        </motion.header>

        <div className="grid gap-6">
          <CardDatos user={user} />
          <CardAvatar user={user} updateUser={updateUser} />
        </div>
      </div>
    </section>
  )
}

function CardDatos({ user }) {
  return (
    <div className="flex items-center gap-5 rounded-xl border border-border bg-surface p-6">
      <Avatar user={user} size={80} />
      <div className="min-w-0 flex flex-1 flex-col gap-1">
        <p className="text-xl font-bold tracking-tight text-fg-strong">
          {user.username}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
          <Mail className="h-3.5 w-3.5" />
          {user.email || 'sin email'}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[12px]">
          <User className="h-3.5 w-3.5 text-fg-muted" />
          <span
            className={`font-mono font-bold ${
              user.rol === 'ADMIN' ? 'text-accent' : 'text-fg-muted'
            }`}
          >
            {user.rol || 'USER'}
          </span>
          {user.rol === 'ADMIN' && (
            <Shield className="h-3 w-3 text-accent" />
          )}
        </p>
      </div>
    </div>
  )
}

function CardAvatar({ user, updateUser }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { avatarUrl: user.avatarUrl || '' } })
  const [savedError, setSavedError] = useState(null)
  const previewUrl = watch('avatarUrl')

  const onSubmit = async (data) => {
    setSavedError(null)
    try {
      const url = data.avatarUrl?.trim() || null
      await endpoints.updateAvatar(url)
      updateUser({ avatarUrl: url })
      toast.success('Avatar actualizado', {
        description: url ? 'Imagen vinculada correctamente.' : 'Volviste al avatar generado.',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setSavedError(err.message)
        toast.error('No se pudo guardar', { description: err.message })
      } else {
        // fallback demo
        const url = data.avatarUrl?.trim() || null
        updateUser({ avatarUrl: url })
        toast.success('Avatar actualizado (modo demo)')
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-fg-strong">Foto de perfil</h2>
        <p className="text-[12px] text-fg-muted">
          Pega la URL de una imagen pública (jpg, png, webp). Si la dejas vacía, se usa el avatar generado de iniciales.
        </p>
      </div>
      <div className="mb-5 flex items-center gap-4">
        <Avatar
          user={{ ...user, avatarUrl: previewUrl?.trim() || null }}
          size={64}
        />
        <p className="text-[13px] text-fg-muted">Vista previa</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="avatarUrl"
            className="text-[12px] font-medium text-fg-strong"
          >
            URL de la imagen
          </label>
          <input
            id="avatarUrl"
            type="url"
            {...register('avatarUrl', {
              maxLength: { value: 500, message: 'Máximo 500 caracteres' },
              pattern: {
                value: /^$|^https?:\/\/.+/,
                message: 'Debe empezar por http:// o https://',
              },
            })}
            placeholder="https://i.imgur.com/abc.jpg"
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.avatarUrl ? 'border-red-500' : 'border-border'
            }`}
          />
          {errors.avatarUrl && (
            <p className="text-[11px] text-red-400">
              {errors.avatarUrl.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Guardando…' : 'Guardar avatar'}
        </button>
        {savedError && (
          <p className="text-[11px] text-red-400">{savedError}</p>
        )}
      </form>
    </div>
  )
}

export default PerfilPage
