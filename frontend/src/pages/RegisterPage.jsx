import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import ScribeFieldRhf from '../components/scribe/ScribeFieldRhf'
import AuthSocialButtons from '../components/AuthSocialButtons'
import AuthLegalNote from '../components/AuthLegalNote'
// Import ESTÁTICO a propósito: el rito es el primer momento-recompensa de la
// cuenta y los flujos de recompensa no van detrás de un import() dinámico
// (un chunk lento o caído lo rompería). Esta página ya es una ruta lazy.
import InitiationRite from '../components/InitiationRite'
import { markInitiationRiteSeen, shouldRunInitiationRite } from '../lib/initiationRite'

// El funnel puede llegar con ?next= (p.ej. desde una superficie que pide
// cuenta). Solo rutas relativas propias: mismo criterio que el next del
// flujo OAuth en AuthSocialButtons.
function sanitizeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const containerVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
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
      // Mismo contrato que el backend (RegistroRequest.java): al menos una
      // letra y un dígito. Antes exigía mayúscula → bloqueaba passwords que el
      // servidor sí acepta, e incoherente con ResetPasswordPage.
      .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/, 'Debe incluir al menos una letra y un número'),
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
    noindex: true,
  })
  const prefersReducedMotion = useReducedMotion()
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refDeQuery = searchParams.get('ref') ?? ''
  const next = sanitizeNext(searchParams.get('next'))
  // Username recién registrado mientras corre el rito de acuñación; el
  // propio rito navega al terminar.
  const [acunando, setAcunando] = useState(null)
  const {
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      referralCode: refDeQuery,
    },
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
      // Rito de iniciación one-shot. Con reduced-motion no se monta la
      // ceremonia: bienvenida por toast y navegación directa, cero animación.
      if (prefersReducedMotion || !shouldRunInitiationRite()) {
        if (prefersReducedMotion) {
          markInitiationRiteSeen()
          toast.success(`Bienvenido, ${data.username}`, {
            description: 'Tu placa de luchador quedó acuñada.',
          })
        }
        navigate(next)
      } else {
        setAcunando(data.username)
      }
    } catch (err) {
      setError('root', {
        message:
          err?.status === 409
            ? 'Ese usuario o email ya está registrado. Prueba con otros datos o inicia sesión.'
            : err?.message || 'No se pudo crear la cuenta. Intenta de nuevo.',
      })
    }
  }

  return (
    // Full-bleed con el arte premium del banco (mismo patrón que los
    // juegos): el altar de cartas doradas ocupa la mitad derecha del arte,
    // así que el formulario vive a la izquierda sobre la zona oscura,
    // dentro de un panel de cristal para asegurar contraste.
    <section className="as-stage as-stage-visual as-stage-auth-register flex min-h-[calc(100vh-6rem)] items-center px-5 py-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl justify-center lg:justify-start">
      <motion.div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-bg/80 p-6 shadow-2xl backdrop-blur-md sm:p-8"
        initial="hidden"
        animate="visible"
        variants={prefersReducedMotion ? containerVariantsReduced : containerVariants}
      >
        <div className="mb-6 flex flex-col items-start gap-2">
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-fg-muted">
            Nueva cuenta
          </span>
          <h1 className="text-3xl tracking-tight">Únete a AnimeShowdown</h1>
          <p className="text-fg-muted">
            Crea torneos, sigue a tus personajes favoritos y compite en
            el ranking. Tu nombre de usuario aparece junto a tus votos.
          </p>
        </div>
        <AuthSocialButtons action="Crear cuenta" next={next} />
        <AuthLegalNote action="crear tu cuenta" />
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
        >
          {/* Campos del kit del escriba: label flotante (sobrevive al
              autofill vía CSS), trazo de tinta al foco, error con tremor y
              aria-describedby propios, ojo de revelar + aviso de Bloq Mayús
              en las contraseñas. La validación no cambia: resolver zod del
              form, mode onBlur. */}
          <ScribeFieldRhf
            control={control}
            name="username"
            id="username"
            label="Nombre de usuario"
            autoComplete="username"
            required
            hint="Letras, números, guion y guion bajo"
          />
          <ScribeFieldRhf
            control={control}
            name="email"
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            hint="Lo usaremos para recuperar tu cuenta"
          />
          <div className="flex flex-col gap-1.5">
            <ScribeFieldRhf
              control={control}
              name="password"
              id="password"
              type="password"
              label="Contraseña"
              autoComplete="new-password"
              required
              hint="Mínimo 8, con letra y número"
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <ScribeFieldRhf
            control={control}
            name="confirmPassword"
            id="confirmPassword"
            type="password"
            label="Confirma la contraseña"
            autoComplete="new-password"
            required
          />
          <ScribeFieldRhf
            control={control}
            name="referralCode"
            id="referralCode"
            label="Código de referral (opcional)"
            autoComplete="off"
            maxLength={16}
            hint="Si un amigo te invitó…"
          />
          {errors.root && (
            <p role="alert" className="text-[12px] text-danger">{errors.root.message}</p>
          )}
          {/* Antes: disabled={isSubmitting || !isValid}. El !isValid bloqueaba
              el submit hasta que react-hook-form considerara el form válido,
              pero con mode:'onBlur' isValid arranca en false y solo pasa a
              true tras el primer blur. Los e2e (y usuarios rápidos que pegan
              datos y clickean) llegaban al botón sin haber disparado blur en
              el último campo → botón siempre disabled → submit imposible.
              handleSubmit() ya valida internamente antes de invocar onSubmit
              y dispara los inline errors si algo falla, así que mantener el
              botón habilitado siempre (salvo durante envío) no pierde UX y
              destraba el flujo "fill + click directo". */}
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
            className="font-semibold text-gold hover:text-gold"
          >
            Inicia sesión
          </Link>
        </p>
      </motion.div>
      </div>

      {acunando && <InitiationRite username={acunando} to={next} />}
    </section>
  )
}

export default RegisterPage
