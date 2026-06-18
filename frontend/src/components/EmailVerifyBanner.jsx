import { useState, useEffect, useId, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { endpoints, ApiError } from '../lib/api'
import './pending-seal.css'

const GREET_KEY = 'animeshowdown.pendingSeal.greeted'
const UNTIL_KEY = 'animeshowdown.pendingSeal.resendUntil'
const COOLDOWN_SECONDS = 30

/* Lectura idempotente (sin escritura) para el inicializador perezoso;
   la ESCRITURA del flag va en un effect. */
function readGreeted() {
  try {
    return sessionStorage.getItem(GREET_KEY) === '1'
  } catch {
    return true
  }
}

/**
 * SealMark — el hanko a medio estampar (auxiliar puro a nivel de módulo;
 * sin estado ni efectos → puede convivir con react-refresh en este .jsx).
 * Mitad izquierda entintada, mitad derecha en línea discontinua; encima,
 * dos capas pre-renderizadas (sello completo + sangrado) que la ceremonia
 * revela solo con transform/opacity. Kanji: 印 (ya canónico en el repo).
 */
function SealMark() {
  const uid = useId()
  const clipL = `${uid}-l`
  const clipR = `${uid}-r`
  return (
    <svg className="ps-seal" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipL}><rect x="0" y="0" width="24" height="48"></rect></clipPath>
        <clipPath id={clipR}><rect x="24" y="0" width="24" height="48"></rect></clipPath>
      </defs>
      <g clipPath={`url(#${clipL})`}>
        <circle className="ps-seal-disc" cx="24" cy="24" r="19"></circle>
        <text className="ps-seal-kanji" x="24" y="30.5" textAnchor="middle">印</text>
      </g>
      <g className="ps-seal-pendinghalf" clipPath={`url(#${clipR})`}>
        <circle className="ps-seal-dash" cx="24" cy="24" r="19"></circle>
        <text className="ps-seal-kanji ps-seal-kanji-ghost" x="24" y="30.5" textAnchor="middle">印</text>
      </g>
      <g className="ps-seal-bleed">
        <circle className="ps-seal-bleed-disc" cx="24" cy="24" r="19"></circle>
      </g>
      <g className="ps-seal-complete">
        <circle className="ps-seal-disc" cx="24" cy="24" r="19"></circle>
        <text className="ps-seal-kanji" x="24" y="30.5" textAnchor="middle">印</text>
      </g>
    </svg>
  )
}

/**
 * EmailVerifyBanner — el aviso de "verifica tu email" como sello pendiente.
 *
 * Reskin de canvas "El sello pendiente": el banner de verificación de email
 * es un hanko 印 a medio estampar que se completa cuando el usuario verifica.
 *
 * Sigue siendo el componente VIVO del shell (App.jsx lo monta sin props).
 * Lee el estado de auth, llama al endpoint real y usa el SoundContext por
 * dentro; la pieza presentacional (SealMark + máquina de fases) se cablea
 * internamente.
 *
 * - `verified` se deriva de useAuth(): el banner aplica cuando
 *   `user.estadoVerificacion === 'PENDIENTE'`. La ceremonia de estampado
 *   SOLO se dispara en la transición no→sí (refresh de sesión que recibe
 *   el estado actualizado del backend), vía guard `prevVerified` en render.
 *   Montar ya verificado (o sin user) ⇒ devuelve null. Tras la ceremonia +
 *   colapso ⇒ deja de renderizar.
 * - Reenvío real vía endpoints.resendVerification() (sin args). OK ⇒ cooldown
 *   honesto de 30s (timestamp absoluto en localStorage). Rechazo ⇒ estado de
 *   error inline ("no se pudo reenviar — vuelve a intentarlo").
 * - Feedback inline, SIN toast: cooldown = éxito, error inline = fallo; un
 *   solo canal. El role="status" de la franja lo anuncia a lectores.
 * - Sonidos vía useSound().play: playSello al estamparse el sello, playClack
 *   al hundir la tablilla. El mute global lo respeta el SoundContext.
 * - Sticky bajo el header (recordatorio persistente): wrapper .ps-shell con
 *   `position: sticky; top: 4rem`. El colapso de la ceremonia vive en el
 *   grid interior, no en este contenedor sticky.
 */
