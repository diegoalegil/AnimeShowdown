import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, FastForward, RotateCcw, X } from 'lucide-react'
import Button from '../../components/Button'
import MonedaIcon from '../../components/MonedaIcon'
import { useSound } from '../../contexts/SoundContext'
import CartaTile from '../../components/CartaTile'
import CartaFace from './CartaFace'
import './cartas.css'
import { EASE_LIFT } from '../../lib/motion'

const PACK_TIMING = {
  peel: 720,
  rip: 1180,
  autoFlipNormal: 420,
  autoCollectNormal: 1580,
  revealDingDelay: 340,
  collect: 430,
  nextDelay: 120,
  flash: 620,
  flashSpecial: 920,
}

const BURST_COLOR_TOKENS = {
  special: ['var(--pack-burst-special-primary)', 'var(--pack-burst-special-secondary)'],
  top: ['var(--pack-burst-top-primary)', 'var(--pack-burst-top-secondary)'],
  base: ['var(--pack-burst-base-primary)', 'var(--pack-burst-base-secondary)'],
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function normalizarCartas(reveal) {
  const raw = Array.isArray(reveal?.cartas) && reveal.cartas.length > 0
    ? reveal.cartas
    : reveal?.carta
      ? [{
          posicion: 1,
          carta: reveal.carta,
          nueva: reveal.nueva,
          recompensaDuplicado: 0,
          climax: reveal.especial ? 'ESPECIAL' : 'TOP',
        }]
      : []

  return raw.map((item, index) => ({
    ...item,
    posicion: item.posicion ?? index + 1,
    climax: normalizarClimax(item, index, raw, reveal),
  }))
}

function normalizarClimax(item, index, allItems, reveal) {
  const raw = String(item?.climax ?? '').toUpperCase()
  if (['ESPECIAL', 'SPECIAL', 'UR'].includes(raw)) return 'ESPECIAL'
  if (['TOP', 'CLIMAX', 'CLÍMAX', 'SSR'].includes(raw)) return 'TOP'
  if (raw === 'NORMAL') return 'NORMAL'
  if (item?.carta?.rareza === 'ESPECIAL' || item?.carta?.especialCurada) return 'ESPECIAL'
  if (index === allItems.length - 1) return reveal?.especial ? 'ESPECIAL' : 'TOP'
  return 'NORMAL'
}

function packLevel(cartas, reveal) {
  if (reveal?.especial || cartas.some((item) => item.climax === 'ESPECIAL')) return 'special'
  return 'top'
}

function revealLabel(item) {
  if (item?.climax === 'ESPECIAL') {
    return { key: '¡ESPECIAL!', sub: 'UR · ARTE DE AUTOR · WALKOUT' }
  }
  if (item?.climax === 'TOP') {
    return { key: 'CARTA TOP', sub: 'FOIL ORO · CLIMAX DEL SOBRE' }
  }
  return {
    key: item?.carta?.rareza === 'ESPECIAL' ? 'UR' : item?.carta?.rareza ?? 'SSR',
    sub: item?.nueva ? 'NUEVA CARTA' : 'DUPLICADA',
  }
}

function playRevealSound(play, item) {
  if (item?.climax === 'ESPECIAL') {
    play('playPackRevealSpecial')
    return
  }
  if (item?.climax === 'TOP') {
    play('playPackRevealTop')
    return
  }
  play('playPackRevealNormal')
}

function PackOpening({
  reveal,
  puedeAbrirOtro,
  abriendo,
  onAbrirOtro,
  onCerrar,
  onDownload,
  descargandoId = null,
  permitirAbrirOtro = true,
  hook = null,
  timing = PACK_TIMING,
}) {
  const { play, warm } = useSound()
  const reduceMotion = useReducedMotion()
  const cartas = useMemo(() => normalizarCartas(reveal), [reveal])
  const level = packLevel(cartas, reveal)
  const totalDuplicados = reveal?.monedasDuplicados ?? 0
  const [phase, setPhase] = useState(reduceMotion ? 'summary' : 'idle')
  const [activeIndex, setActiveIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [collected, setCollected] = useState([])
  const [flash, setFlash] = useState(null)
  const [shake, setShake] = useState(null)

  const timersRef = useRef([])
  const phaseRef = useRef(phase)
  const activeIndexRef = useRef(activeIndex)
  const revealedRef = useRef(revealed)
  const leavingRef = useRef(leaving)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])
  useEffect(() => { revealedRef.current = revealed }, [revealed])
  useEffect(() => { leavingRef.current = leaving }, [leaving])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
  }, [])

  const after = useCallback((ms, fn) => {
    const timer = setTimeout(fn, ms)
    timersRef.current.push(timer)
    return timer
  }, [])

  const triggerFlash = useCallback((kind = 'top') => {
    setFlash({ key: Date.now(), kind })
    after(kind === 'special' ? timing.flashSpecial : timing.flash, () => setFlash(null))
  }, [after, timing.flash, timing.flashSpecial])

  const triggerShake = useCallback((kind = 'top') => {
    setShake(kind)
    after(kind === 'special' ? 980 : 420, () => setShake(null))
  }, [after])

  const startReveal = useCallback(() => {
    if (cartas.length === 0) {
      setPhase('summary')
      return
    }
    activeIndexRef.current = 0
    revealedRef.current = false
    leavingRef.current = false
    setActiveIndex(0)
    setRevealed(false)
    setLeaving(false)
    setPhase('reveal')
  }, [cartas.length])

  const beginRip = useCallback(() => {
    if (phaseRef.current !== 'peel') return
    clearTimers()
    setPhase('rip')
    play('playPackTear')
    triggerFlash(level === 'special' ? 'special' : 'top')
    triggerShake(level === 'special' ? 'special' : 'top')
    after(timing.rip, startReveal)
  }, [after, clearTimers, level, play, startReveal, timing.rip, triggerFlash, triggerShake])

  const beginPeel = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    warm?.()
    clearTimers()
    activeIndexRef.current = 0
    revealedRef.current = false
    leavingRef.current = false
    setCollected([])
    setActiveIndex(0)
    setRevealed(false)
    setLeaving(false)
    setPhase('peel')
    play('playPackCharge')
    after(timing.peel, beginRip)
  }, [after, beginRip, clearTimers, play, timing.peel, warm])

  const revealCurrent = useCallback(() => {
    if (phaseRef.current !== 'reveal' || revealedRef.current) return
    const item = cartas[activeIndexRef.current]
    if (!item) return

    revealedRef.current = true
    setRevealed(true)
    play('playPackFlip')
    after(timing.revealDingDelay, () => {
      playRevealSound(play, item)
      if (item.climax === 'ESPECIAL') {
        triggerFlash('special')
        triggerShake('special')
      } else if (item.climax === 'TOP') {
        triggerFlash('top')
        triggerShake('top')
      }
    })
  }, [after, cartas, play, timing.revealDingDelay, triggerFlash, triggerShake])

  const collectCurrent = useCallback(() => {
    if (
      phaseRef.current !== 'reveal' ||
      !revealedRef.current ||
      leavingRef.current
    ) return
    const index = activeIndexRef.current
    const item = cartas[index]
    if (!item) return

    leavingRef.current = true
    setLeaving(true)
    play('playPackCollect')
    after(timing.collect, () => {
      setCollected((current) => {
        if (current.some((saved) => saved.posicion === item.posicion)) return current
        return [...current, item]
      })
      leavingRef.current = false
      setLeaving(false)
      if (index >= cartas.length - 1) {
        setPhase('summary')
        return
      }
      after(timing.nextDelay, () => {
        activeIndexRef.current = index + 1
        revealedRef.current = false
        setActiveIndex(index + 1)
        setRevealed(false)
      })
    })
  }, [after, cartas, play, timing.collect, timing.nextDelay])

  const skipAll = useCallback(() => {
    if (phaseRef.current === 'summary') return
    clearTimers()
    setFlash(null)
    setShake(null)
    leavingRef.current = false
    revealedRef.current = false
    setLeaving(false)
    setRevealed(false)
    setCollected(cartas)
    setPhase('summary')
    const last = cartas[cartas.length - 1]
    if (last) playRevealSound(play, last)
  }, [cartas, clearTimers, play])

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    if (phase !== 'reveal' || reduceMotion) return undefined
    const item = cartas[activeIndex]
    if (!item || item.climax !== 'NORMAL') return undefined
    const flipTimer = after(timing.autoFlipNormal, revealCurrent)
    return () => {
      clearTimeout(flipTimer)
    }
  }, [
    activeIndex,
    after,
    cartas,
    phase,
    reduceMotion,
    revealCurrent,
    timing.autoFlipNormal,
  ])

  useEffect(() => {
    if (phase !== 'reveal' || reduceMotion || !revealed || leaving) return undefined
    const item = cartas[activeIndex]
    if (!item || item.climax !== 'NORMAL') return undefined
    const collectTimer = after(timing.autoCollectNormal, collectCurrent)
    return () => clearTimeout(collectTimer)
  }, [
    activeIndex,
    after,
    cartas,
    collectCurrent,
    leaving,
    phase,
    reduceMotion,
    revealed,
    timing.autoCollectNormal,
  ])

  const activeItem = phase === 'reveal' ? cartas[activeIndex] : null
  const showSkip = phase !== 'idle' && phase !== 'summary'

  return (
    <div
      className={cx(
        'pack-opening',
        level === 'special' ? 'pack-opening--special' : 'pack-opening--top',
        shake && 'pack-opening--shake',
        shake === 'special' && 'pack-opening--shake-special',
      )}
    >
      <h2 id="reveal-cartas-title" className="sr-only">
        Apertura de sobre
      </h2>

      <div className="pack-opening__stage" aria-live="polite">
        <div className="pack-opening__brand" aria-hidden="true">
          <span>A</span>
          <strong>ANIME<b>SHOWDOWN</b></strong>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'idle' || phase === 'peel' || phase === 'rip' ? (
            <motion.div
              key="pack"
              className="pack-opening__pack-scene"
              initial={{ opacity: 0, y: 28, scale: 0.94, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -30, scale: 1.08, rotateX: -12 }}
              transition={{ duration: 0.42, ease: EASE_LIFT }}
            >
              <PackEnvelope
                phase={phase}
                level={level}
                onTap={phase === 'idle' ? beginPeel : beginRip}
              />
            </motion.div>
          ) : phase === 'reveal' && activeItem ? (
            <RevealStage
              key={`reveal-${activeItem.posicion}`}
              item={activeItem}
              index={activeIndex}
              total={cartas.length}
              remaining={Math.max(0, cartas.length - activeIndex - 1)}
              revealed={revealed}
              leaving={leaving}
              reduceMotion={reduceMotion}
              onReveal={revealCurrent}
              onContinue={collectCurrent}
            />
          ) : (
            <SummaryStage
              key="summary"
              reveal={reveal}
              cartas={cartas}
              totalDuplicados={totalDuplicados}
              puedeAbrirOtro={puedeAbrirOtro}
              abriendo={abriendo}
              onAbrirOtro={onAbrirOtro}
              onCerrar={onCerrar}
              onDownload={onDownload}
              descargandoId={descargandoId}
              permitirAbrirOtro={permitirAbrirOtro}
              hook={hook}
            />
          )}
        </AnimatePresence>

        {phase === 'idle' || phase === 'peel' ? (
          <button
            type="button"
            className="pack-opening__open-btn"
            onClick={phase === 'idle' ? beginPeel : beginRip}
          >
            <span className="pack-opening__open-glow" />
            <span>{phase === 'idle' ? 'Rasgar sobre' : 'Toca para rasgar'}</span>
          </button>
        ) : null}

        {showSkip && (
          <button type="button" className="pack-opening__skip" onClick={skipAll}>
            <FastForward className="h-4 w-4" aria-hidden="true" />
            Saltar
          </button>
        )}

        {phase !== 'summary' && (
          <PackCollection cards={collected} total={cartas.length} />
        )}

        {flash && (
          <div
            key={flash.key}
            className={cx('pack-opening__flash', flash.kind === 'special' && 'is-special')}
          />
        )}
      </div>
    </div>
  )
}

