import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, Mail } from 'lucide-react'
import FlowSeal from '../components/FlowSeal'
import KeyLantern from '../components/KeyLantern'
import { useSeo } from '../hooks/useSeo'
import { endpoints, ApiError } from '../lib/api'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function ForgotPasswordPage() {
  useSeo({ title: 'Recuperar contraseña', noindex: true })
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
    <VisualPageShell
      visual={BRAND_VISUALS.authLogin} lateralKanji={{left: "忘", right: "記"}}
      className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
      contentClassName="w-full max-w-md"
    >
      <motion.div
        className="w-full"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Emblema KeyLantern: prende cuando el código se ha enviado.
            100% decorativo (aria-hidden); el estado se anuncia por el
            aria-live de más abajo. */}
        <div className="mb-4 flex justify-center">
          <KeyLantern state={enviado ? 'lit' : 'unlit'} />
        </div>
        <div className="mb-6 flex flex-col items-start gap-2">
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-fg-muted">
            Recuperar acceso
          </span>
          <h1 className="text-3xl tracking-tight">¿Olvidaste tu contraseña?</h1>
          <p className="text-fg-muted">
            Te enviamos un código de 6 dígitos al email que usaste para registrarte. Tendrás 15 minutos para usarlo.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
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
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'forgot-email-error' : undefined}
              {...register('email', {
                required: 'Introduce tu email',
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: 'El email no es válido',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold ${
                errors.email ? 'border-danger' : 'border-border'
              }`}
              placeholder="tu@correo.com"
            />
            {errors.email && (
              <p id="forgot-email-error" className="text-[12px] text-danger">
                {errors.email.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || enviado}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {isSubmitting ? 'Enviando…' : 'Enviar código'}
          </button>
          {/* Confirmación persistente: el toast desaparece pero el usuario
              sigue necesitando saber que el email fue enviado mientras
              decide navegar al formulario de código. */}
          <div aria-live="polite" aria-atomic="true">
            {enviado && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-bg/50 px-4 py-3">
                {/* Lacre 送 (envío): el sello del sobre se parte y la carta asoma. */}
                <FlowSeal variant="enviado" size={180} />
                <p className="text-[13px] text-success">
                  Código enviado. Revisa tu bandeja de entrada (y la carpeta spam).
                </p>
              </div>
            )}
          </div>
          {enviado && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/reset-password?email=${encodeURIComponent(getValues('email') || '')}`,
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
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
            className="font-semibold text-gold hover:text-gold"
          >
            Volver a inicio de sesión
          </Link>
        </p>
      </motion.div>
    </VisualPageShell>
  )
}

export default ForgotPasswordPage
