import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useFocusTrap } from '../../hooks/useFocusTrap'

/**
 * DuelCeremony — ceremonia de cierre del duelo PvP en vivo.
 *
 * Overlay a pantalla: el kanji 勝 (victoria, tinta dorada) o 敗 (derrota,
 * tinta ceniza) se materializa con la disolución fbm de DuelCeremonyInk
 * (R3F, chunk lazy: three solo viaja si hay WebGL y no hay reduced-motion),
 * con salpicaduras carmesí desde el trazo. Debajo, el delta de ELO sube en
 * odómetro mono oro y a los 2,2 s aparece el CTA.
 *
 * Timeline (ms): 0 scrim 120 · 0→900 tinta · 420 salpicaduras · 1120
 * odómetro (900, stagger 90/columna) · 2200 CTA. Tap (≥300 ms) = skip.
 * Fallback (sin WebGL o reduced-motion): kanji estático en 2 capas con
 * crossfade 600 ms, delta sin animar, CTA a 1200 ms.
 */

const DuelCeremonyInk = lazy(() => import('./DuelCeremonyInk'))

const T = {
  ODO_AT: 1120,
  ODO_MS: 900,
  ODO_STAGGER: 90,
  CTA_AT: 2200,
  SKIP_GUARD: 300,
  FB_ODO_AT: 700,
  FB_CTA_AT: 1200,
}

/** Odómetro de columnas: cada dígito es una tira 0-9 desplazada por
 *  transform (composited); el stagger por columna da el "tic" mecánico. */
function Odometer({ value, animate: animado }) {
  const digits = String(Math.abs(value)).padStart(2, '0').split('')
  return (
    <div className="flex font-mono text-[40px] font-bold leading-none text-gold" aria-label={`Delta ELO ${value >= 0 ? '+' : ''}${value}`}>
      <span className="mr-1.5">{value >= 0 ? '+' : '−'}</span>
      {digits.map((d, i) => (
        <span key={i} className="h-[1em] overflow-hidden">
          <span
            className="flex flex-col"
            style={{
              transform: `translateY(-${d}em)`,
              transition: animado ? `transform ${T.ODO_MS}ms cubic-bezier(0.16, 0.84, 0.28, 1) ${i * T.ODO_STAGGER}ms` : 'none',
            }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="h-[1em]">{n}</span>
            ))}
          </span>
        </span>
      ))}
    </div>
  )
}

export default function DuelCeremony({ outcome, delta, ratingBefore, onShare, onDone }) {
  const win = outcome === 'win'
  const glyph = win ? '勝' : '敗'
  const reduced = useReducedMotion()
  const webgl = useMemo(() => {
    try {
      const probe = document.createElement('canvas')
      return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
    } catch {
      return false
    }
  }, [])
  const fallback = reduced || !webgl

  const [odo, setOdo] = useState(0)
  const [labelOn, setLabelOn] = useState(false)
  const [ctaOn, setCtaOn] = useState(false)
  const [skipNonce, setSkipNonce] = useState(0)
  const t0 = useRef(0)
  const timers = useRef([])
  const dialogRef = useRef(null)

  // Contrato a11y de modal (trap de Tab, Escape→onDone, scroll-lock, restore de
  // foco). No reusamos AccessibleDialog: su chrome + puertas shōji romperían la
  // ceremonia (kanji a pantalla + odómetro). El foco inicial va al primer
  // focusable, que es el CTA "Continuar" (antes lo hacía autoFocus).
  useFocusTrap(dialogRef, { onClose: onDone })

  useEffect(() => {
    t0.current = performance.now()
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    if (fallback) {
      at(T.FB_ODO_AT, () => {
        setOdo(delta)
        setLabelOn(true)
      })
      at(T.FB_CTA_AT, () => setCtaOn(true))
    } else {
      at(T.ODO_AT, () => {
        setOdo(delta)
        setLabelOn(true)
      })
      at(T.CTA_AT, () => setCtaOn(true))
    }
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timeline one-shot del mount
  }, [])

  const skip = () => {
    if (performance.now() - t0.current < T.SKIP_GUARD || ctaOn) return
    timers.current.forEach(clearTimeout)
    setSkipNonce((n) => n + 1)
    setOdo(delta)
    setLabelOn(true)
    setCtaOn(true)
  }

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={win ? 'Victoria' : 'Derrota'}
      onClick={skip}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      {/* lavado carmesí solo en derrota — tinte por capa, tokens puros */}
      {!win && <div aria-hidden className="absolute inset-0 bg-accent/15" />}

      <div className="relative size-[300px] max-w-[80vw]">
        {fallback ? (
          <div className="relative size-full" style={{ fontFamily: 'var(--font-kanji-serif)' }}>
            <motion.span
              lang="ja"
              className={`absolute inset-0 grid place-items-center text-[11.5rem] font-black ${win ? 'text-gold' : 'text-fg-muted'}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 0.28, scale: 1.05 }}
              transition={{ duration: 0.6 }}
            >
              {glyph}
            </motion.span>
            <motion.span
              lang="ja"
              className={`absolute inset-0 grid place-items-center text-[11.5rem] font-black ${win ? 'text-gold' : 'text-fg-muted'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {glyph}
            </motion.span>
          </div>
        ) : (
          <Suspense fallback={null}>
            <DuelCeremonyInk glyph={glyph} win={win} skipNonce={skipNonce} />
          </Suspense>
        )}
      </div>

      <motion.p
        className={`mt-1 text-base font-semibold ${win ? 'text-gold' : 'text-fg-muted'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: labelOn ? 1 : 0 }}
        transition={{ duration: 0.24 }}
      >
        {win ? 'Victoria' : 'Derrota'}
      </motion.p>

      <div className="mt-4">
        <Odometer value={odo === 0 ? 0 : delta} animate={!fallback} />
      </div>
      <motion.p
        className="mt-2 font-mono text-xs text-fg/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: labelOn ? 1 : 0 }}
      >
        {ratingBefore} → {ratingBefore + delta}
      </motion.p>

      <motion.div
        className="mt-8 flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: ctaOn ? 1 : 0 }}
        style={{ pointerEvents: ctaOn ? 'auto' : 'none' }}
        transition={{ duration: 0.3 }}
      >
        {/* Loop viral: al GANAR ofrecemos compartir en el pico de emoción (el
            share lleva la tarjeta OG del duelo). El foco inicial cae aquí en
            victoria — nudge a compartir; en derrota no se muestra. */}
        {win && typeof onShare === 'function' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onShare()
            }}
            className="min-h-11 rounded-xl border border-gold/40 px-6 text-sm font-semibold text-gold transition-colors hover:border-gold/70 hover:bg-gold/10"
          >
            Compartir victoria
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDone()
          }}
          className="min-h-11 rounded-xl border border-fg/25 px-7 text-sm font-semibold text-fg transition-colors hover:border-fg/50"
        >
          Continuar
        </button>
      </motion.div>
      <p className="absolute bottom-4 font-mono text-[10px] text-fg/30">toca para saltar</p>
    </motion.div>
  )
}