function PackEnvelope({ phase, level, onTap }) {
  const falls = useMemo(() => Array.from({ length: 42 }, (_, i) => ({
    left: 4 + ((i * 23) % 92),
    delay: ((i * 7) % 19) / 20,
    dur: 0.9 + ((i * 5) % 9) / 10,
    size: 3 + (i % 6),
    drift: -34 + ((i * 17) % 68),
    kind: i % 5 === 0 ? 'gold' : i % 3 === 0 ? 'spark' : 'red',
  })), [])
  const petals = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
    left: 8 + ((i * 19) % 82),
    top: 14 + ((i * 13) % 70),
    delay: ((i * 11) % 23) / 10,
    dur: 5 + (i % 4),
    drift: -28 + ((i * 31) % 56),
    rot: (i * 47) % 360,
  })), [])

  return (
    <div className="pack-opening__pack-wrap">
      <div className="pack-opening__pack-glow" />
      <button
        type="button"
        className={cx(
          'pack-opening__pack3d',
          `pack-opening__pack3d--${phase}`,
          level === 'special' && 'pack-opening__pack3d--special',
        )}
        onClick={onTap}
        aria-label={phase === 'idle' ? 'Sobre premium, toca para rasgar' : 'Rasgar ahora'}
      >
        <div className="pack-opening__foil">
          <div className="pack-opening__foil-ink" />
          <div className="pack-opening__foil-sheen" />
        </div>

        <div className="pack-opening__crimp pack-opening__crimp--top">
          <div className="pack-opening__crimp-teeth" />
          <div className="pack-opening__crimp-band" />
        </div>
        <div className="pack-opening__crimp pack-opening__crimp--bottom">
          <div className="pack-opening__crimp-band" />
          <div className="pack-opening__crimp-teeth" />
        </div>

        <div className="pack-opening__pack-content">
          <div className="pack-opening__pack-logo">
            <i />
            <span>ANIME<b>SHOWDOWN</b></span>
          </div>
          <div className="pack-opening__jp">アニメの戦い</div>
          <div className="pack-opening__pack-title">
            <span>SOBRE</span>
            <strong>PREMIUM</strong>
            <em>JUEGO DE CARTAS COLECCIONABLES</em>
          </div>
          <div className="pack-opening__seal">
            <span>封</span>
          </div>
        </div>

        <div className="pack-opening__petals">
          {petals.map((petal, index) => (
            <span
              key={index}
              className="pack-opening__petal"
              style={{
                left: `${petal.left}%`,
                top: `${petal.top}%`,
                '--petal-drift': `${petal.drift}px`,
                animationDelay: `${petal.delay}s`,
                animationDuration: `${petal.dur}s`,
                transform: `rotate(${petal.rot}deg)`,
              }}
            />
          ))}
        </div>

        <div className="pack-opening__inner-glow" />
        <div className="pack-opening__exhale" />
        <div className="pack-opening__beam" />
        <div className="pack-opening__top-strip">
          <div className="pack-opening__crimp pack-opening__crimp--top">
            <div className="pack-opening__crimp-teeth" />
            <div className="pack-opening__crimp-band" />
          </div>
        </div>
        <div className="pack-opening__rip-line" />

        <div className="pack-opening__fall">
          {falls.map((fall, index) => (
            <span
              key={index}
              className={`pack-opening__fall-bit pack-opening__fall-bit--${fall.kind}`}
              style={{
                left: `${fall.left}%`,
                width: `${fall.size}px`,
                height: `${fall.size}px`,
                '--fall-drift': `${fall.drift}px`,
                animationDelay: `${fall.delay}s`,
                animationDuration: `${fall.dur}s`,
              }}
            />
          ))}
        </div>
      </button>
    </div>
  )
}