function EmailVerifyBanner() {
  const { user } = useAuth()
  const { play } = useSound()

  // present = hay sesión; pending = ese user aún tiene el email sin verificar.
  // Distinguir ambos es clave: salir de "pending" por VERIFICAR (user sigue
  // presente) es una ceremonia; salir por LOGOUT (user→null) NO lo es.
  const present = !!user
  const pending = present && user.estadoVerificacion === 'PENDIENTE'

  const [phase, setPhase] = useState(() =>
    pending ? (readGreeted() ? 'idle' : 'entering') : 'gone',
  )
  const [prevPending, setPrevPending] = useState(pending)
  const [resend, setResend] = useState('ready') // ready | sending | cooldown | error
  const [errorMsg, setErrorMsg] = useState('')
  const [untilTs, setUntilTs] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const mountedRef = useRef(true)

  /* Transición de "pending": ajuste durante el render con guard (patrón
     canónico React 19 / Compiler — nada de setState en effect). */
  if (prevPending !== pending) {
    setPrevPending(pending)
    if (!pending) {
      // Salió de pendiente. Ceremonia SOLO si fue una verificación real (el
      // mismo user sigue presente y ya no está PENDIENTE). Un logout (user→null)
      // también deja de ser pending, pero NO es verificar: la franja se va muda.
      if (present && phase !== 'gone') setPhase('ceremony')
      else if (!present) setPhase('gone')
    } else {
      // Entró en pendiente (nuevo login PENDIENTE en la misma pestaña, incluso
      // si la fase ya era absorbente 'gone'): re-armar el recordatorio.
      setPhase(readGreeted() ? 'idle' : 'entering')
    }
  }

  /* Entrada: una vez por sesión. La escritura del flag va aquí, no en render. */
  useEffect(() => {
    if (phase !== 'entering') return undefined
    try {
      sessionStorage.setItem(GREET_KEY, '1')
    } catch {
      /* sin storage */
    }
    const t = setTimeout(() => setPhase('idle'), 240)
    return () => clearTimeout(t)
  }, [phase])

  /* Ceremonia: sonido + despedida a los 2s (setState solo en callbacks de timer). */
  useEffect(() => {
    if (phase !== 'ceremony') return undefined
    play('playSello')
    const t = setTimeout(() => setPhase('leaving'), 2000)
    return () => clearTimeout(t)
  }, [phase, play])

  useEffect(() => {
    if (phase !== 'leaving') return undefined
    const t = setTimeout(() => setPhase('gone'), 360)
    return () => clearTimeout(t)
  }, [phase])

  /* Cancela continuaciones async (resend) si el banner se desmonta en vuelo. */
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /* Cooldown honesto: restaurar el timestamp absoluto al montar. */
  useEffect(() => {
    const t = setTimeout(() => {
      let raw = null
      try {
        raw = localStorage.getItem(UNTIL_KEY)
      } catch {
        /* sin storage */
      }
      const until = Number(raw)
      if (Number.isFinite(until) && until > Date.now()) {
        setUntilTs(until)
        // Siembra el contador para que el primer render ya muestre el tiempo.
        setSecondsLeft(Math.max(1, Math.ceil((until - Date.now()) / 1000)))
        setResend('cooldown')
      } else if (raw != null) {
        // Presente pero no es un timestamp futuro válido (incluye NaN/Infinity/
        // corrupto): limpiar para no dejar un resendUntil zombi.
        try {
          localStorage.removeItem(UNTIL_KEY)
        } catch {
          /* sin storage */
        }
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  /* Tick del cooldown. Se desmonta al llegar a leaving/gone (la franja ya no se
     ve): así el intervalo no sigue latiendo sobre un componente que pinta null. */
  useEffect(() => {
    if (untilTs == null || phase === 'leaving' || phase === 'gone') return undefined
    const tick = () => {
      if (document.hidden) return // pausa con la pestaña oculta (cuenta atrás derivada de Date.now)
      const left = Math.ceil((untilTs - Date.now()) / 1000)
      if (left <= 0) {
        try {
          localStorage.removeItem(UNTIL_KEY)
        } catch {
          /* sin storage */
        }
        setUntilTs(null)
        setSecondsLeft(null)
        setResend((r) => (r === 'cooldown' ? 'ready' : r))
      } else {
        setSecondsLeft((s) => (s === left ? s : left))
      }
    }
    const t = setTimeout(tick, 0)
    const iv = setInterval(tick, 1000) // display de segundos enteros: 1s basta
    const onVisible = () => {
      if (!document.hidden) tick() // al volver, refresca ya
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [untilTs, phase])

  async function handleResend() {
    if (resend === 'sending' || resend === 'cooldown') return
    setResend('sending')
    setErrorMsg('')
    play('playClack')
    try {
      await endpoints.resendVerification()
      if (!mountedRef.current) return // desmontado en vuelo: ni storage ni setState
      const until = Date.now() + COOLDOWN_SECONDS * 1000
      try {
        localStorage.setItem(UNTIL_KEY, String(until))
      } catch {
        /* sin storage */
      }
      setUntilTs(until)
      setSecondsLeft(COOLDOWN_SECONDS) // sin parpadeo: el primer render ya muestra 0:30
      setResend('cooldown')
    } catch (err) {
      if (!mountedRef.current) return
      // El backend no devuelve retry-after; mostramos el mensaje de la
      // ApiError si lo hay (feedback honesto, un solo canal: estado inline).
      setErrorMsg(err instanceof ApiError ? err.message : '')
      setResend('error')
    }
  }

  if (phase === 'gone') return null

  const done = phase === 'ceremony' || phase === 'leaving'
  const countdown = secondsLeft != null ? `0:${String(secondsLeft).padStart(2, '0')}` : ''

  return (
    <div className="ps-shell">
      <div className={'ps-root' + (phase === 'leaving' ? ' is-leaving' : '')}>
        <div className="ps-clip">
          <div
            className={
              'ps-strip' +
              (phase === 'entering' ? ' is-entering' : '') +
              (done ? ' is-ceremony' : '')
            }
            role="status"
          >
            <SealMark></SealMark>
            {done ? (
              <p className="ps-copy is-done ps-swap-in" key="done">
                <strong>sello completado</strong>
                <span className="ps-copy-long"> — ya puedes votar</span>
              </p>
            ) : resend === 'error' ? (
              <p className="ps-copy is-error ps-swap-in" key="error">
                no se pudo reenviar<span className="ps-copy-long"> el correo</span> — vuelve a intentarlo
                {errorMsg ? <span className="ps-visually-hidden"> ({errorMsg})</span> : null}
              </p>
            ) : (
              <p className="ps-copy" key="waiting">
                <strong>tu sello espera</strong>
                <span className="ps-copy-long"> — confirma tu correo para votar</span>
                <span className="ps-copy-short"> — confirma tu correo</span>
              </p>
            )}
            <button
              type="button"
              className="ps-tablet"
              onClick={handleResend}
              disabled={resend === 'sending' || resend === 'cooldown' || done}
            >
              {resend === 'cooldown' ? (
                <>
                  <span>reenviado</span>
                  <span aria-hidden="true"> · </span>
                  <span className="ps-count" aria-hidden="true">
                    <span className="ps-roll" key={secondsLeft}>{countdown}</span>
                  </span>
                  <span className="ps-visually-hidden">
                    {' '}— podrás pedir otro correo en menos de {COOLDOWN_SECONDS} segundos
                  </span>
                </>
              ) : resend === 'sending' ? (
                'enviando…'
              ) : resend === 'error' ? (
                'reintentar'
              ) : (
                <>
                  <span className="ps-copy-long">reenviar correo</span>
                  <span className="ps-copy-short">reenviar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailVerifyBanner
