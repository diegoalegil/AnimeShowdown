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

function LoginPage() {
  useDocumentTitle('Iniciar sesión')
  const { login } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      await login(data.identificador, data.password)
      navigate('/')
    } catch {
      setError('root', {
        message: 'No se pudo iniciar sesión. Intenta de nuevo.',
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
            Acceso
          </span>
          <h1 className="text-3xl tracking-tight">Inicia sesión</h1>
          <p className="text-fg-muted">
            Crea torneos, vota enfrentamientos y sigue tu historial. Puedes entrar con tu username o tu email.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="identificador"
              className="text-[13px] font-medium text-fg-strong"
            >
              Username o email
            </label>
            <input
              id="identificador"
              type="text"
              autoComplete="username"
              {...register('identificador', {
                required: 'Introduce tu username o email',
                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.identificador ? 'border-red-500' : 'border-border'
              }`}
              placeholder="diego  ·  diego@ejemplo.com"
            />
            {errors.identificador && (
              <p className="text-[12px] text-red-400">
                {errors.identificador.message}
              </p>
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
              autoComplete="current-password"
              {...register('password', {
                required: 'Introduce tu contraseña',
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
          {errors.root && (
            <p className="text-[12px] text-red-400">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
          <Link
            to="/forgot-password"
            className="self-end text-[12px] font-medium text-fg-muted transition-colors hover:text-accent"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          ¿No tienes cuenta?{' '}
          <Link
            to="/register"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Crea una
          </Link>
        </p>
      </motion.div>
    </section>
  )
}

export default LoginPage