function RevealStage({
  item,
  index,
  total,
  remaining,
  revealed,
  leaving,
  reduceMotion,
  onReveal,
  onContinue,
}) {
  const label = revealLabel(item)
  const isSpecial = item.climax === 'ESPECIAL'
  const isTop = item.climax === 'TOP'
  const isAuto = item.climax === 'NORMAL'

  return (
    <motion.div
      className={cx(
        'pack-opening__reveal',
        isTop && 'pack-opening__reveal--top',
        isSpecial && 'pack-opening__reveal--special',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -22 }}
      transition={{ duration: 0.3, ease: EASE_LIFT }}
    >
      {revealed && !reduceMotion && isSpecial && (
        <Confetti count={68} />
      )}

      <div className="pack-opening__counter">{index + 1} / {total}</div>

      <div className="pack-opening__deck" aria-hidden="true">
        {Array.from({ length: remaining }).map((_, i) => (
          <div
            key={i}
            className="pack-opening__deck-card"
            style={{
              '--deck-i': i + 1,
            }}
          >
            <CardBack />
          </div>
        ))}
      </div>

      <motion.button
        type="button"
        className={cx(
          'pack-opening__card-shell',
          revealed && 'is-revealed',
          leaving && 'is-leaving',
          isTop && 'is-top',
          isSpecial && 'is-special',
        )}
        onClick={revealed ? onContinue : onReveal}
        aria-label={revealed ? 'Guardar carta' : `Revelar carta ${index + 1}`}
        initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
        animate={{
          opacity: leaving ? 0 : 1,
          scale: leaving ? 0.28 : revealed && isSpecial ? 1.16 : revealed && isTop ? 1.08 : 1,
          y: leaving ? 180 : 0,
          rotateY: 0,
        }}
        transition={{
          duration: leaving ? 0.42 : isSpecial ? 0.72 : 0.44,
          ease: EASE_LIFT,
        }}
      >
        <div className="pack-opening__flip">
          <div className="pack-opening__flip-front">
            <CardBack />
          </div>
          <div className="pack-opening__flip-back" aria-hidden={!revealed}>
            <CartaFace carta={item.carta} eager reveal />
          </div>
        </div>
        {revealed && !reduceMotion && (
          <Burst
            special={isSpecial}
            top={isTop}
            count={isSpecial ? 58 : isTop ? 34 : 18}
          />
        )}
      </motion.button>

      <AnimatePresence mode="wait">
        {revealed ? (
          <motion.div
            key={`tier-${item.posicion}`}
            className={cx(
              'pack-opening__tier',
              isTop && 'pack-opening__tier--top',
              isSpecial && 'pack-opening__tier--special',
            )}
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: EASE_LIFT }}
          >
            <strong>{label.key}</strong>
            <span>{label.sub}</span>
          </motion.div>
        ) : (
          <motion.p
            key="prompt"
            className="pack-opening__prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isAuto ? 'Revelando carta...' : 'Toca la carta para revelar'}
          </motion.p>
        )}
      </AnimatePresence>

      {revealed && !leaving && (
        <button type="button" className="pack-opening__next" onClick={onContinue}>
          {index === total - 1 ? 'Ver resumen' : 'Siguiente carta'}
        </button>
      )}
    </motion.div>
  )
}

