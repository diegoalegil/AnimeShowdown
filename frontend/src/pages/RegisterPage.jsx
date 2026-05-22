import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { z } from 'zod'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import PasswordInput from '../components/PasswordInput'
import AuthSocialButtons from '../components/AuthSocialButtons'
import AuthLegalNote from '../components/AuthLegalNote'
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

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Mínimo 3 caracteres')
      .max(30, 'Máximo 30 caracteres')
      .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guion y guion bajo'),
    email: z
      .string()
      .trim()
      .regex(/^\S+@\S+\.\S+$/, 'El email no es válido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(100, 'Máximo 100 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/\d/, 'Debe incluir al menos un número'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
    referralCode: z
      .string()
      .max(16, 'El código es demasiado largo')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.confirmPassword === data.password, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  })

function zodFormResolver(schema) {
  return async (values) => {
    const parsed = schema.safeParse(values)
    if (parsed.success) {
      return { values: parsed.data, errors: {} }
    }
    const errors = {}
    for (const issue of parsed.error.issues) {
      const name = issue.path[0]
      if (!name || errors[name]) continue
      errors[name] = {
        type: issue.code,
        message: issue.message,
      }
    }
    return { values: {}, errors }
  }
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
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    defaultValues: { referralCode: refDeQuery },
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: zodFormResolver(registerSchema),
    shouldFocusError: true,
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
      visual={BRAND_VISUALS.authRegister} lateralKanji={{left: "新", right: "生"}}
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
        <AuthLegalNote action="crear tu cuenta" />
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
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
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.username ? 'border-red-500' : 'border-border'
              }`}
              placeholder="Elige un nombre de usuario"
            />
            {errors.username && (
              <p id="username-error" className="text-[12px] text-red-400">
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
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
              className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                errors.email ? 'border-red-500' : 'border-border'
              }`}
              placeholder="tu@correo.com"
            />
            {errors.email && (
              <p id="email-error" className="text-[12px] text-red-400">{errors.email.message}</p>
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
              placeholder="Mínimo 8, con mayúscula y número"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" className="text-[12px] text-red-400">
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
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p id="confirmPassword-error" className="text-[12px] text-red-400">
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
              aria-invalid={Boolean(errors.referralCode)}
              aria-describedby={errors.referralCode ? 'referralCode-error' : undefined}
              {...register('referralCode')}
              className="rounded-lg border border-border bg-bg px-3.5 py-2.5 font-mono text-sm tracking-[0.18em] text-fg-strong uppercase placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Si un amigo te invitó…"
            />
            {errors.referralCode && (
              <p id="referralCode-error" className="text-[12px] text-red-400">
                {errors.referralCode.message}
              </p>
            )}
          </div>
          {errors.root && (
            <p className="text-[12px] text-red-400">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
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
