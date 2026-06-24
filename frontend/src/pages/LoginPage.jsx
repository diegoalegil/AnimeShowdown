import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import DojoLogin from '../features/auth/DojoLogin'
import { DOJO_SCENES, sanitizeNext } from '../features/auth/dojo-login-data'

/**
 * /login — la entrada al dojo (DojoLogin): noren que se recoge, botón-
 * sello 印 y la escena del día del banco de marca. Esta página conserva
 * el flujo: next anti open-redirect, toast de error OAuth y el paso 2FA
 * (Step2Totp) que se monta en lugar del dojo cuando el backend pide TOTP.
 */
function LoginPage() {
  useSeo({
    title: 'Iniciar sesión',
    description:
      'Entra en tu cuenta AnimeShowdown para votar, predecir torneos y mantener tu perfil público con ranking ELO personalizado.',
    noindex: true,
  })
  const { login, completeLogin2fa } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextSeguro = sanitizeNext(params.get('next'))
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

  const handleLogin = async (identificador, password) => {
    const res = await login(identificador, password)
    if (res?.requires2fa) {
      setPendingChallenge(res)
    } else {
      navigate(nextSeguro)
    }
  }

  if (pendingChallenge) {
    return (
      <section className="flex min-h-[calc(100vh-6rem)] items-center px-5 py-12 sm:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <Step2Totp
            challenge={pendingChallenge}
            onSuccess={() => navigate(nextSeguro)}
            onCancel={() => setPendingChallenge(null)}
            completeLogin2fa={completeLogin2fa}
          />
        </div>
      </section>
    )
  }

  return <DojoLogin onLogin={handleLogin} scenes={DOJO_SCENES} />
}

function Step2Totp({ challenge, onSuccess, onCancel, completeLogin2fa }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()
  const [cancelDelayTick, setCancelDelayTick] = useState(0)

  useEffect(() => {
    if (cancelDelayTick === 0) return undefined
    const id = setTimeout(onCancel, 1500)
    return () => clearTimeout(id)
  }, [cancelDelayTick, onCancel])

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
        setCancelDelayTick((tick) => tick + 1)
      }
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3.5 py-1.5 text-[12px] font-semibold text-success">
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
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
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
            className={`rounded-lg border bg-bg px-3.5 py-3 text-center font-mono text-2xl text-fg-strong placeholder:text-fg-muted/40 focus:outline-none focus:ring-2 focus:ring-gold ${
              errors.codigo ? 'border-danger' : 'border-border'
            }`}
            placeholder="123456 o ABCD-EFGHJK"
          />
          {errors.codigo && (
            <p id="codigo-error" className="text-[12px] text-danger">
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
            <span className={segundos <= 10 ? 'font-bold text-danger' : 'font-bold text-fg-strong'}>
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
