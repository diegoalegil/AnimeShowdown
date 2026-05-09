import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, Mail } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { endpoints, ApiError } from '../lib/api'

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña')
  const navigate = useNavigate()
  const [enviado, setEnviado] = useState(false)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      await endpoints.forgotPassword(data.email)
      setEnviado(true)
      toast.success('Si el email existe, te hemos enviado un código', {
        description: 'Revisa tu bandeja de entrada (y la carpeta spam).',
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('Error', { description: msg })
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
          <h1 className="text-3xl tracking-tight">Olvidaste tu contraseña</h1>
          <p className="text-fg-muted">
            Te enviamos un código de 6 dígitos al email que usaste para registrarte. Tendrás 15 minutos para usarlo.
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
              placeholder="diego@ejemplo.com"
            />
            {errors.email && (
              <p className="text-[12px] text-red-400">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {isSubmitting ? 'Enviando…' : 'Enviar código'}
          </button>
          {enviado && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/reset-password?email=${encodeURIComponent(getValues('email') || '')}`,
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
            >
              Ya tengo el código
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          ¿Lo recordaste?{' '}
          <Link
            to="/login"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Volver a Login
          </Link>
        </p>
      </motion.div>
    </section>
  )
}

export default ForgotPasswordPage
