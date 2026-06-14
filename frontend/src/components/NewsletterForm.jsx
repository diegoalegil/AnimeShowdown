import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, endpoints } from '../lib/api'
import { useSound } from '../contexts/SoundContext'
import './postal-form.css'

/*
 * NewsletterForm — el form del boletín del colofón, reskineado como estafeta
 * postal (sello 便 + sobre que vuela). Vive en la columna "Comunidad" del
 * FederationColophon (App.jsx → newsletterSlot={<NewsletterForm />}), en el
 * bundle inicial del shell.
 *
 * Coreografía (PostalForm #z26):
 *   foco       → la hairline dorada se pinta (200ms, var(--ease-brush), CSS puro)
 *   submit OK  → 'stamping' (el sello 便 se hunde + sangrado hanko, 120ms)
 *              → 'flying'   (el sobre se cierra y parte a la derecha, 400ms)
 *              → 'done'     (confirmación por corte de tinta, en mono)
 *   inválido   → temblor 1px del input UNA vez + mensaje inline
 *   error red  → mensaje honesto inline + reintentar (sin toast, vive en el
 *                footer fuera de viewport)
 *
 * prefers-reduced-motion: sin sello/sobre — confirmación directa.
 * Doble submit imposible: guard síncrono (inFlightRef) + fases ocupadas +
 * disabled nativo (y aria-disabled para AT). React 19 + Compiler: cero refs en
 * render, cero setState síncrono en effects (la coreografía vive en callbacks de
 * setTimeout; la promesa guarda mountedRef para no tocar el desmontado).
 *
 * Doble opt-in: el endpoint resuelve {message} y NO confirma alta inmediata
 * sino envío de email de confirmación. El estado 'done' pinta ese message real
 * (res?.message ?? t('newsletter.okDefault')), no un "ya estás en la lista".
 *
 * Validación nativa con useState: es un único campo email; evita la dep de
 * react-hook-form (~7 KB gzip) en el bundle inicial del shell.
 */

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/** Duraciones (ms) — deben coincidir con postal-form.css */
const T_STAMP = 120 // hundimiento del sello
const T_FLY = 440 // vuelo del sobre (400ms) + margen antes del corte de tinta

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function NewsletterForm() {
  const { t } = useTranslation()
  const { play } = useSound()
  const inputId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  // reposo='idle' · foco=CSS · 'invalid' · 'sending' · 'stamping' · 'flying' · 'done' · 'error'
  const [phase, setPhase] = useState('idle')
  const [shaking, setShaking] = useState(false)
  // Mensaje real de confirmación (doble opt-in) / texto de error inline.
  const [confirmMsg, setConfirmMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const inFlightRef = useRef(false)
  const timersRef = useRef([])
  const mountedRef = useRef(true)
  const confirmRef = useRef(null)

  useEffect(() => {
    return () => {
      // Marca desmontado y limpia timers leyendo timersRef.current (no una copia
      // capturada en montaje): así cubre también los timers pusheados por el
      // resolve de la promesa, y el guard de montaje impide crear nuevos.
      mountedRef.current = false
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  // Mueve el foco a la confirmación al entrar en 'done' (idioma del repo:
  // ConsentScroll). El rAF evita la carrera entre desmontar pf-row y montar
  // pf-confirm en el mismo commit. Cubre las dos rutas a 'done' (normal y calm).
  useEffect(() => {
    if (phase !== 'done') return undefined
    const raf = requestAnimationFrame(() => {
      confirmRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const busy = phase === 'sending' || phase === 'stamping' || phase === 'flying'
  const confirmed = phase === 'done'
  const showInvalid = phase === 'invalid'
  const showNetError = phase === 'error'

  function submitEmail() {
    if (inFlightRef.current || busy || confirmed) return // doble submit imposible
    const value = email.trim()
    if (!value) {
      setErrorMsg(t('newsletter.errorRequired'))
      setPhase('invalid')
      setShaking(true)
      return
    }
    if (!EMAIL_PATTERN.test(value)) {
      setErrorMsg(t('newsletter.errorInvalido'))
      setPhase('invalid')
      setShaking(true)
      return
    }
    inFlightRef.current = true
    setErrorMsg('')
    setPhase('sending')
    Promise.resolve(endpoints.suscribirNewsletter(value)).then(
      (res) => {
        inFlightRef.current = false
        if (!mountedRef.current) return // desmontado en vuelo: ni setState ni timers nuevos
        // Doble opt-in: el backend responde 200 con {message}; pinta el message
        // real (fallback okDefault).
        setConfirmMsg(res?.message ?? t('newsletter.okDefault'))
        if (prefersReducedMotion()) {
          setPhase('done') // sin vuelo: confirmación directa
          return
        }
        play('playSello')
        setPhase('stamping')
        timersRef.current.push(
          setTimeout(() => {
            play('playWhoosh')
            setPhase('flying')
            timersRef.current.push(setTimeout(() => setPhase('done'), T_FLY))
          }, T_STAMP),
        )
      },
      (err) => {
        inFlightRef.current = false
        if (!mountedRef.current) return
        const msg =
          err instanceof ApiError
            ? err.message || t('newsletter.errorEnvio')
            : t('newsletter.errorEnvio')
        setErrorMsg(msg)
        setPhase('error')
      },
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitEmail()
  }

  function handleChange(e) {
    setEmail(e.target.value)
    if (phase === 'invalid' || phase === 'error') {
      setPhase('idle')
      setErrorMsg('')
      // Limpia el flag al editar: bajo prefers-reduced-motion la animación
      // pf-shake se anula (animation:none) y su animationend nunca dispara, así
      // que is-shaking quedaría pegado si dependiéramos solo de handleAnimationEnd.
      setShaking(false)
    }
  }

  function handleReset() {
    // Salida de 'done' de vuelta a 'idle' (suscribir otro email): limpia timers
    // y refs pendientes para que ninguna animación rezagada dispare.
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    inFlightRef.current = false
    setEmail('')
    setConfirmMsg('')
    setErrorMsg('')
    setShaking(false)
    setPhase('idle')
  }

  function handleAnimationEnd(e) {
    if (e.animationName === 'pf-shake') setShaking(false)
  }

  return (
    <form className="pf" data-phase={phase} onSubmit={handleSubmit} noValidate>
      {/* Sin <legend>: la columna "Comunidad" del colofón ya titula la sección
          (h3.fc-col__title). El intro hace de descripción discreta. */}
      <p className="pf-intro">{t('newsletter.intro')}</p>

      {confirmed ? (
        <p className="pf-confirm" ref={confirmRef} tabIndex={-1}>
          <span className="pf-confirm-kanji" aria-hidden="true">
            便
          </span>
          <span className="pf-confirm-text">{confirmMsg}</span>
          <button type="button" className="pf-reset" onClick={handleReset}>
            {t('newsletter.reintentar')}
          </button>
          <span className="pf-confirm-cover" aria-hidden="true"></span>
        </p>
      ) : (
        <div className="pf-row">
          <div
            className={`pf-field${shaking ? ' is-shaking' : ''}`}
            onAnimationEnd={handleAnimationEnd}
          >
            <label className="pf-label" htmlFor={inputId}>
              {t('newsletter.emailLabel')}
            </label>
            <input
              id={inputId}
              className="pf-input"
              type="email"
              name="email"
              autoComplete="email"
              spellCheck="false"
              placeholder={t('newsletter.emailPlaceholder')}
              value={email}
              onChange={handleChange}
              readOnly={busy}
              aria-invalid={showInvalid || undefined}
              aria-describedby={showInvalid || showNetError ? errorId : undefined}
            />
            <span className="pf-hairline" aria-hidden="true"></span>
            <span className="pf-envelope-slot" aria-hidden="true">
              <svg className="pf-envelope" viewBox="0 0 24 17" width="24" height="17">
                <rect className="pf-env-body" x="0.5" y="0.5" width="23" height="16" rx="2"></rect>
                <path className="pf-env-seal" d="M0.5 0.5 L12 9 L23.5 0.5"></path>
                <path className="pf-env-flap" d="M0.5 0.5 H23.5 L12 9.5 Z"></path>
              </svg>
            </span>
          </div>
          <button
            type="submit"
            className="pf-stamp"
            disabled={busy}
            aria-disabled={busy || undefined}
          >
            <span className="pf-stamp-kanji" aria-hidden="true">
              便
            </span>
            <span className="pf-sr">{t('newsletter.submit')}</span>
          </button>
        </div>
      )}

      {showInvalid ? (
        <p className="pf-error" id={errorId} role="alert">
          {errorMsg}
        </p>
      ) : null}

      {showNetError ? (
        <p className="pf-error" id={errorId} role="alert">
          {errorMsg}{' '}
          <button type="button" className="pf-retry" onClick={submitEmail}>
            {t('newsletter.reintentarRed')}
          </button>
        </p>
      ) : null}

      {phase === 'sending' ? (
        <p className="pf-sending" aria-hidden="true">
          {t('newsletter.enviando')}
        </p>
      ) : null}

      <p className="pf-live pf-sr" role="status">
        {phase === 'sending' ? t('newsletter.liveSending') : ''}
        {phase === 'done' ? confirmMsg : ''}
      </p>
    </form>
  )
}

export default NewsletterForm