function CardBack() {
  return (
    <div className="pack-opening__card-back">
      <div className="pack-opening__card-back-mark">A</div>
      <div className="pack-opening__card-back-label">ANIMESHOWDOWN</div>
      <span className="pack-opening__corner pack-opening__corner--tl" />
      <span className="pack-opening__corner pack-opening__corner--tr" />
      <span className="pack-opening__corner pack-opening__corner--bl" />
      <span className="pack-opening__corner pack-opening__corner--br" />
    </div>
  )
}

function PackCollection({ cards, total }) {
  return (
    <div className="pack-opening__collection" aria-hidden="true">
      {Array.from({ length: total }).map((_, index) => {
        const item = cards[index]
        return (
          <div
            key={item ? `${item.posicion}-${item.carta.id}` : index}
            className={cx('pack-opening__slot', item && 'is-filled')}
          >
            {item ? (
              <CartaFace carta={item.carta} eager={index === 0} className="pack-opening__slot-card" />
            ) : (
              <span>{index + 1}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Burst({ count, special = false, top = false }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + ((i * 17) % 21) / 40
    const radius = (special ? 190 : top ? 140 : 96) + ((i * 29) % (special ? 210 : 120))
    const palette = special
      ? BURST_COLOR_TOKENS.special
      : top
        ? BURST_COLOR_TOKENS.top
        : BURST_COLOR_TOKENS.base
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: (special ? 5 : 3) + (i % (special ? 9 : 6)),
      delay: ((i * 13) % 12) / 100,
      dur: 0.62 + ((i * 7) % 9) / 10,
      colorToken: palette[i % palette.length],
      round: i % 4 === 0 ? '0' : '999px',
    }
  }), [count, special, top])

  return (
    <div className="pack-opening__burst" aria-hidden="true">
      {bits.map((bit, index) => (
        <span
          key={index}
          className="pack-opening__burst-bit"
          style={{
            '--burst-x': `${bit.x}px`,
            '--burst-y': `${bit.y}px`,
            '--burst-size': `${bit.size}px`,
            '--burst-shadow-size': `${bit.size * 2}px`,
            '--burst-color': bit.colorToken,
            borderRadius: bit.round,
            animationDelay: `${bit.delay}s`,
            animationDuration: `${bit.dur}s`,
          }}
        />
      ))}
    </div>
  )
}

function Confetti({ count }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 11) % 28) / 100,
    dur: 1.45 + ((i * 7) % 16) / 10,
    hue: (i * 29) % 360,
    size: 5 + (i % 8),
    rot: (i * 43) % 360,
  })), [count])

  return (
    <div className="pack-opening__confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="pack-opening__confetti-bit"
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size * 1.75}px`,
            '--confetti-hue': String(piece.hue),
            transform: `rotate(${piece.rot}deg)`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.dur}s`,
          }}
        />
      ))}
    </div>
  )
}

