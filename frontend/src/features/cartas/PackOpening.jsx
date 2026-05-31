import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import Button from '../../components/Button'
import MonedaIcon from '../../components/MonedaIcon'
import { useSound } from '../../contexts/SoundContext'
import CartaTile from '../../components/CartaTile'
import './cartas.css'

const PACK_TIMING = {
  charge: 220,
  tear: 860,
  firstReveal: 1120,
  normalStep: 780,
  climaxStep: 1160,
  summaryNormal: 1180,
  summarySpecial: 1680,
}

function normalizarCartas(reveal) {
  if (Array.isArray(reveal?.cartas) && reveal.cartas.length > 0) return reveal.cartas
  if (reveal?.carta) {
    return [{
      posicion: 1,
      carta: reveal.carta,
      nueva: reveal.nueva,
      recompensaDuplicado: 0,
      climax: reveal.especial ? 'ESPECIAL' : 'TOP',
    }]
  }
  return []
}

function playRevealSound(play, item) {
  if (item?.climax === 'ESPECIAL') {
    play('playLevelUp')
    setTimeout(() => play('playImpact'), 180)
    return
  }
  if (item?.climax === 'TOP') {
    play('playMagic')
    return
  }
  play('playClick')
}

function PackOpening({
  reveal,
  puedeAbrirOtro,
  abriendo,
  onAbrirOtro,
  onCerrar,
  onDownload,
  descargandoId = null,
  timing = PACK_TIMING,
}) {
  const { play } = useSound()
  const reduceMotion = useReducedMotion()
  const cartas = useMemo(() => normalizarCartas(reveal), [reveal])
  const [phase, setPhase] = useState(reduceMotion ? 'summary' : 'charging')
  const [activeIndex, setActiveIndex] = useState(reduceMotion ? Math.max(0, cartas.length - 1) : -1)
  const activeItem = activeIndex >= 0 ? cartas[activeIndex] : null
  const totalDuplicados = reveal?.monedasDuplicados ?? 0
  const especial = Boolean(reveal?.especial)

  useEffect(() => {
    if (!reveal || cartas.length === 0) return undefined
    const timers = []

    if (reduceMotion) {
      return undefined
    }

    play('playWhoosh')

    timers.push(setTimeout(() => {
      setPhase('tearing')
      play('playImpact')
    }, timing.charge))

    timers.push(setTimeout(() => {
      setPhase('reveal')
      setActiveIndex(0)
      playRevealSound(play, cartas[0])
    }, timing.firstReveal))

    let cursor = timing.firstReveal
    for (let index = 1; index < cartas.length; index++) {
      cursor += index === cartas.length - 1 ? timing.climaxStep : timing.normalStep
      timers.push(setTimeout(() => {
        setActiveIndex(index)
        playRevealSound(play, cartas[index])
      }, cursor))
    }

    timers.push(setTimeout(() => {
      setPhase('summary')
    }, cursor + (especial ? timing.summarySpecial : timing.summaryNormal)))

    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [cartas, especial, play, reduceMotion, reveal, timing])

  return (
    <div className={especial ? 'pack-opening pack-opening--special' : 'pack-opening'}>
      <h2 id="reveal-cartas-title" className="sr-only">
        Apertura de sobre
      </h2>
      <div className="pack-opening__stage" aria-live="polite">
        <AnimatePresence mode="wait">
          {phase === 'charging' || phase === 'tearing' ? (
            <motion.div
              key={phase}
              initial={{ opacity: 0, scale: 0.94, rotateX: 8 }}
              animate={{ opacity: 1, scale: 1, rotateX: phase === 'tearing' ? -8 : 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -12 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className={`pack-opening__pack pack-opening__pack--${phase}`}
            >
              <div className="pack-opening__foil">
                <span className="pack-opening__seal">AS</span>
                <span className="pack-opening__title">Sobre Premium</span>
                <span className="pack-opening__subtitle">4 normales + climax</span>
              </div>
              <div className="pack-opening__rip" />
              <div className="pack-opening__beam" />
            </motion.div>
          ) : phase === 'reveal' && activeItem ? (
            <motion.div
              key={`card-${activeItem.posicion}`}
              initial={{ opacity: 0, y: 28, scale: 0.86, rotateY: -14 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, y: -22, scale: 0.94, rotateY: 10 }}
              transition={{ duration: activeItem.climax === 'ESPECIAL' ? 0.58 : 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="pack-opening__reveal-card"
            >
              <RevealKicker item={activeItem} total={cartas.length} />
              <CartaTile
                carta={activeItem.carta}
                eager
                onDownload={onDownload}
                downloading={descargandoId === activeItem.carta.id}
              />
              <p className="pack-opening__card-name">{activeItem.carta.personajeNombre}</p>
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="pack-opening__summary"
            >
              <h3 className="pack-opening__summary-title">
                Resumen del sobre
              </h3>
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function RevealKicker({ item, total }) {
  const climax = item.climax === 'ESPECIAL'
    ? 'Especial'
    : item.climax === 'TOP'
      ? 'Climax'
      : 'Carta'

  return (
    <div className="pack-opening__kicker">
      <span>{item.posicion} / {total}</span>
      <strong>{climax}</strong>
      {item.nueva ? <span>Nueva</span> : <span>Duplicada</span>}
    </div>
  )
}

function PackOpeningFooter({
  reveal,
  totalDuplicados,
  puedeAbrirOtro,
  abriendo,
  onAbrirOtro,
  onCerrar,
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
        <Button onClick={onAbrirOtro} disabled={!puedeAbrirOtro} className="flex-1">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {abriendo ? 'Abriendo...' : 'Abrir otro'}
        </Button>
        <Button variant="secondary" onClick={onCerrar} className="flex-1">
          <X className="h-4 w-4" aria-hidden="true" />
          Cerrar
        </Button>
      </div>
    </div>
  )
}

export default PackOpening
