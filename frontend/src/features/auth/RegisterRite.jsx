import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import PasswordInput from '../../components/PasswordInput'
import AuthSocialButtons from '../../components/AuthSocialButtons'
import AuthLegalNote from '../../components/AuthLegalNote'
import './register-rite.css'

// Estilos: register-rite.css (colocado, importado aquí — mismo patrón que
// dojo-login.css). CSP por hash: cero <style> en runtime; todos los
// keyframes viven en ese stylesheet, token-only.

/* ------------------------------------------------------------------ */
/* Validación: EL MISMO schema y resolver de RegisterPage, sin cambios. */
/* ------------------------------------------------------------------ */

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
      // letra y un dígito. Coherente con ResetPasswordPage.
      .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/, 'Debe incluir al menos una letra y un número'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
    referralCode: z.string().max(16, 'El código es demasiado largo').optional().or(z.literal('')),
  })
  .refine((data) => data.confirmPassword === data.password, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  })

function zodFormResolver(schema) {
  return async (values) => {
    const parsed = schema.safeParse(values)
    if (parsed.success) return { values: parsed.data, errors: {} }
    const errors = {}
    for (const issue of parsed.error.issues) {
      const name = issue.path[0]
      if (!name || errors[name]) continue
      errors[name] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }
}

/* ------------------------------------------------------------------ */
/* Tinta del tintero: 4 niveles por tokens (accent/gold/gold-bright/    */
/* success). Heurística local; si PasswordStrengthMeter ya puntúa,      */
/* pásale su score vía prop `nivelTinta` para no duplicar criterio.     */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line react-refresh/only-export-components
export function nivelTintaDefault(pw) {
  if (!pw) return 0
  let n = 0
  if (pw.length >= 8) n += 1
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) n += 1
  if (pw.length >= 12) n += 1
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) n += 1
  return Math.max(1, n)
}
const TINTA_ROMANO = ['0', 'I', 'II', 'III', 'IV']
const TINTA_LABEL = {
  0: 'el tintero espera',
  1: 'aguada — sigue',
  2: 'trazo justo',
  3: 'trazo firme',
  4: 'tinta de hierro',
}

/**
 * El rito de ingreso — /register.
 *
 * Tres pasos en una pantalla con una cuerda shimenawa como progreso:
 * 壱 nombre de guerrero · 弐 correo y llave · 参 juramento (sello 誓).
 * Hermano mayor de DojoLogin: mismo vocabulario (corte de tinta, hanko,
 * tablillas), mismos tokens, cero libs nuevas.
 *
 * @param {Object} props
 * @param {(data: {username: string, email: string, password: string, referralCode?: string}) => Promise<void>} props.onRegister
 *        AuthContext.register. Rechazos esperados:
 *        - err.status === 409 → usuario/email ocupado. Contrato opcional del
 *          backend (NO se inventa aquí): err.body.campo ('username'|'email')
 *          señala el shide que tiembla; sin campo se asume username con el
 *          copy combinado actual. err.body.sugerencias (string[]) pinta los
 *          chips de alternativas SOLO si el backend las da.
 *        - otros status → error genérico; sin status → error de red.
 * @param {(username: string) => void} props.onSuccess
 *        El caller decide el post-alta (InitiationRite + navigate(next)),
 *        exactamente como hoy en RegisterPage.
 * @param {string} [props.next='/'] Ruta post-alta YA saneada con el
 *        sanitizeNext compartido con el dojo (anti open-redirect). Se pasa
 *        tal cual a AuthSocialButtons para que OAuth conserve el mismo next.
 * @param {string} [props.refCode=''] Código de ?ref= (prefill del referral).
 * @param {(pw: string) => number} [props.nivelTinta=nivelTintaDefault]
 *        Score 0-4 del medidor; inyectable desde PasswordStrengthMeter.
 * @param {(fase: 'sello'|'tremor'|'corte'|'envio'|'alta') => void} [props.onPhase]
 *        Punto de integración de sonido (lib/sounds.js bajo SoundContext y
 *        el mute global). Sugerido: sello→playVerdictStamp, alta→playMagic.
 */