function SummaryStage({
  reveal,
  cartas,
  totalDuplicados,
  puedeAbrirOtro,
  abriendo,
  onAbrirOtro,
  onCerrar,
  onDownload,
  descargandoId,
  permitirAbrirOtro,
  hook,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_LIFT }}
      className="pack-opening__summary"
    >
      <div className="pack-opening__summary-heading">
        <p>Sobre completado</p>
        <h3>Resumen del sobre</h3>
      </div>
      <div className="pack-opening__summary-grid">
        {cartas.map((item) => (
          <div key={`${item.posicion}-${item.carta.id}`} className="pack-opening__summary-item">
            <CartaTile
              carta={item.carta}
              eager={item.posicion === 1}
              onDownload={onDownload}
              downloading={descargandoId === item.carta.id}
            />
            <span className="pack-opening__summary-chip">
              {item.nueva ? 'Nueva' : `Duplicada +${item.recompensaDuplicado}`}
            </span>
          </div>
        ))}
      </div>
      <PackOpeningFooter
        reveal={reveal}
        totalDuplicados={totalDuplicados}
        puedeAbrirOtro={puedeAbrirOtro}
        abriendo={abriendo}
        onAbrirOtro={onAbrirOtro}
        onCerrar={onCerrar}
        permitirAbrirOtro={permitirAbrirOtro}
        hook={hook}
      />
    </motion.div>
  )
}

