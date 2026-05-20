import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import PasswordInput from '../components/PasswordInput'
import AuthSocialButtons from '../components/AuthSocialButtons'
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

function RegisterPage() {
  useSeo({
    title: 'Crear cuenta',
    description:
      'Crea tu cuenta gratuita en AnimeShowdown. Vota, predice torneos, crea tu propio bracket y construye tu perfil público.',
  })
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refDeQuery = searchParams.get('ref') ?? ''
  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { referralCode: refDeQuery },
  })

  // Si la query string cambia (rare in this page) re-aplicamos el código
  // para que el campo siempre refleje ?ref=XXX cuando el usuario llega
  // desde un enlace compartido por otro.
  useEffect(() => {
    if (refDeQuery) setValue('referralCode', refDeQuery)
  }, [refDeQuery, setValue])

  const password = watch('password')

  const onSubmit = async (data) => {
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        referralCode: data.referralCode || undefined,
      })
      navigate('/')
    } catch {
      setError('root', {
        message: 'No se pudo crear la cuenta. Intenta de nuevo.',
      })
    }
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.authRegister}
      className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
      contentClassName="w-full max-w-md"
    >
      <motion.div
        className="w-full"
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
            Crea torneos, sigue a tus personajes favoritos y compite en
            el ranking. Tu nombre de usuario aparece junto a tus votos.
          </p>
        </div>
        <AuthSocialButtons action="Crear cuenta" next="/" />
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-[13px] font-medium text-fg-strong"
            >
              Nombre de usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              {...register('username', {
                required: 'Elige un username',
                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                maxLength: { value: 30, message: 'Máximo 30 caracteres' },
                // Audit P3 (2026-05-17): alineado con el @Pattern del
                // backend (RegistroRequest). Antes el frontend permitía
                // punto en el username pero el backend lo rechazaba con
                // 400, dejando un mensaje de error desconcertante en
                // el wizard.
                pattern: {
                  value: /^[A-Za-z0-9_-]+$/,
                  message: 'Solo letras, números, guion y guion bajo',
                },
              })}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.username ? 'border-red-500' : 'border-border'
              }`}
              placeholder="Elige un nombre de usuario"
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
              placeholder="tu@correo.com"
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
            <PasswordInput
              id="password"
              autoComplete="new-password"
              error={Boolean(errors.password)}
              placeholder="Mínimo 8, con letra y número"
              {...register('password', {
                required: 'Introduce una contraseña',
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                pattern: {
                  value: /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/,
                  message: 'Debe incluir al menos una letra y un número',
                },
              })}
            />
            {errors.password && (
              <p className="text-[12px] text-red-400">
                {errors.password.message}
              </p>
            )}
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-[13px] font-medium text-fg-strong"
            >
              Confirma la contraseña
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              error={Boolean(errors.confirmPassword)}
              placeholder="Repite tu contraseña"
              {...register('confirmPassword', {
                required: 'Confirma tu contraseña',
                validate: (value) =>
                  value === password || 'Las contraseñas no coinciden',
              })}
            />
            {errors.confirmPassword && (
              <p className="text-[12px] text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="referralCode"
              className="text-[13px] font-medium text-fg-strong"
            >
              Código de referral{' '}
              <span className="text-[11px] font-normal text-fg-muted">
                (opcional)
              </span>
            </label>
            <input
              id="referralCode"
              type="text"
              autoComplete="off"
              maxLength={16}
              {...register('referralCode', {
                maxLength: {
                  value: 16,
                  message: 'El código es demasiado largo',
                },
              })}
              className="rounded-lg border border-border bg-bg px-3.5 py-2.5 font-mono text-sm tracking-[0.18em] text-fg-strong uppercase placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Si un amigo te invitó…"
            />
            {errors.referralCode && (
              <p className="text-[12px] text-red-400">
                {errors.referralCode.message}
              </p>
            )}
          </div>
          {errors.root && (
            <p className="text-[12px] text-red-400">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
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
    </VisualPageShell>
  )
}

export default RegisterPage
