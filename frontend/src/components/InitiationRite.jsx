// Rito de iniciación post-registro: interstitial one-shot con la placa del
// nuevo luchador. El username real se acuña carácter a carácter sobre una
// placa lacada con filo dorado, un hanko 戦 se estampa al completarse y la
// salida MORFA la placa hacia el avatar del header (View Transitions, ver
// startRitoAcunacionTransition). Tap/Enter/Espacio/Escape saltan directo a la
// salida — el morph se conserva: es la recompensa. Pestaña oculta ⇒ salida
// inmediata. Solo transform/opacity (+ el stroke-dashoffset del hairline);
// cero blur, cero preserve-3d, sombras estáticas del sistema.
//
// reduced-motion lo decide el CALLER (RegisterPage): con la preferencia
// activa no se monta esta ceremonia — toast de bienvenida y navegación
// directa, cero animación y cero SFX.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSound } from '../contexts/SoundContext'
import { startRitoAcunacionTransition } from '../lib/viewTransitions'
import { markInitiationRiteSeen, RITE_T, riteTimings } from '../lib/initiationRite'
import { EASE_BRUSH, EASE_LIFT } from '../lib/motion'
import { useFocusTrap } from '../hooks/useFocusTrap'

// Bezier con overshoot solo para la estampa del hanko: golpea, rebasa y
// asienta. No vive en lib/motion porque es un acento puntual, no lenguaje.
const EASE_STAMP = [0.34, 1.56, 0.64, 1]

export default function InitiationRite({ username, to = '/' }) {
  const navigate = useNavigate()
  const { play } = useSound()
  const plateRef = useRef(null)
  const dialogRef = useRef(null)
  const finishedRef = useRef(false)
  const timersRef = useRef([])

  const chars = useMemo(() => Array.from(username ?? ''), [username])
  const { stagger, hankoAt, sfxAt, exitAt } = useMemo(
    () => riteTimings(chars.length),
    [chars.length],
  )

  // Salida única e idempotente: limpia timers y lanza el morph (o navegación
  // directa sin soporte). El skip llega aquí igual que la salida automática.
  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
    startRitoAcunacionTransition(plateRef.current, () => navigate(to))
  }, [navigate, to])

  // Programación del rito: one-shot marcado al ENTRAR (una recarga a mitad
  // no repite la ceremonia), SFX en el impacto del hanko y salida automática.
  // Pestaña oculta → salir ya (nada se anima fuera de viewport).
  useEffect(() => {
    markInitiationRiteSeen()
    timersRef.current.push(window.setTimeout(() => play('playAcunado'), sfxAt))
    timersRef.current.push(window.setTimeout(finish, exitAt))
    const onVisibility = () => {
      if (document.hidden) finish()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current = []
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [play, finish, sfxAt, exitAt])

  // Skip por teclado (el tap lo cubre el onPointerDown del overlay).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  // a11y de modal: el overlay declaraba role="dialog" aria-modal pero sin
  // focus-trap, scroll-lock ni restauración de foco. Reutiliza el hook ya usado
  // en DuelCeremony/ScoreScroll (Escape→finish, trap de Tab, body scroll-lock y
  // devolución del foco al disparador al cerrar).
  useFocusTrap(dialogRef, { onClose: finish })

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Bienvenido, ${username}`}
      tabIndex={-1}
      onPointerDown={finish}
      className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center bg-bg outline-none"
    >
      {/* Halo dorado estático, sin blur: gradiente pre-renderizado por el UA. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,var(--color-gold-soft),transparent_36rem)]"
      />

      {/* La placa: origen del morph de salida. Sombras estáticas del sistema. */}
      <motion.div
        ref={plateRef}
        initial={{ opacity: 0, scale: 0.965 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: RITE_T.plateIn / 1000, ease: EASE_LIFT }}
        className="relative w-[min(34rem,88vw)] rounded-2xl border border-gold/25 bg-gradient-to-b from-surface to-bg px-8 py-12 shadow-aura-lg inset-shadow-hairline [--aura-color:var(--color-gold-aura-soft)] sm:px-12 sm:py-14"
      >
        {/* Hairline oro recorriendo el filo (pathLength normalizado). */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <motion.rect
            x="1"
            y="1"
            width="100%"
            height="100%"
            rx="16"
            className="fill-none stroke-gold"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              delay: RITE_T.hairlineDelay / 1000,
              duration: RITE_T.hairlineDur / 1000,
              ease: EASE_BRUSH,
            }}
          />
        </svg>

        {/* 初陣 — uijin, "primera batalla". Kanji real con significado. */}
        <p className="text-center text-[15px] tracking-[0.5em] text-gold/70 [font-family:var(--font-kanji-serif)] [text-indent:0.5em]">
          初陣
        </p>

        {/* El username se acuña carácter a carácter, en mono. Los nombres
            largos bajan un cuerpo: sin espacios (regex del registro) el wrap
            solo puede partir mid-word y dejaría una línea huérfana. */}
        <p
          aria-hidden="true"
          className={`mt-5 flex flex-wrap items-baseline justify-center font-mono font-bold text-fg-strong text-shadow-scrim ${
            chars.length > 16 ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'
          }`}
        >
          {chars.map((ch, i) => (
            <motion.span
              key={`${i}-${ch}`}
              className="inline-block"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: (RITE_T.charsStart + i * stagger) / 1000,
                duration: RITE_T.charDur / 1000,
                ease: EASE_LIFT,
              }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </p>
        <span className="sr-only">{username}</span>

        {/* Hanko 戦 — se estampa con overshoot en la esquina. */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1.6, rotate: -7 }}
          animate={{ opacity: 1, scale: 1, rotate: -7 }}
          transition={{
            delay: hankoAt / 1000,
            duration: RITE_T.hankoDur / 1000,
            ease: EASE_STAMP,
            opacity: { delay: hankoAt / 1000, duration: 0.07 },
          }}
          className="absolute -bottom-3.5 -right-3.5 grid h-16 w-16 place-items-center rounded-xl border border-white/8 bg-accent text-[34px] text-gold-pale shadow-aura [font-family:var(--font-kanji-serif)]"
        >
          戦
        </motion.div>
      </motion.div>

      <p className="pointer-events-none absolute bottom-9 font-mono text-xs text-fg-muted/60">
        toca para saltar
      </p>
    </div>
  )
}
