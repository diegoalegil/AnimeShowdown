import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import PasswordInput from '../../components/PasswordInput'
import AuthSocialButtons from '../../components/AuthSocialButtons'
import AuthLegalNote from '../../components/AuthLegalNote'
import { escenaDeEntrada, sanitizeNext } from './dojo-login-data'
import './dojo-login.css'

// Estilos en dojo-login.css (importado arriba). CSP por hash: cero <style> en
// runtime, todos los keyframes viven en ese fichero.

/**
 * @typedef {Object} DojoScene
 * @property {string} slug    Slug del banco de marca (p.ej. "jujutsu-kaisen-scene-01");
 *                            variantes -480/-768/-1280 .webp.
 * @property {string} fandom  Nombre legible del fandom para el caption.
 */

/**
 * La entrada al dojo — /login.
 *
 * Coreografía (ver NOTAS-HANDOFF.md):
 *   t0      paños del noren: translateY(-8px) + rotate(±2.5°), 500ms var(--ease-lift), stagger 80ms
 *   t+300ms form: translateY(8px)→0 + opacity, 300ms
 *   t+600ms focus({ preventScroll: true }) al campo correcto
 *
 * @param {Object} props
 * @param {(identificador: string, password: string) => Promise<void>} props.onLogin
 *        Promesa del AuthContext. Rechazos esperados: err.status === 401 (credenciales),
 *        err.status === undefined/0 (red). 2FA: ver nota de integración.
 * @param {Array<DojoScene>} props.scenes
 *        Lista curada de scenes destacadas. DATO DE PRODUCTO — no se inventa aquí;
 *        el caller decide qué fandoms entran en la rotación.
 * @param {string|null} [props.rememberedUsername]
 *        Username recordado (la clave de storage es decisión del caller). Si llega,
 *        se saluda con "bienvenido de vuelta" y el foco va directo a password.
 * @param {string|null} [props.welcomeLine]
 *        Línea de bienvenida de la federación sobre el arte. DATO DE PRODUCTO —
 *        si es null no se muestra línea (no inventamos copy de marca).
 * @param {string} [props.brandAssetsBase='https://assets.animeshowdown.dev/img/brand/']
 */
