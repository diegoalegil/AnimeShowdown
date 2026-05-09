import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function RegisterPage() {
  useDocumentTitle('Crear cuenta')
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const password = watch('password')

  const onSubmit = async (data) => {
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
      })
      navigate('/')
    } catch {
      setError('root', {
        message: 'No se pudo crear la cuenta. Intenta de nuevo.',
      })
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
            Nueva cuenta
          </span>
          <h1 className="text-3xl tracking-tight">Únete a AnimeShowdown</h1>
          <p className="text-fg-muted">
            Crea torneos, vota enfrentamientos y sigue tu historial. Tu username será visible cuando votes.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-[13px] font-medium text-fg-strong"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              {...register('username', {
                required: 'Elige un username',
                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                maxLength: { value: 30, message: 'Máximo 30 caracteres' },
                pattern: {
                  value: /^[A-Za-z0-9._-]+$/,
                  message: 'Solo letras, números, puntos, guiones y barra baja',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.username ? 'border-red-500' : 'border-border'
              }`}
              placeholder="diegoalegil"
            />
            {errors.username && (
              <p className="text-[12px] text-red-400">
                {errors.username.message}
              </p>
            )}
          </div>
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
              placeholder="diego@ejemplo.com"
            />
            {errors.email && (
              <p className="text-[12px] text-red-400">{errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-fg-strong"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password', {
                required: 'Introduce una contraseña',
                minLength: { value: 6, message: 'Mínimo 6 caracteres' },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.password ? 'border-red-500' : 'border-border'
              }`}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-[12px] text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-[13px] font-medium text-fg-strong"
            >
              Confirma la contraseña
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
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Inicia sesión
          </Link>
        </p>
      </motion.div>
    </section>
  )
}

export default RegisterPage
