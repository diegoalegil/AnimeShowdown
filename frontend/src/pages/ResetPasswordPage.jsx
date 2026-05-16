import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { endpoints, ApiError } from '../lib/api'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function ResetPasswordPage() {
  useSeo({ title: 'Nueva contraseña', noindex: true })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: searchParams.get('email') || '',
    },
  })

  const password = watch('newPassword')

  const onSubmit = async (data) => {
    try {
      await endpoints.resetPassword({
        email: data.email,
        codigo: data.codigo,
        newPassword: data.newPassword,
      })
      toast.success('Contraseña actualizada', {
        description: 'Inicia sesión con tu nueva contraseña.',
      })
      navigate('/login')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      setError('root', { message: msg })
      toast.error('No se pudo resetear', { description: msg })
    }
  }

  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8 sm:py-20">
      <motion.div
        className="w-full max-w-md"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="mb-6 flex flex-col items-start gap-2">
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Recuperar acceso
          </span>
          <h1 className="text-3xl tracking-tight">Define tu nueva contraseña</h1>
          <p className="text-fg-muted">
            Introduce el código de 6 dígitos que te llegó por email. Tienes 15 minutos desde que lo solicitaste.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-fg-strong"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email', {
                required: 'Introduce tu email',
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: 'El email no es válido',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.email ? 'border-red-500' : 'border-border'
              }`}
              placeholder="tu@correo.com"
            />
            {errors.email && (
              <p className="text-[12px] text-red-400">{errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="codigo"
              className="text-[13px] font-medium text-fg-strong"
            >
              Código (6 dígitos)
            </label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...register('codigo', {
                required: 'Introduce el código',
                pattern: {
                  value: /^\d{6}$/,
                  message: 'Tienen que ser 6 dígitos',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-center font-mono text-xl tracking-[0.4em] text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.codigo ? 'border-red-500' : 'border-border'
              }`}
              placeholder="000000"
            />
            {errors.codigo && (
              <p className="text-[12px] text-red-400">
                {errors.codigo.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="newPassword"
              className="text-[13px] font-medium text-fg-strong"
            >
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register('newPassword', {
                required: 'Introduce una contraseña',
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                pattern: {
                  value: /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/,
                  message: 'Debe incluir al menos una letra y un número',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.newPassword ? 'border-red-500' : 'border-border'
              }`}
              placeholder="••••••••"
            />
            {errors.newPassword && (
              <p className="text-[12px] text-red-400">
                {errors.newPassword.message}
              </p>
            )}
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-[13px] font-medium text-fg-strong"
            >
              Confirma la nueva contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword', {
                required: 'Confirma tu contraseña',
                validate: (value) =>
                  value === password || 'Las contraseñas no coinciden',
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.confirmPassword ? 'border-red-500' : 'border-border'
              }`}
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-[12px] text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          {errors.root && (
            <p className="text-[12px] text-red-400">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {isSubmitting ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          ¿No te llegó el código?{' '}
          <Link
            to="/forgot-password"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Solicitar otro
          </Link>
        </p>
      </motion.div>
    </section>
  )
}

export default ResetPasswordPage
