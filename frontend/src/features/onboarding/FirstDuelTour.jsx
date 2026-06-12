import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PAD, TOUR_STEPS, ringClip, setGate } from './tour-core'

/**
 * FirstDuelTour — el onboarding de primera visita como combate guiado.
 *
 * Overlay spotlight que recorta el target REAL de la UI (clip-path sobre el
 * elemento vivo, telón oscuro alrededor) y guía 4 pasos: votar el primer
 * duelo, ver moverse el ranking, la primera moneda y el sobre de bienvenida
 * (el modal de PackOpening toma el relevo y el tour muere ahí).
 *
 * Decisiones clave (spec del canvas):
 *  - Sin librería nueva: DOM puro + getBoundingClientRect + clip-path.
 *  - El recorte hace morph por PASOS DISCRETOS: una transition de clip-path
 *    (mismo nº de vértices → interpola); nada se anima por frame, no hay
 *    rAF vivo ni blur/backdrop-filter nuevos.
 *  - El telón es pointer-events:none → el target real sigue operable; los
 *    pasos 1 y 4 avanzan por la ACCIÓN real (CustomEvents de app-events).
 *  - Montado solo cuando OnboardingGate decide que hay candidato; este
 *    componente asume tour activo y sale vía onExit('done'|'skipped').
 *  - Accesible: role=dialog no modal, focus-trap suave en la guía,
 *    Escape = saltar; prefers-reduced-motion → transiciones fuera.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

function FirstDuelTour({ onExit }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const ctxRef = useRef({ votedSlug: null })
  const coachRef = useRef(null)
  const measureTimer = useRef(null)
  const advanceTimer = useRef(null)
  const scrolledStepRef = useRef(-1)

  const stepDef = TOUR_STEPS[step]

  const exit = useCallback(
    (valor) => {
      setGate(valor)
      onExit?.(valor)
    },
    [onExit],
  )

  // ---- medición del target (coords de viewport; el overlay es fixed) ----
  const measure = useCallback(() => {
    const sel =
      typeof stepDef.target === 'function'
        ? stepDef.target(ctxRef.current)
        : stepDef.target
    const el = sel ? document.querySelector(sel) : null
    if (!el) {
      setRect(null)
      return
    }
    // Acerca el target UNA vez por paso si quedó fuera del viewport (p. ej.
    // la fila del ranking del personaje votado).
    const t = el.getBoundingClientRect()
    if (scrolledStepRef.current !== step && (t.top < 0 || t.bottom > window.innerHeight)) {
      scrolledStepRef.current = step
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
      return // la re-medición llega con scrollend/debounce
    }
    setRect({ x: t.left - PAD, y: t.top - PAD, w: t.width + PAD * 2, h: t.height + PAD * 2 })
  }, [step, stepDef])

  // Medir tras el render del paso, en resize y al ASENTARSE el scroll
  // (scrollend con fallback debounce). Nunca por frame.
  useEffect(() => {
    const settle = () => {
      clearTimeout(measureTimer.current)
      measureTimer.current = setTimeout(measure, 120)
    }
    measure()
    // Reintentos cortos: el target puede montar tras la navegación (ruta lazy).
    const retries = [150, 400, 900].map((ms) => setTimeout(measure, ms))
    window.addEventListener('resize', settle)
    window.addEventListener('scrollend', settle)
    window.addEventListener('scroll', settle, { passive: true })
    return () => {
      retries.forEach(clearTimeout)
      clearTimeout(measureTimer.current)
      window.removeEventListener('resize', settle)
      window.removeEventListener('scrollend', settle)
      window.removeEventListener('scroll', settle)
    }
  }, [measure, location.pathname])

  // ---- navegación entre pasos ----
  const goTo = useCallback(
    (next) => {
      const def = TOUR_STEPS[next]
      if (!def) return
      const route = typeof def.route === 'function' ? def.route(ctxRef.current) : def.route
      if (route && route !== location.pathname + location.search) navigate(route)
      setStep(next)
    },
    [location.pathname, location.search, navigate],
  )

  // ---- avance por acción real ----
  useEffect(() => {
    if (!stepDef.advanceOn) return undefined
    const onEvent = (e) => {
      if (stepDef.id === 'duelo') {
        ctxRef.current.votedSlug = e.detail?.slug ?? null
        // Deja respirar el feedback del voto antes de mover el foco.
        clearTimeout(advanceTimer.current)
        advanceTimer.current = setTimeout(() => goTo(1), 1200)
      } else if (stepDef.id === 'sobre') {
        exit('done')
      }
    }
    window.addEventListener(stepDef.advanceOn, onEvent)
    return () => {
      clearTimeout(advanceTimer.current)
      window.removeEventListener(stepDef.advanceOn, onEvent)
    }
  }, [stepDef, goTo, exit])

  // ---- teclado: Escape salta; focus-trap suave dentro de la guía ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        exit('skipped')
        return
      }
      if (e.key !== 'Tab' || !coachRef.current) return
      const nodes = coachRef.current.querySelectorAll(FOCUSABLE)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [exit])

  // Foco inicial en la guía a cada paso (sin scroll jump).
  useEffect(() => {
    coachRef.current?.focus({ preventScroll: true })
  }, [step])

  const clip = useMemo(() => ringClip(rect), [rect])

  const isLast = step === TOUR_STEPS.length - 1

  return (
    <>
      {/* Telón con recorte. pointer-events:none → el target real sigue vivo.
          El morph entre pasos es UNA transition de clip-path (discreta). */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[90] bg-canvas/80 motion-safe:transition-[clip-path] motion-safe:duration-400 motion-safe:ease-lift"
        style={{ clipPath: clip, pointerEvents: 'none' }}
      />
      {/* Marco hairline dorado sobre el recorte (el radio que el polygon no da). */}
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[90] rounded-xl border border-border-gold shadow-aura motion-safe:transition-all motion-safe:duration-400 motion-safe:ease-lift"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        />
      )}

      {/* Guía: bottom sheet fijo (mobile-first, nunca tapa el recorte). */}
      <div
        ref={coachRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Combate guiado, paso ${step + 1} de 4: ${stepDef.title}`}
        tabIndex={-1}
        className="inset-shadow-hairline fixed inset-x-3 bottom-3 z-[100] mx-auto w-auto max-w-xl rounded-2xl border border-border bg-bg p-4 shadow-elev-2 outline-none sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="font-kanji-serif text-shadow-glow-sm shrink-0 text-[2.1rem] font-black leading-none text-accent-text"
          >
            {stepDef.kanji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold text-fg-strong">{stepDef.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-5 text-fg-muted">{stepDef.desc}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
          <div className="flex items-center gap-2.5">
            {/* Progreso: 4 puntos de tinta que se van entintando. */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {TOUR_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-[11px] w-[11px] rounded-full border transition-colors motion-safe:duration-300 ${
                    i < step
                      ? 'border-gold bg-gold'
                      : i === step
                        ? 'border-gold bg-gold-soft'
                        : 'border-border bg-transparent'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono text-2xs text-fg-muted">{step + 1} / 4</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exit('skipped')}
              className="min-h-11 rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted underline decoration-border underline-offset-3 hover:text-fg"
            >
              Saltar el tour
            </button>
            {!isLast ? (
              <button
                type="button"
                onClick={() => goTo(step + 1)}
                className="min-h-11 rounded-lg border border-border-gold bg-gold-soft px-4 text-[12.5px] font-extrabold text-gold transition-colors hover:border-gold"
              >
                Siguiente →
              </button>
            ) : (
              <span className="font-mono text-2xs font-bold text-gold">↑ Púlsalo — es gratis</span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default FirstDuelTour