function DojoLogin({
  onLogin,
  scenes,
  rememberedUsername = null,
  welcomeLine = null,
  brandAssetsBase = 'https://assets.animeshowdown.dev/img/brand/',
}) {
  const prefersReducedMotion = useReducedMotion()
  const [params] = useSearchParams()
  const next = sanitizeNext(params.get('next'))
  const nextQ = `?next=${encodeURIComponent(next)}`

  // Fases de entrada. Inicializadores PUROS (StrictMode monta doble).
  const [norenOpen, setNorenOpen] = useState(false)
  const [formIn, setFormIn] = useState(false)
  const [tremorTick, setTremorTick] = useState(0) // re-key del tremor: una vez por intento
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null) // { kind: 'cred'|'net', title, body }
  const [capsOn, setCapsOn] = useState(false)
  const [identificador, setIdentificador] = useState(rememberedUsername ?? '')
  const [password, setPassword] = useState('')
  const [artFailed, setArtFailed] = useState(false)

  const userRef = useRef(null)
  const passRef = useRef(null)
  // Escena contextual: si venías al PvP en vivo (next=/duel-live) la puerta
  // muestra la arena de PvP en vez de la escena de anime del día.
  const scene = useMemo(() => escenaDeEntrada(next, scenes), [next, scenes])

  const focusRight = useCallback(() => {
    const el = rememberedUsername ? passRef.current : userRef.current
    // preventScroll: el autofocus no roba el scroll en 390px
    el?.focus({ preventScroll: true })
  }, [rememberedUsername])

  // Entrada: TODO por timeouts asíncronos (cero setState síncrono en el
  // cuerpo del effect — regla del Compiler); con reduced-motion las fases
  // colapsan a un solo tick inmediato.
  useEffect(() => {
    if (prefersReducedMotion) {
      const ids = [
        setTimeout(() => {
          setNorenOpen(true)
          setFormIn(true)
        }, 0),
        setTimeout(() => focusRight(), 60),
      ]
      return () => ids.forEach(clearTimeout)
    }
    const ids = [
      setTimeout(() => setNorenOpen(true), 30),
      setTimeout(() => setFormIn(true), 330),
      setTimeout(() => focusRight(), 660),
    ]
    return () => ids.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCapsKey = useCallback((e) => {
    if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'))
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (submitting) return
      // Validacion client-side minima: el backend valida el login con
      // @NotBlank (sin @Size), asi que NO imponemos minimos propios aqui
      // — exigir 3/6 caracteres bloqueaba a quien tuviera credenciales
      // cortas antes de llegar al server. Solo evitamos el viaje vacio.
      const id = identificador.trim()
      if (!id || !password) {
        setError({
          kind: 'cred',
          title: 'Faltan datos para entrar.',
          body: !id
            ? 'Escribe tu usuario o email para entrar al dojo.'
            : 'Escribe tu contraseña para entrar al dojo.',
        })
        return
      }
      setSubmitting(true)
      setError(null)
      try {
        await onLogin(identificador.trim(), password)
        // El caller navega a `next` (o monta el paso 2FA) al resolver.
      } catch (err) {
        const isCred = err?.status === 401
        const isRate = err?.status === 429
        setError(
          isCred
            ? {
                kind: 'cred',
                title: 'El dojo no te reconoce.',
                body: 'Tu usuario y tu contraseña no coinciden con ningún registro. Revísalos y vuelve a llamar.',
              }
            : isRate
              ? {
                  kind: 'cred',
                  title: 'Demasiadas llamadas a la puerta.',
                  body: 'Espera unos segundos antes de volver a intentarlo.',
                }
              : err?.status
                ? {
                    kind: 'net',
                    title: 'El dojo no pudo atenderte.',
                    body: err?.message || 'El servidor respondió con un error. Inténtalo de nuevo en un momento.',
                  }
                : {
                    kind: 'net',
                    title: 'No llegamos al servidor.',
                    body: 'No es un problema de tus credenciales: la conexión no respondió. Inténtalo de nuevo en unos segundos.',
                  },
        )
        // Tremor SOLO con credenciales incorrectas, una vez por intento,
        // y nunca con reduced-motion (el error queda por color y texto).
        if (isCred && !prefersReducedMotion) setTremorTick((t) => t + 1)
      } finally {
        setSubmitting(false)
      }
    },
    [submitting, onLogin, identificador, password, prefersReducedMotion],
  )

  return (
    <section className="flex min-h-[calc(100vh-6rem)] bg-bg" data-screen-label="login">
      {/* Columna de arte — solo desktop, lazy, fuera del LCP del form */}
      <div className="relative hidden flex-[1.2] overflow-hidden lg:block" aria-hidden="true">
        {scene && !artFailed && (
          <img
            src={`${brandAssetsBase}${scene.slug}-1280.webp`}
            srcSet={`${brandAssetsBase}${scene.slug}-480.webp 480w, ${brandAssetsBase}${scene.slug}-768.webp 768w, ${brandAssetsBase}${scene.slug}-1280.webp 1280w`}
            sizes="60vw"
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setArtFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="dojo-login__scrim absolute inset-0" />
        <span className="dojo-login__watermark absolute right-6 top-4 select-none">入</span>
        {(welcomeLine || scene) && (
          <div className="absolute bottom-8 left-9 right-14">
            <div className="mb-3 h-px w-12 bg-border-gold" />
            {welcomeLine && (
              <p className="font-display text-[27px] leading-snug text-fg-strong [text-wrap:pretty]">
                {welcomeLine}
              </p>
            )}
            {scene && (
              <p className="mt-2 font-mono text-[11px] text-fg-muted">
                {scene.caption ?? `escena del día — ${scene.fandom}`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Columna del formulario */}
      <div className="relative flex flex-1 flex-col items-center px-5 pb-10 lg:px-12">
        <div className="flex w-full max-w-[400px] flex-col">
          {/* Noren */}
          <div className="dojo-noren" data-open={norenOpen} key={tremorTick} data-tremor={tremorTick > 0}>
            <div className="dojo-noren__rod" />
            <div className="mt-1 flex gap-2">
              <div className="dojo-noren__panel dojo-noren__panel--left">
                <span className="dojo-noren__weave" aria-hidden="true" />
                <span className="dojo-noren__crest font-kanji-serif">入</span>
                <span className="dojo-noren__hem" aria-hidden="true" />
              </div>
              <div className="dojo-noren__panel dojo-noren__panel--right">
                <span className="dojo-noren__weave" aria-hidden="true" />
                <span className="text-center">
                  <span className="block font-display text-[17px] text-fg-strong">AnimeShowdown</span>
                  <span className="mt-1 block font-mono text-[10px] text-fg-muted">— el dojo —</span>
                </span>
                <span className="dojo-noren__hem" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Form — entra en t+300ms; ES el LCP, nunca espera al arte */}
          <div className="dojo-login__form mt-7 flex flex-col gap-[18px]" data-in={formIn}>
            {rememberedUsername ? (
              <div>
                <h1 className="text-[25px] font-semibold tracking-tight text-fg-strong">
                  Bienvenido de vuelta, <span className="text-gold">{rememberedUsername}</span>.
                </h1>
                <p className="mt-2 text-sm text-fg-muted">Tu racha sigue viva. Solo falta tu contraseña.</p>
              </div>
            ) : (
              <div>
                <h1 className="text-[25px] font-semibold tracking-tight text-fg-strong">Entra al dojo</h1>
                <p className="mt-2 text-sm text-fg-muted">Vota, predice y defiende tu puesto en el ranking.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="identificador" className="text-[13px] font-medium text-fg-strong">
                  Usuario o email
                </label>
                <input
                  id="identificador"
                  ref={userRef}
                  type="text"
                  autoComplete="username"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="tu usuario o tu email"
                  className="min-h-11 rounded-lg border border-border bg-canvas px-3.5 py-2.5 text-sm text-fg-strong focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[13px] font-medium text-fg-strong">
                  Contraseña
                </label>
                <PasswordInput
                  id="password"
                  ref={passRef}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onCapsKey}
                  onKeyUp={onCapsKey}
                  placeholder="tu contraseña"
                  error={error?.kind === 'cred'}
                />
                <div role="status" aria-live="polite">
                  {capsOn && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-warning">
                      <span aria-hidden="true" className="text-sm">⇪</span> Tienes las mayúsculas activadas
                    </p>
                  )}
                </div>
              </div>

              {/* Error del escriba: corte de tinta + sello 否 */}
              <div aria-live="assertive">
                {error && (
                  <div role="alert" className="dojo-login__error" key={`${error.kind}-${tremorTick}`}>
                    <span className="dojo-login__error-seal font-kanji-serif" aria-hidden="true">否</span>
                    <span>
                      <span className="block text-[13px] font-semibold text-accent-text">{error.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">{error.body}</span>
                    </span>
                    <span className="dojo-login__error-cover" aria-hidden="true">
                      <span className="dojo-login__error-edge" />
                    </span>
                  </div>
                )}
              </div>

              {/* Botón-sello: pulso de tinta en espera (capa de glow pre-pintada) */}
              <button type="submit" disabled={submitting} aria-busy={submitting} className="dojo-login__submit">
                <span className="dojo-login__ink-glow" data-busy={submitting} aria-hidden="true" />
                <span className="dojo-login__hanko font-kanji-serif" aria-hidden="true">印</span>
                {submitting ? 'Sellando tu entrada…' : 'Entrar al dojo'}
              </button>

              <div className="flex items-center gap-3 text-[11px] font-semibold text-fg-muted">
                <span className="h-px flex-1 bg-border" />
                o entra con
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* Tablillas de madera — AuthSocialButtons ya conserva next vía
                  sessionStorage('animeshowdown.oauth.next'); aquí solo cambia
                  la piel (clase dojo-login__tablet en su <a>). */}
              <AuthSocialButtons next={next} action="Entrar" linkClassName="dojo-login__tablet" />
              <AuthLegalNote action="entrar" />

              <div className="flex items-center justify-between gap-3 text-[12px]">
                <Link
                  to={`/forgot-password${nextQ}`}
                  className="flex min-h-11 items-center text-fg-muted transition-colors hover:text-gold"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
                <Link
                  to={`/register${nextQ}`}
                  className="flex min-h-11 items-center font-semibold text-gold transition-colors hover:text-gold-bright"
                >
                  ¿Primera vez? Cruza el rito
                </Link>
              </div>
            </form>
          </div>

          {/* Scene en móvil: debajo del form, lazy, nunca en el LCP */}
          {scene && (
            <div className="relative mt-6 h-[140px] overflow-hidden rounded-[10px] bg-surface lg:hidden" aria-hidden="true">
              {!artFailed && (
                <img
                  src={`${brandAssetsBase}${scene.slug}-768.webp`}
                  srcSet={`${brandAssetsBase}${scene.slug}-480.webp 480w, ${brandAssetsBase}${scene.slug}-768.webp 768w`}
                  sizes="100vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setArtFailed(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="dojo-login__scrim absolute inset-0" />
              <div className="absolute bottom-3 left-4 right-4">
                {welcomeLine && <p className="font-display text-[15px] text-fg-strong">{welcomeLine}</p>}
                <p className="mt-1 font-mono text-[10px] text-fg-muted">{scene.caption ?? `escena del día — ${scene.fandom}`}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default DojoLogin
