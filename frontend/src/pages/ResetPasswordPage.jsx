import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { endpoints, ApiError } from '../lib/api'
import { useSound } from '../contexts/SoundContext'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import PasswordInput from '../components/PasswordInput'
import KeyLantern from '../components/KeyLantern'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

// Ventana antes de navegar a /login: 650ms = el giro de llave (450ms, ver
// key-lantern.css) + ~200ms de margen para que se asiente.
const KEY_TURN_REVEAL_MS = 650

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
  const { play } = useSound()
  const prefersReducedMotion = useReducedMotion()
  // Éxito local: prende la linterna y gira la llave una vez antes del redirect.
  const [confirmado, setConfirmado] = useState(false)
  const redirectTimer = useRef(null)
  // Cancela el redirect diferido si el usuario navega antes (back / "Solicitar
  // otro"): si no, el setTimeout dispararía navigate('/login') sobre el
  // componente desmontado, secuestrando la navegación que el usuario eligió.
  useEffect(
    () => () => {
      if (redirectTimer.current) window.clearTimeout(redirectTimer.current)
    },
    [],
  )
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
      // Ceremonia de cierre: la llave gira en la cerradura con su click
      // metálico (el sonido lo dispara la página, no el componente).
      setConfirmado(true)
      play('playClick')
      if (prefersReducedMotion) {
        navigate('/login')
      } else {
        redirectTimer.current = window.setTimeout(() => navigate('/login'), KEY_TURN_REVEAL_MS)
      }
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
    <VisualPageShell
      visual={BRAND_VISUALS.authLogin} lateralKanji={{left: "更", right: "新"}}
      className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
      contentClassName="w-full max-w-md"
    >
      <motion.div
        className="w-full"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Emblema KeyLantern: al confirmar el reset la linterna prende y la
            llave gira en la cerradura. 100% decorativo (aria-hidden); el
            éxito/fallo lo anuncian el toast y el role="alert" de root. */}
        <div className="mb-4 flex justify-center">
          <KeyLantern state={confirmado ? 'lit' : 'unlit'} keyTurned={confirmado} />
        </div>
        <div className="mb-6 flex flex-col items-start gap-2">
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-fg-muted">
            Recuperar acceso
          </span>
          <h1 className="text-3xl tracking-tight">Define tu nueva contraseña</h1>
          <p className="text-fg-muted">
            Introduce el código de 6 dígitos que te llegó por email. Tienes 15 minutos desde que lo solicitaste.
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
              aria-describedby={errors.email ? 'reset-email-error' : undefined}
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
              <p id="reset-email-error" className="text-[12px] text-danger">
                {errors.email.message}
              </p>
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
              aria-invalid={Boolean(errors.codigo)}
              aria-describedby={
                errors.codigo ? 'reset-codigo-help reset-codigo-error' : 'reset-codigo-help'
              }
              {...register('codigo', {
                required: 'Introduce el código',
                pattern: {
                  value: /^\d{6}$/,
                  message: 'Tienen que ser 6 dígitos',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-center font-mono text-xl text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold ${
                errors.codigo ? 'border-danger' : 'border-border'
              }`}
              placeholder="000000"
            />
            {errors.codigo && (
              <p id="reset-codigo-error" className="text-[12px] text-danger">
                {errors.codigo.message}
              </p>
            )}
            <p id="reset-codigo-help" className="text-[11px] text-fg-muted">
              Usa exactamente los 6 dígitos del email de recuperación.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="newPassword"
              className="text-[13px] font-medium text-fg-strong"
            >
              Nueva contraseña
            </label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              error={Boolean(errors.newPassword)}
              placeholder="••••••••"
              aria-invalid={Boolean(errors.newPassword)}
              aria-describedby={
                errors.newPassword
                  ? 'reset-new-password-help reset-new-password-error'
                  : 'reset-new-password-help'
              }
              {...register('newPassword', {
                required: 'Introduce una contraseña',
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                pattern: {
                  value: /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/,
                  message: 'Debe incluir al menos una letra y un número',
                },
              })}
            />
            {errors.newPassword && (
              <p id="reset-new-password-error" className="text-[12px] text-danger">
                {errors.newPassword.message}
              </p>
            )}
            <p id="reset-new-password-help" className="text-[11px] text-fg-muted">
              Mínimo 8 caracteres, con al menos una letra y un número.
            </p>
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-[13px] font-medium text-fg-strong"
            >
              Confirma la nueva contraseña
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              error={Boolean(errors.confirmPassword)}
              placeholder="••••••••"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword ? 'reset-confirm-password-error' : undefined
              }
              {...register('confirmPassword', {
                required: 'Confirma tu contraseña',
                validate: (value) =>
                  value === password || 'Las contraseñas no coinciden',
              })}
            />
            {errors.confirmPassword && (
              <p id="reset-confirm-password-error" className="text-[12px] text-danger">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          {errors.root && (
            <p role="alert" className="text-[12px] text-danger">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || confirmado}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {isSubmitting || confirmado ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          ¿No te llegó el código?{' '}
          <Link
            to="/forgot-password"
            className="font-semibold text-gold hover:text-gold"
          >
            Solicitar otro
          </Link>
        </p>
      </motion.div>
    </VisualPageShell>
  )
}

export default ResetPasswordPage