function PackOpeningFooter({
  reveal,
  totalDuplicados,
  puedeAbrirOtro,
  abriendo,
  onAbrirOtro,
  onCerrar,
  permitirAbrirOtro,
  hook,
}) {
  return (
    <div className="pack-opening__footer">
      <div className="pack-opening__result-row">
        <span className="inline-flex items-center gap-1.5">
          <MonedaIcon className="h-4 w-4 text-gold" />
          Saldo {reveal.saldoRestante}
        </span>
        {totalDuplicados > 0 && (
          <span className="inline-flex items-center gap-1.5 text-gold">
            <Check className="h-4 w-4" aria-hidden="true" />
            Duplicados +{totalDuplicados}
          </span>
        )}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        {permitirAbrirOtro && (
          <Button onClick={onAbrirOtro} disabled={!puedeAbrirOtro} className="flex-1">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {abriendo ? 'Abriendo...' : 'Abrir otro'}
          </Button>
        )}
        <Button variant="secondary" onClick={onCerrar} className="flex-1">
          <X className="h-4 w-4" aria-hidden="true" />
          Cerrar
        </Button>
      </div>
      {hook?.to && (
        <Link
          to={hook.to}
          onClick={onCerrar}
          className="inline-flex items-center justify-center gap-1.5 text-[13px] font-bold text-electric transition hover:text-gold"
        >
          {hook.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export default PackOpening
