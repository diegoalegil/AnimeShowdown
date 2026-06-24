// OracleShrine — el santuario del Oráculo (juego /oraculo).
// Sustituye la card neutra de preguntas por la liturgia completa:
// máscara kitsune levitando, preguntas como tiras omikuji, respuestas
// acumuladas como emas en miniatura y veredicto estampado con hanko.
//
// EL MOTOR DE PREGUNTAS NO SE TOCA: este componente es presentación pura.
// Recibe el estado normalizado del motor por props y devuelve intenciones
// (onAnswer / onRetry / onEnd). Sin fetch, sin estado de negocio.
//
// Reglas de la casa respetadas:
//  · Solo transform/opacity en animaciones; aura = cross-fade de 2 capas
//    pre-pintadas (cero blur, cero SVG filters — jank WebKit).
//  · @keyframes en index.css (CSP por hash); aquí solo clases + custom props.
//  · Bob/aura pausados fuera de viewport (IO) y con pestaña oculta
//    (html.as-tab-hidden, global).
//  · React 19 + Compiler: refs nunca se leen/escriben en render; los
//    timers/observers viven en effects con cleanup completo.
//  · Sonido sintetizado gateado por el mute global de SoundContext.
//  · A11y: live regions, botones ≥44px, foco visible, contraste AA.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSound } from '../../../contexts/SoundContext'
import { playCampanilla, playSello } from '../../../lib/sounds'
import LiveNumber from '../../ranking/components/LiveNumber'
import KitsuneMask from './KitsuneMask'
import { useReducedMotionPref } from '../../../hooks/useReducedMotionPref'
import './oracle-shrine.css'
import { auraCycleFromConfidence } from './oracle-data'

const EASE_LIFT = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Glifos con significado para los emas (nunca japonés de relleno). */
const ANSWER_GLYPHS = { yes: '是', no: '否', unsure: '不明' }

/**
 * @typedef {object} OracleQuestion
 * @property {string} id        Id estable del motor (re-key de la tira).
 * @property {number} ordinal   Número de pregunta (1-based, "第 N 問").
 * @property {string} text      Texto de la pregunta (lo escribe el motor).
 *
 * @typedef {object} OracleAnswerRecord
 * @property {string} id
 * @property {number} ordinal
 * @property {'yes' | 'no' | 'unsure'} value
 *
 * @typedef {object} OracleVerdict
 * @property {{ name: string, slug: string, anime: string }} character
 *   El personaje adivinado. La imagen se resuelve con el patrón canónico
 *   /img/<Anime>/<slug>.webp (ratio 2:3, variantes -300/-600) vía el
 *   helper de brand-assets existente — este componente NO construye URLs.
 * @property {string} imageSrc      URL ya resuelta del arte 2:3.
 * @property {string} [imageSrcSet] srcSet con las variantes -300/-600.
 * @property {boolean | null} outcome  true acierto · false fallo · null aún sin confirmar.
 * @property {number} [accuracy]   Racha real del oráculo 0–100 ("acierta el N%").
 *   Si el backend no la expone, omitir y la línea no se renderiza — NO inventar.
 */

/**
 * @param {object} props
 * @param {'loading' | 'asking' | 'verdict'} props.status Fase que dicta el motor.
 * @param {OracleQuestion | null} props.question Pregunta actual (status='asking').
 * @param {number} props.confidence Confianza REAL del motor, normalizada 0–1.
 *   Único canal de tensión: gobierna la cadencia del aura. Sin barra.
 * @param {OracleAnswerRecord[]} props.history Respuestas dadas — la memoria
 *   visible del interrogatorio (emas). El componente no la muta.
 * @param {OracleVerdict | null} props.verdict Veredicto (status='verdict').
 * @param {(value: 'yes' | 'no' | 'unsure') => void} props.onAnswer
 * @param {() => void} props.onRetry  Reintento honesto tras el fallo.
 * @param {() => void} props.onEnd    Cerrar la partida tras el fallo.
 * @param {string} [props.className]
 */
