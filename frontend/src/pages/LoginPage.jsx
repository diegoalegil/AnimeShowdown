import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'

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

function LoginPage() {
  useSeo({
    title: 'Iniciar sesión',
    description:
      'Entra en tu cuenta AnimeShowdown para votar, predecir torneos y mantener tu perfil público con ranking ELO personalizado.',
  })
  const { login, completeLogin2fa } = useAuth()
  const navigate = useNavigate()
  // Audit P2 (2026-05-17): rutas protegidas (CrearTorneoPage, etc.)
  // redirigían a /login?next=... pero LoginPage navegaba siempre a /
  // tras éxito. Honramos el next si está presente Y es relativo —
  // negar absolutas/protocol-relative evita open-redirect.
  const [params] = useSearchParams()
  const rawNext = params.get('next')
  const nextSeguro =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/'

  // Si está seteado: el paso 1 fue OK pero el backend pide TOTP.
  // {challengeToken, expiraEnSegundos, identificador}.
  const [pendingChallenge, setPendingChallenge] = useState(null)

  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8 sm:py-20">
      <motion.div
        className="w-full max-w-md"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <AnimatePresence mode="wait">
          {pendingChallenge ? (
            <motion.div
              key="step2"
              variants={stepVariants}
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
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Step1Credenciales
                login={login}
                onChallenge={setPendingChallenge}
                onSuccess={() => navigate(nextSeguro)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}

function Step1Credenciales({ login, onChallenge, onSuccess }) {
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
    } catch {
      setError('root', {
        message: 'No se pudo iniciar sesión. Intenta de nuevo.',
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
            placeholder="Tu username o tu email"
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
            placeholder="Tu contraseña"
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
            Código de 6 dígitos
          </label>
          <input
            id="codigo"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            autoComplete="one-time-code"
            maxLength={11}
            {...register('codigo', {
              required: 'Introduce el código',
              minLength: { value: 6, message: 'Mínimo 6 caracteres' },
            })}
            className={`rounded-lg border bg-bg px-3.5 py-3 text-center font-mono text-2xl tracking-[0.4em] text-fg-strong placeholder:text-fg-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.codigo ? 'border-red-500' : 'border-border'
            }`}
            placeholder="123 456"
          />
          {errors.codigo && (
            <p className="text-[12px] text-red-400">{errors.codigo.message}</p>
          )}
          <p className="text-[11px] text-fg-muted">
            ¿No tienes la app a mano? Usa uno de tus códigos de recuperación de 10
            caracteres.
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
            className="font-medium text-fg-muted transition-colors hover:text-accent"
          >
            Cancelar
          </button>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Verificando…' : 'Verificar'}
        </button>
      </form>
    </>
  )
}

export default LoginPage
