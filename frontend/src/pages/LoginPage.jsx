import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
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

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } },
}

const containerVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
}

const stepVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

function LoginPage() {
  useSeo({
    title: 'Iniciar sesión',
    description:
      'Entra en tu cuenta AnimeShowdown para votar, predecir torneos y mantener tu perfil público con ranking ELO personalizado.',
    noindex: true,
  })
  const prefersReducedMotion = useReducedMotion()
  const { login, completeLogin2fa } = useAuth()
  const navigate = useNavigate()
  // Rutas protegidas (CrearTorneoPage, etc.)
  // redirigían a /login?next=... pero LoginPage navegaba siempre a /
  // tras éxito. Honramos el next si está presente Y es relativo —
  // negar absolutas/protocol-relative evita open-redirect.
  const [params] = useSearchParams()
  const rawNext = params.get('next')
  const nextSeguro =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/'
  const oauthError = params.get('oauth') === 'error'

  useEffect(() => {
    if (oauthError) {
      toast.error('No se pudo entrar con el proveedor externo', {
        description: 'Prueba otra vez o continúa con email.',
      })
    }
  }, [oauthError])

  // Si está seteado: el paso 1 fue OK pero el backend pide TOTP.
  // {challengeToken, expiraEnSegundos, identificador}.
  const [pendingChallenge, setPendingChallenge] = useState(null)

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.authLogin} lateralKanji={{left: "入", right: "門"}}
      className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
      contentClassName="w-full max-w-md"
    >
      <motion.div
        className="w-full"
        initial="hidden"
        animate="visible"
        variants={prefersReducedMotion ? containerVariantsReduced : containerVariants}
      >
        <AnimatePresence mode="wait">
          {pendingChallenge ? (
            <motion.div
              key="step2"
              variants={prefersReducedMotion ? stepVariantsReduced : stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Step2Totp
                challenge={pendingChallenge}
                onSuccess={() => navigate(nextSeguro)}
                onCancel={() => setPendingChallenge(null)}
                completeLogin2fa={completeLogin2fa}
              />
            </motion.div>
          ) : (
            <motion.div
              key="step1"
              variants={prefersReducedMotion ? stepVariantsReduced : stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Step1Credenciales
                login={login}
                onChallenge={setPendingChallenge}
                onSuccess={() => navigate(nextSeguro)}
                next={nextSeguro}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </VisualPageShell>
  )
}

function Step1Credenciales({ login, onChallenge, onSuccess, next }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      const res = await login(data.identificador, data.password)
      if (res?.requires2fa) {
        onChallenge(res)
      } else {
        onSuccess()
      }
    } catch (err) {
      const status = err?.status
      setError('root', {
        message:
          status === 401
            ? 'Credenciales inválidas. Revisa tu username/email y contraseña.'
            : status === 429
              ? 'Demasiados intentos. Espera unos segundos antes de probar otra vez.'
              : err?.message || 'No se pudo iniciar sesión. Intenta de nuevo.',
      })
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start gap-2">
        <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
          Acceso
        </span>
        <h1 className="text-3xl tracking-tight">Inicia sesión</h1>
        <p className="text-fg-muted">
          Vuelve a tu roster, sigue votando y mantén tu racha. Puedes
          entrar con tu nombre de usuario o con tu email.
        </p>
      </div>
      <AuthSocialButtons next={next} />
      <AuthLegalNote action="entrar" />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
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
            aria-invalid={Boolean(errors.identificador)}
            aria-describedby={
              errors.identificador ? 'identificador-error' : undefined
            }
            {...register('identificador', {
              required: 'Introduce tu username o email',
              minLength: { value: 3, message: 'Mínimo 3 caracteres' },
            })}
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.identificador ? 'border-red-500' : 'border-border'
            }`}
            placeholder="Tu username o tu email"
          />
          {errors.identificador && (
            <p id="identificador-error" className="text-[12px] text-red-400">
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
          <PasswordInput
            id="password"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            placeholder="Tu contraseña"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password', {
              required: 'Introduce tu contraseña',
              minLength: { value: 6, message: 'Mínimo 6 caracteres' },
            })}
          />
          {errors.password && (
            <p id="login-password-error" className="text-[12px] text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>
        {errors.root && (
          <p role="alert" className="text-[12px] text-red-400">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
        <Link
          to="/forgot-password"
          className="self-end text-[12px] font-medium text-fg-muted transition-colors hover:text-gold"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
      <p className="mt-4 text-center text-[13px] text-fg-muted">
        ¿No tienes cuenta?{' '}
        <Link
          to="/register"
          className="font-semibold text-gold hover:text-gold"
        >
          Crea una
        </Link>
      </p>
    </>
  )
}

function Step2Totp({ challenge, onSuccess, onCancel, completeLogin2fa }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  // Countdown del challenge. Cuando llega a 0 forzamos volver al paso 1.
  const [segundos, setSegundos] = useState(challenge.expiraEnSegundos || 60)
  useEffect(() => {
    if (segundos <= 0) {
      onCancel()
      return
    }
    const id = setTimeout(() => setSegundos((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [segundos, onCancel])

  const onSubmit = async (data) => {
    try {
      const codigo = (data.codigo || '').replace(/\s+/g, '')
      await completeLogin2fa(challenge.challengeToken, codigo, challenge.identificador)
      onSuccess()
    } catch (err) {
      const intentosRestantes = err?.body?.intentosRestantes
      const msg =
        intentosRestantes === 0
          ? 'Demasiados intentos. Vuelve a empezar.'
          : intentosRestantes !== undefined
            ? `Código incorrecto. Te quedan ${intentosRestantes} intentos.`
            : 'Código incorrecto.'
      setError('codigo', { message: msg })
      if (intentosRestantes === 0) {
        // El backend ya invalidó el challenge, no tiene sentido seguir aquí.
        setTimeout(onCancel, 1500)
      }
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verificación en dos pasos
        </span>
        <h1 className="text-3xl tracking-tight">Introduce el código</h1>
        <p className="text-fg-muted">
          Abre tu app authenticator (Google Authenticator, Authy, 1Password…) y copia
          el código de 6 dígitos para <strong>{challenge.identificador}</strong>.
        </p>
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="codigo"
            className="text-[13px] font-medium text-fg-strong"
          >
            Código TOTP o código de recuperación
          </label>
          {/* El campo acepta TOTP y backup codes alfanuméricos. Por eso no
              usamos inputMode numeric ni pattern de solo dígitos; la
              validación final de formato la hace el backend. */}
          <input
            id="codigo"
            type="text"
            inputMode="text"
            autoFocus
            autoComplete="one-time-code"
            maxLength={12}
            aria-invalid={Boolean(errors.codigo)}
            aria-describedby={
              errors.codigo ? 'codigo-error codigo-help' : 'codigo-help'
            }
            {...register('codigo', {
              required: 'Introduce el código',
              minLength: { value: 6, message: 'Mínimo 6 caracteres' },
            })}
            className={`rounded-lg border bg-bg px-3.5 py-3 text-center font-mono text-2xl tracking-[0.4em] text-fg-strong placeholder:text-fg-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.codigo ? 'border-red-500' : 'border-border'
            }`}
            placeholder="123456 o ABCD-EFGHJK"
          />
          {errors.codigo && (
            <p id="codigo-error" className="text-[12px] text-red-400">
              {errors.codigo.message}
            </p>
          )}
          <p id="codigo-help" className="text-[11px] text-fg-muted">
            Usa el código de 6 dígitos de tu app TOTP, o uno de tus códigos de
            recuperación de 10 caracteres si perdiste el teléfono.
          </p>
        </div>
        <div className="flex items-center justify-between text-[12px] text-fg-muted">
          <span>
            Caduca en{' '}
            <span className={segundos <= 10 ? 'font-bold text-rose-400' : 'font-bold text-fg-strong'}>
              {segundos}s
            </span>
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="font-medium text-fg-muted transition-colors hover:text-gold"
          >
            Cancelar
          </button>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Verificando…' : 'Verificar'}
        </button>
      </form>
    </>
  )
}

export default LoginPage