function RegisterRite({
  onRegister,
  onSuccess,
  next = '/',
  refCode = '',
  nivelTinta = nivelTintaDefault,
  onPhase,
}) {
  const prefersReducedMotion = useReducedMotion()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', email: '', password: '', confirmPassword: '', referralCode: refCode },
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: zodFormResolver(registerSchema),
    shouldFocusError: true,
  })

  // Fases de entrada — inicializadores PUROS (StrictMode monta doble) y
  // cero setState síncrono en el cuerpo de los effects (React Compiler).
  const [riteIn, setRiteIn] = useState(false)
  const [oath, setOath] = useState(false)
  const [oathError, setOathError] = useState(null)
  const [capsOn, setCapsOn] = useState(false) // aviso de Bloq Mayús en contraseña (igual que DojoLogin)
  // {campo:'username'|'email', titulo, cuerpo, sugerencias|null}
  const [serverError, setServerError] = useState(null)
  const [rootError, setRootError] = useState(null)
  const [attempt, setAttempt] = useState(0) // re-key del corte de tinta
  const [tremor, setTremor] = useState({ 1: null, 2: null, 3: null }) // 'a'|'b'|null
  const [armed, setArmed] = useState(false)
  const [refOpen, setRefOpen] = useState(() => Boolean(refCode))
  const oathRef = useRef(null)

  useEffect(() => {
    const ids = [
      setTimeout(() => setRiteIn(true), 30),
      setTimeout(() => setFocus('username'), prefersReducedMotion ? 80 : 700),
    ]
    return () => ids.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* validez viva por paso (solo para encender shide; los mensajes los sigue
     gobernando react-hook-form con el MISMO schema y mode:'onBlur') */
  const valores = watch()
  const vivos = useMemo(() => {
    const parsed = registerSchema.safeParse(valores)
    if (parsed.success) return {}
    const map = {}
    for (const issue of parsed.error.issues) {
      const name = issue.path[0]
      if (name) map[name] = true
    }
    return map
  }, [valores])

  const lit1 = !vivos.username && !(serverError && serverError.campo === 'username')
  const lit2 =
    !vivos.email && !vivos.password && !vivos.confirmPassword && !(serverError && serverError.campo === 'email')
  const lit3 = oath
  const ready = lit1 && lit2 && lit3 && !vivos.referralCode

  /* lacado del botón: 200ms de transición con 240ms de retardo (el impacto
     del rr-stamp cae en su 62% ≈ 236ms); el desarme es inmediato */
  useEffect(() => {
    if (!ready) {
      const id = setTimeout(() => setArmed(false), 0)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setArmed(true), prefersReducedMotion ? 0 : 240)
    return () => clearTimeout(id)
  }, [ready, prefersReducedMotion])

  const nivel = nivelTinta(valores.password)

  /* el error del servidor del campo afectado se disuelve al editar ese
     campo: la cuerda nunca queda en estado roto (criterio 2) */
  const limpiarServerError = useCallback(
    (campo) => setServerError((se) => (se && se.campo === campo ? null : se)),
    [],
  )

  const dispararTremor = useCallback((paso) => {
    setTremor((t) => ({ ...t, [paso]: t[paso] === 'a' ? 'b' : 'a' }))
  }, [])

  // Bloq Mayús en los campos de contraseña (simétrico a DojoLogin).
  const onCapsKey = useCallback((e) => {
    if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'))
  }, [])

  const handleOath = useCallback(
    (checked) => {
      setOath(checked)
      if (checked) {
        setOathError(null)
        onPhase?.('sello')
      }
    },
    [onPhase],
  )

  const onSubmit = async (data) => {
    if (!oath) {
      setOathError('El juramento queda por sellar: estampa el sello para alistarte.')
      oathRef.current?.focus({ preventScroll: true })
      return
    }
    setServerError(null)
    setRootError(null)
    onPhase?.('envio')
    try {
      await onRegister({
        username: data.username,
        email: data.email,
        password: data.password,
        referralCode: data.referralCode || undefined,
      })
      onPhase?.('alta')
      onSuccess(data.username)
    } catch (err) {
      if (err?.status === 409) {
        const campo = err?.body?.campo === 'email' ? 'email' : 'username'
        setServerError(
          campo === 'email'
            ? {
                campo,
                titulo: 'Ese correo ya está alistado.',
                cuerpo: 'No es un fallo tuyo: ya existe una cuenta con ese correo. Quizá quieras iniciar sesión.',
                sugerencias: null,
              }
            : {
                campo,
                titulo: err?.body?.campo
                  ? 'Ese nombre ya tiene dueño en el dojo.'
                  : 'Ese usuario o email ya está registrado.',
                cuerpo: err?.body?.campo
                  ? 'No es un fallo tuyo: otro guerrero llegó antes. Elige una variante y sigue el rito.'
                  : 'Prueba con otros datos o inicia sesión.',
                sugerencias: Array.isArray(err?.body?.sugerencias) ? err.body.sugerencias : null,
              },
        )
        setAttempt((a) => a + 1)
        onPhase?.('corte')
        if (!prefersReducedMotion) {
          dispararTremor(campo === 'email' ? 2 : 1)
          onPhase?.('tremor')
        }
        setFocus(campo)
      } else {
        setRootError(
          err?.status
            ? err?.message || 'El servidor respondió con un error. Inténtalo de nuevo en un momento.'
            : 'No llegamos al servidor. No es culpa de tus datos: la conexión no respondió.',
        )
        setAttempt((a) => a + 1)
        onPhase?.('corte')
      }
    }
  }

  const aplicarSugerencia = useCallback(
    (s) => {
      setValue('username', s, { shouldValidate: true })
      setServerError(null)
      setFocus('username')
    },
    [setValue, setFocus],
  )

  const hangs = [
    { n: 1, cap: '01 · nombre', lit: lit1 },
    { n: 2, cap: '02 · correo y llave', lit: lit2 },
    { n: 3, cap: '03 · juramento', lit: lit3 },
  ]

  const inputClass = (name) =>
    `min-h-11 rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold ${
      errors[name] ? 'border-danger' : 'border-border'
    }`

  return (
    <section
      className="rr-rite mx-auto w-full max-w-[480px] rounded-3xl border border-border bg-bg p-5 sm:p-7"
      data-screen-label="register"
      data-in={riteIn}
      data-tense={ready && !isSubmitting}
    >
      <span className="rr-watermark" aria-hidden="true">結</span>

      {/* cuerda shimenawa horizontal (≥640px) — decorativa: el progreso real
          lo cuentan los fieldsets y sus estados accesibles */}
      <div className="rr-rope rr-rope--h" aria-hidden="true">
        <div className="rr-rope__line"><span className="rr-rope__sheen"></span></div>
        {hangs.map((h) => (
          <div key={h.n} className={`rr-rope__hang rr-rope__hang--${h.n}`} data-lit={h.lit}>
            <span className="rr-rope__knot"></span>
            <span className="rr-shide-tremor" data-tremor={tremor[h.n] || undefined}>
              <span className="rr-shide"><i></i><i></i><i></i></span>
            </span>
            <span className="rr-rope__cap">{h.cap}</span>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-col items-start gap-2">
        <span className="font-mono text-[11px] text-fg-muted">— el rito de ingreso —</span>
        <h1 className="text-[25px] font-semibold tracking-tight text-fg-strong">Cruza el rito</h1>
        <p className="text-sm text-fg-muted [text-wrap:pretty]">
          Tres pasos: tu nombre, tu llave y tu juramento. Tu nombre de usuario aparece junto a tus votos.
        </p>
      </div>

      {/* OAuth directo: tablillas arriba; AuthSocialButtons ya conserva next
          vía sessionStorage('animeshowdown.oauth.next') (criterio 3) */}
      <AuthSocialButtons action="Crear cuenta" next={next} linkClassName="dojo-login__tablet" />

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="rr-body flex flex-col gap-6">
          {/* cuerda vertical (≤639px): los shide se vuelven nudos por paso */}
          <div className="rr-rope rr-rope--v" aria-hidden="true">
            <div className="rr-rope__line"><span className="rr-rope__sheen"></span></div>
          </div>

          {/* 壱 — nombre de guerrero */}
          <fieldset className="rr-paso flex flex-col gap-1.5" data-lit={lit1} data-tremor={tremor[1] || undefined}>
            <legend>
              <span className="rr-paso__kanji" aria-hidden="true">壱</span>
              <span className="text-[13px] font-semibold text-fg-strong">El nombre de guerrero</span>
            </legend>
            <label htmlFor="username" className="text-[13px] font-medium text-fg-strong">Nombre de usuario</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              aria-invalid={Boolean(errors.username) || serverError?.campo === 'username'}
              aria-describedby={
                serverError?.campo === 'username'
                  ? 'username-server'
                  : errors.username
                    ? 'username-error'
                    : undefined
              }
              {...register('username', {
                onChange: () => limpiarServerError('username'),
              })}
              placeholder="Elige un nombre de usuario"
              className={inputClass('username')}
            />
            {errors.username && (
              <p id="username-error" className="text-[12px] text-danger">{errors.username.message}</p>
            )}
            <div aria-live="assertive">
              {serverError?.campo === 'username' && (
                <div role="alert" id="username-server" className="rr-error" key={`se-u-${attempt}`}>
                  <span className="rr-error__seal" aria-hidden="true">否</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-accent-text">{serverError.titulo}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">{serverError.cuerpo}</span>
                    {serverError.sugerencias && serverError.sugerencias.length > 0 && (
                      <span className="rr-error__sug">
                        {serverError.sugerencias.map((s) => (
                          <button key={s} type="button" onClick={() => aplicarSugerencia(s)}>{s}</button>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="rr-error__cover" aria-hidden="true"><span className="rr-error__edge"></span></span>
                </div>
              )}
            </div>
          </fieldset>

          {/* 弐 — correo y llave */}
          <fieldset className="rr-paso flex flex-col gap-4" data-lit={lit2} data-tremor={tremor[2] || undefined}>
            <legend>
              <span className="rr-paso__kanji" aria-hidden="true">弐</span>
              <span className="text-[13px] font-semibold text-fg-strong">El correo y la llave</span>
            </legend>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-fg-strong">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email) || serverError?.campo === 'email'}
                aria-describedby={
                  serverError?.campo === 'email' ? 'email-server' : errors.email ? 'email-error' : undefined
                }
                {...register('email', {
                  onChange: () => limpiarServerError('email'),
                })}
                placeholder="tu@correo.com"
                className={inputClass('email')}
              />
              {errors.email && <p id="email-error" className="text-[12px] text-danger">{errors.email.message}</p>}
              <div aria-live="assertive">
                {serverError?.campo === 'email' && (
                  <div role="alert" id="email-server" className="rr-error" key={`se-e-${attempt}`}>
                    <span className="rr-error__seal" aria-hidden="true">否</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-accent-text">{serverError.titulo}</span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">{serverError.cuerpo}</span>
                    </span>
                    <span className="rr-error__cover" aria-hidden="true"><span className="rr-error__edge"></span></span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-fg-strong">Contraseña</label>
              <div className="rr-pwrow">
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  error={Boolean(errors.password)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error rr-ink-status' : 'rr-ink-status'}
                  placeholder="Mínimo 8, con letra y número"
                  onKeyDown={onCapsKey}
                  onKeyUp={onCapsKey}
                  {...register('password')}
                />
                <div className="rr-inkwell" aria-hidden="true">
                  <span className="rr-inkwell__ink" data-nivel={nivel}></span>
                </div>
              </div>
              {/* Descripción ESTÁTICA (sin aria-live): es blanco de aria-describedby
                  del input; si fuera live region, re-anunciaría en cada tecla. El
                  anuncio dinámico de fuerza va por una live region separada. */}
              <p className="rr-inkcap" data-nivel={nivel} id="rr-ink-status">
                tinta {TINTA_ROMANO[nivel]}/IV — {TINTA_LABEL[nivel]}
              </p>
              <span className="sr-only" role="status" aria-live="polite">
                Fuerza de la contraseña: nivel {nivel} de 4 — {TINTA_LABEL[nivel]}
              </span>
              <div aria-live="polite" role="status">
                {capsOn && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-warning">
                    <span aria-hidden="true" className="text-sm">⇪</span> Tienes las mayúsculas activadas
                  </p>
                )}
              </div>
              {errors.password && (
                <p id="password-error" className="text-[12px] text-danger">{errors.password.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-[13px] font-medium text-fg-strong">
                Confirma la contraseña
              </label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                error={Boolean(errors.confirmPassword)}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                placeholder="Repite tu contraseña"
                onKeyDown={onCapsKey}
                onKeyUp={onCapsKey}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" className="text-[12px] text-danger">{errors.confirmPassword.message}</p>
              )}
            </div>
          </fieldset>

          {/* 参 — el juramento: checkbox REAL; el sello 誓 es su cara visible
              (focusable y togglable por teclado; estado nativo :checked) */}
          <fieldset className="rr-paso flex flex-col gap-2" data-lit={lit3} data-tremor={tremor[3] || undefined}>
            <legend>
              <span className="rr-paso__kanji" aria-hidden="true">参</span>
              <span className="text-[13px] font-semibold text-fg-strong">El juramento</span>
            </legend>
            <div className="rr-oath">
              <input
                type="checkbox"
                id="juramento"
                ref={oathRef}
                className="rr-oath__input"
                checked={oath}
                onChange={(e) => handleOath(e.target.checked)}
                aria-invalid={Boolean(oathError) || undefined}
                aria-describedby={oathError ? 'juramento-desc juramento-error' : 'juramento-desc'}
              />
              <label htmlFor="juramento" className="rr-oath__label">
                <span className="rr-oath__pad" aria-hidden="true">
                  <span className="rr-oath__ghost">誓</span>
                  <span className="rr-oath__bleed"></span>
                  <span className="rr-oath__seal">誓</span>
                </span>
                <span className="text-[13px] leading-relaxed text-fg">
                  <span className="font-semibold text-fg-strong">Sello mi juramento:</span> acepto los términos y la
                  privacidad del dojo.
                  <span className="mt-1 block font-mono text-[11px] text-fg-muted">
                    誓 — juramento · {oath ? 'sellado' : 'estampa el sello'}
                  </span>
                </span>
              </label>
            </div>
            <span id="juramento-desc" className="sr-only">
              Marca esta casilla para aceptar los términos y la privacidad. El detalle está en la nota legal siguiente.
            </span>
            <div aria-live="assertive">
              {oathError && (
                <p id="juramento-error" role="alert" className="text-[12px] text-danger">{oathError}</p>
              )}
            </div>
            <AuthLegalNote action="crear tu cuenta" />
          </fieldset>

          {/* referral: fuera del rito, plegado salvo que llegue ?ref= */}
          <div className="flex flex-col gap-1.5">
            {refOpen ? (
              <>
                <label htmlFor="referralCode" className="text-[13px] font-medium text-fg-strong">
                  Código de referral <span className="text-[11px] font-normal text-fg-muted">(opcional)</span>
                </label>
                <input
                  id="referralCode"
                  type="text"
                  autoComplete="off"
                  maxLength={16}
                  aria-invalid={Boolean(errors.referralCode)}
                  aria-describedby={errors.referralCode ? 'referralCode-error' : undefined}
                  {...register('referralCode')}
                  placeholder="Si un amigo te invitó…"
                  className="min-h-11 rounded-lg border border-border bg-bg px-3.5 py-2.5 font-mono text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold"
                />
                {errors.referralCode && (
                  <p id="referralCode-error" className="text-[12px] text-danger">{errors.referralCode.message}</p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRefOpen(true)}
                className="flex min-h-11 items-center self-start font-mono text-[12px] text-fg-muted transition-colors hover:text-gold"
              >
                ¿Te invitó un guerrero? — añade su código
              </button>
            )}
          </div>

          {/* errores de red / genéricos, también por corte de tinta */}
          <div aria-live="assertive">
            {rootError && (
              <div role="alert" className="rr-error" key={`se-r-${attempt}`}>
                <span className="rr-error__seal" aria-hidden="true">否</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-accent-text">El rito no pudo completarse.</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">{rootError}</span>
                </span>
                <span className="rr-error__cover" aria-hidden="true"><span className="rr-error__edge"></span></span>
              </div>
            )}
          </div>

          {/* tablilla apagada → lacada. Siempre clickable (lección del propio
              RegisterPage: handleSubmit valida y enfoca; un disabled por
              isValid rompía el flujo "fill + click directo") */}
          <button type="submit" className="rr-submit" data-armed={armed} disabled={isSubmitting} aria-busy={isSubmitting}>
            <span className="rr-submit__lacquer" aria-hidden="true"></span>
            <span className="rr-submit__glow" data-busy={isSubmitting} aria-hidden="true"></span>
            <span className="rr-submit__t rr-submit__hanko" aria-hidden="true">結</span>
            <span className="rr-submit__t">{isSubmitting ? 'Sellando tu alta…' : 'Crear cuenta'}</span>
          </button>
        </div>
      </form>

      <p className="mt-4 text-center text-[13px] text-fg-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-gold transition-colors hover:text-gold-bright">
          Inicia sesión
        </Link>
      </p>
    </section>
  )
}

export default RegisterRite