export default function OracleShrine({
  status,
  question,
  confidence,
  history,
  verdict,
  onAnswer,
  onRetry,
  onEnd,
  className = '',
}) {
  const { muted } = useSound()
  // El mute se consulta en el MOMENTO de sonar (ref): cambiarlo no debe
  // re-ejecutar las ceremonias ni las campanillas.
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])
  const rootRef = useRef(null)
  const stripRef = useRef(null)
  const slotRef = useRef(null)

  // Pausa por viewport: clase en el root, las animaciones CSS la heredan.
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const prefersReduced = useReducedMotionPref()

  // Postura de la máscara: derivada del estado del motor + gesto efímero
  // del "no estoy seguro" (ladeo 4°, vuelve sola a idle).
  const [uncertainTilt, setUncertainTilt] = useState(false)
  useEffect(() => {
    if (!uncertainTilt) return undefined
    const t = setTimeout(() => setUncertainTilt(false), 900)
    return () => clearTimeout(t)
  }, [uncertainTilt])

  // Inclinación previa al sello: al entrar en verdict la máscara hace bow
  // 300ms ANTES de que aparezca la carta (timer one-shot con cleanup).
  const [verdictStage, setVerdictStage] = useState('idle') // idle | bow | card | sealed
  useEffect(() => {
    if (status !== 'verdict' || !verdict) {
      const t = setTimeout(() => setVerdictStage('idle'), 0)
      return () => clearTimeout(t)
    }
    const timers = [
      setTimeout(() => setVerdictStage('bow'), 0),
      setTimeout(() => setVerdictStage('card'), 300),
      setTimeout(() => {
        setVerdictStage('sealed')
        if (verdict.outcome === true && !mutedRef.current) playSello()
      }, 850),
    ]
    return () => timers.forEach(clearTimeout)
  }, [status, verdict])

  // Campanilla por pregunta nueva (gateada por mute global). El primer
  // montaje NO suena: sin gesto previo el AudioContext queda suspendido y
  // la campanilla saldria fantasma al reanudarse mas tarde.
  const questionId = question?.id
  const primeraPreguntaRef = useRef(true)
  useEffect(() => {
    if (status !== 'asking' || !questionId) return
    if (primeraPreguntaRef.current) {
      primeraPreguntaRef.current = false
      return
    }
    if (!mutedRef.current) playCampanilla()
  }, [status, questionId])

  // FLIP de la tira → ema: WAAPI sobre un ghost desmontable. El ema real
  // lo añade el motor en `history`; aquí solo se anima el viaje.
  const [flight, setFlight] = useState(null)
  const flightDoneRef = useRef(null)
  const handleAnswer = useCallback(
    (value) => {
      if (status !== 'asking') return
      if (value === 'unsure') setUncertainTilt(true)
      if (!prefersReduced && stripRef.current && slotRef.current) {
        const from = stripRef.current.getBoundingClientRect()
        const to = slotRef.current.getBoundingClientRect()
        setFlight({ id: `${questionId}-${value}`, glyph: ANSWER_GLYPHS[value], from, to })
      }
      onAnswer(value)
    },
    [status, prefersReduced, questionId, onAnswer],
  )

  const flightRef = useCallback(
    (el) => {
      if (!el || !flight || flightDoneRef.current === flight.id) return
      flightDoneRef.current = flight.id
      const dx = flight.to.left - flight.from.left
      const dy = flight.to.top - flight.from.top
      const anim = el.animate(
        [
          { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy}px) scale(${flight.to.width / flight.from.width}, ${flight.to.height / flight.from.height})`,
            opacity: 0.85,
          },
        ],
        { duration: 350, easing: EASE_LIFT, fill: 'forwards' },
      )
      anim.onfinish = () => setFlight(null)
    },
    [flight],
  )

  const maskPose =
    status === 'verdict' && verdict?.outcome === false
      ? 'sorry'
      : status === 'verdict' && verdictStage !== 'idle'
        ? 'bow'
        : uncertainTilt
          ? 'uncertain'
          : 'idle'

  return (
    <section
      ref={rootRef}
      className={`relative mx-auto w-full max-w-5xl px-6 py-8 ${inView ? '' : 'orc-paused'} ${className}`}
      aria-label="El santuario del oráculo"
    >
      {/* marca de agua kanji al 5% */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-8 select-none font-display font-bold leading-none text-gold/5"
        style={{ fontSize: 'clamp(140px, 24vw, 250px)' }}
        lang="ja"
      >
        占
      </div>

      <div className="relative flex flex-wrap items-start gap-7">
        {/* ── columna del altar ── */}
        <div className="flex min-w-0 flex-1 basis-[480px] flex-col items-center gap-4">
          <div className="relative flex h-[290px] w-80 max-w-full items-center justify-center">
            {/* aura: base tenue + capa fuerte que respira (cadencia = confianza) */}
            <div aria-hidden="true" className="orc-aura absolute left-1/2 top-[47%] h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-55" />
            <div
              aria-hidden="true"
              className="orc-aura orc-aura--strong orc-aura-breathe absolute left-1/2 top-[47%] h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ '--orc-aura-dur': auraCycleFromConfidence(confidence) }}
            />
            <div className="orc-bob relative">
              <KitsuneMask pose={maskPose} glint={verdictStage === 'sealed' && verdict?.outcome === true} />
            </div>
          </div>

          {/* zona de pregunta — live region cortés */}
          <div aria-live="polite" className="flex min-h-[196px] w-full max-w-[460px] flex-col items-center gap-4">
            {status === 'loading' && <StripSkeleton />}

            {status === 'asking' && question && (
              <>
                {/* re-key por pregunta: cada tira se desenrolla de cero */}
                <div key={question.id} ref={stripRef} className="orc-strip orc-strip-paper w-full max-w-[440px] rounded-md px-5 pb-5 pt-4">
                  <div className="orc-strip__text">
                    <div className="mb-3 flex items-center gap-2.5 border-b border-accent/35 pb-2">
                      <span lang="ja" className="font-kanji-serif text-[17px] font-bold text-accent-text">問</span>
                      <span className="font-mono text-2xs text-[color:var(--orc-ink-muted)]">
                        pregunta {String(question.ordinal).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="m-0 font-kanji-serif text-[21px] font-bold leading-snug" style={{ textWrap: 'pretty' }}>
                      {question.text}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {['yes', 'no', 'unsure'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleAnswer(value)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-fg-strong/10 bg-fg-strong/5 px-5 text-sm font-semibold text-fg hover:border-border-gold hover:bg-gold-soft hover:text-gold-bright focus-visible:outline-2 focus-visible:outline-gold"
                    >
                      <span lang="ja" className="font-kanji-serif text-[15px] text-gold">{ANSWER_GLYPHS[value]}</span>
                      {value === 'yes' ? 'Sí' : value === 'no' ? 'No' : 'No estoy seguro'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {status === 'verdict' && verdict && verdictStage !== 'idle' && verdictStage !== 'bow' && (
              <div aria-live="assertive" className="orc-verdict flex flex-col items-center gap-3.5">
                {verdict.outcome !== false ? (
                  <>
                    <p className="m-0 font-kanji-serif text-[21px] font-bold text-fg-strong">Tu personaje es…</p>
                    <div className="relative w-52 rounded-xl border border-border-gold bg-surface shadow-aura-lg" style={{ aspectRatio: '2 / 3' }}>
                      <img
                        src={verdict.imageSrc}
                        srcSet={verdict.imageSrcSet}
                        alt={verdict.character.name}
                        className="as-img-reveal h-full w-full rounded-xl object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-canvas/95 to-transparent px-3 pb-2.5 pt-7 text-center font-mono text-xs text-fg-strong">
                        {verdict.character.name}
                      </div>
                      {verdictStage === 'sealed' && verdict.outcome === true && (
                        <>
                          <div aria-hidden="true" className="orc-seal-ripple absolute -right-3.5 bottom-5 h-[74px] w-[74px] rounded-full border-2 border-hanko/50" />
                          <div
                            role="img"
                            aria-label="Sello de acierto"
                            lang="ja"
                            className="orc-seal orc-seal-face absolute -right-3.5 bottom-5 flex h-[74px] w-[74px] items-center justify-center rounded-full font-kanji-serif text-3xl font-bold text-hanko"
                          >
                            当
                          </div>
                        </>
                      )}
                    </div>
                    {verdictStage === 'sealed' && typeof verdict.accuracy === 'number' && (
                      <p className="m-0 font-mono text-[13px] text-gold-bright">
                        el oráculo acierta el <LiveNumber value={verdict.accuracy} />%
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex max-w-[420px] flex-col items-center gap-3 text-center">
                    <p className="m-0 font-kanji-serif text-[22px] font-bold text-fg-strong">No era.</p>
                    <p className="m-0 text-sm leading-relaxed text-fg-muted" style={{ textWrap: 'pretty' }}>
                      El oráculo baja la mirada y lo admite: el hilo se perdió. Tu personaje sigue ahí —
                      quedan preguntas por tirar.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-1">
                      <button type="button" onClick={onRetry} className="as-button-primary rounded-full px-6 text-sm font-semibold">
                        Seguir preguntando
                      </button>
                      <button type="button" onClick={onEnd} className="as-button-ghost rounded-full px-6 text-sm font-semibold">
                        Terminar aquí
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── memoria del interrogatorio (emas) ── */}
        <aside className="flex min-w-[190px] flex-1 basis-52 flex-col gap-2.5 sm:max-w-[360px]" aria-label="Respuestas acumuladas">
          <div className="flex items-baseline justify-between gap-2">
            <span className="as-kicker">Memoria del interrogatorio</span>
            <span className="font-mono text-2xs text-fg-muted">
              {history.length === 1 ? '1 respuesta' : `${history.length} respuestas`}
            </span>
          </div>
          <div aria-hidden="true" className="orc-beam h-[5px] rounded" />
          <div className="grid min-h-40 content-start gap-x-2.5 gap-y-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))' }}>
            {history.map((rec, i) => (
              <div key={rec.id} className="flex flex-col items-center">
                <div aria-hidden="true" className="h-3 w-px bg-gold/40" />
                <div className={`orc-ema w-full max-w-[86px] ${i === history.length - 1 ? 'orc-ema--fresh' : ''}`}>
                  <span lang="ja" className="font-kanji-serif text-base font-bold leading-tight text-gold-bright">
                    {ANSWER_GLYPHS[rec.value]}
                  </span>
                  <span lang="ja" className="font-mono text-[9px] text-fg-muted">第{rec.ordinal}問</span>
                </div>
              </div>
            ))}
            {/* marcador del siguiente hueco: destino del FLIP */}
            <div ref={slotRef} aria-hidden="true" className="pointer-events-none h-[66px] min-w-[78px] opacity-0" />
          </div>
        </aside>
      </div>

      {/* ghost del FLIP tira→ema (one-shot, desmonta al aterrizar) */}
      {flight && (
        <div
          ref={flightRef}
          aria-hidden="true"
          className="orc-strip-paper pointer-events-none fixed z-30 flex items-center justify-center rounded-md"
          style={{
            left: flight.from.left,
            top: flight.from.top,
            width: flight.from.width,
            height: flight.from.height,
            transformOrigin: '0 0',
          }}
        >
          <span lang="ja" className="font-kanji-serif text-2xl font-bold text-accent-text">{flight.glyph}</span>
        </div>
      )}
    </section>
  )
}

/** Tira en blanco con la piel .skl de la casa — nunca un spinner. */
function StripSkeleton() {
  return (
    <div className="skl h-[104px] w-full max-w-[440px] rounded-lg border border-fg-strong/10 bg-surface p-5">
      <div className="mb-3 h-2.5 w-1/3 rounded-pill bg-gold/15" />
      <div className="mb-2 h-3.5 w-[88%] rounded-pill bg-fg-strong/10" />
      <div className="h-3.5 w-3/5 rounded-pill bg-fg-strong/10" />
    </div>
  )
}
