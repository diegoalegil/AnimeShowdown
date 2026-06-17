import { useCallback, useEffect, useRef, useState } from 'react'
import { useSound } from '../../../contexts/SoundContext'
import ForgeIngot from './ForgeIngot'
import { TIMING, heatFor, intensityForStrike } from './forge-core'
import './forge.css'

/**
 * ForgeCharge — el RITUAL DE CARGA pre-revelado de La Forja de Sobres (num. 117).
 *
 * Sustituye la sub-secuencia idle/peel/rip ("toca para rasgar") de PackOpening
 * por la fragua: el sobre llega como LINGOTE sellado al yunque, el usuario lo
 * GOLPEA (click/tap/Enter/Espacio) y cada golpe levanta chispas, agrieta el
 * lingote y, desde el 3er golpe, sube las brasas + entra el tambor (playYunque).
 * Al romperse (último golpe, "abrir directo" o Enter mantenido), llama a
 * `onBreak()` y CEDE el control al revelado existente de PackOpening (vuelo de
 * carta + flip canónico + aura especial + resumen). NO trae vuelo ni resumen
 * propios: el revelado del repo los supersede (decisión del owner).
 *
 * Aquí NO hay promesa: las cartas ya están resueltas (`reveal` llegó antes), así
 * que el modelo onAbrir()=>Promise / "el último golpe espera a la promesa" de la
 * canvas NO aplica y se descarta. El último golpe simplemente rompe.
 *
 * Reglas React 19 + Compiler: espejos de props/estado en useEffect SIN deps;
 * jamás ref.current en render; jamás setState síncrono en cuerpo de effect (solo
 * en callbacks de timer/handler); jamás Date.now()/Math.random() en render.
 *
 * @param {Object} props
 * @param {number} props.blows   Golpes necesarios para romper (2..5, de forge-core).
 * @param {boolean} props.reduceMotion  Camino "seco": grietas instantáneas, sin
 *        chispas/sacudida, brasas estáticas, aterriza rápido en el revelado.
 * @param {() => void} props.onBreak  Se invoca UNA vez al romper -> startReveal.
 */
export default function ForgeCharge({ blows, reduceMotion = false, onBreak }) {
  const { play, warm } = useSound()

  const [phase, setPhase] = useState(reduceMotion ? 'striking' : 'arrival')
  const [strikes, setStrikes] = useState(0)
  const [broken, setBroken] = useState(false)
  const [offscreen, setOffscreen] = useState(false)
  const [liveMsg, setLiveMsg] = useState('')

  // Espejos (useEffect SIN deps; nunca ref.current en render).
  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  })
  const strikesRef = useRef(strikes)
  useEffect(() => {
    strikesRef.current = strikes
  })
  const brokenRef = useRef(broken)
  useEffect(() => {
    brokenRef.current = broken
  })
  const onBreakRef = useRef(onBreak)
  useEffect(() => {
    onBreakRef.current = onBreak
  })
  const lockRef = useRef(0)
  const timersRef = useRef([])
  const rootRef = useRef(null)

  const later = useCallback((ms, fn) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }, [])

  // Limpieza de timers al desmontar (un re-render no los toca).
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  // Llegada del lingote (una pasada). setState dentro de timer/efecto-de-montaje
  // es legal (no es setState SÍNCRONO en cuerpo de effect que re-renderice en
  // bucle). En reduced-motion arrancamos directos en 'striking'.
  useEffect(() => {
    if (reduceMotion) return undefined
    warm?.()
    play?.('playAcunado')
    const t = setTimeout(() => setPhase('striking'), TIMING.arrival)
    timersRef.current.push(t)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pausa loops decorativos (brasas) fuera de viewport via .is-offscreen.
  // (tab-hidden lo gestiona App.jsx con html.as-tab-hidden globalmente).
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0]
      setOffscreen(entry ? !entry.isIntersecting : false)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const beginBreak = useCallback(() => {
    if (brokenRef.current) return
    brokenRef.current = true
    setBroken(true)
    setPhase('breaking')
    play?.('playPackTear')
    setLiveMsg('El lingote se rompe')
    // Tras la animación de rotura, cede al revelado existente. En reduced-motion
    // aterrizamos rápido (la grieta/rotura es "seca").
    later(reduceMotion ? 1 : TIMING.break, () => onBreakRef.current?.())
  }, [later, play, reduceMotion])

  const handleStrike = useCallback(() => {
    if (phaseRef.current !== 'striking' || brokenRef.current) return
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now < lockRef.current) return

    const prev = strikesRef.current
    const next = prev + 1
    const isLast = next >= blows

    if (prev === 0) warm?.()
    play?.('playYunque', intensityForStrike(next))

    strikesRef.current = next
    setStrikes(next)
    setLiveMsg(`Golpe ${next} de ${blows}`)

    // Bloqueo anti-doble-tap; el penúltimo golpe deja una pausa dramática.
    const isPenult = next === blows - 1
    lockRef.current = now + (reduceMotion ? 0 : isPenult ? TIMING.penultPause : TIMING.strikeLock)

    // Último golpe: cerramos la ventana de re-entrada (lock = Infinity) ANTES de
    // agendar la rotura, para que un doble-tap sub-frame no dispare un playYunque
    // extra, un overflow de strikes ni un aria-live "Golpe N+1 de N".
    if (isLast) {
      lockRef.current = Infinity
      later(reduceMotion ? 1 : 140, beginBreak)
    }
  }, [blows, beginBreak, later, play, reduceMotion, warm])

  // "Abrir directo": rompe el lingote en un golpe (power users / muchos sobres).
  const handleDirect = useCallback(() => {
    if (brokenRef.current) return
    strikesRef.current = blows
    setStrikes(blows)
    beginBreak()
  }, [blows, beginBreak])

  // Enter MANTENIDO sobre el lingote = abrir directo (atajo de teclado).
  const handleIngotKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && e.repeat) {
        e.preventDefault()
        handleDirect()
      }
    },
    [handleDirect],
  )

  const heat = heatFor(strikes, blows)
  const arriving = phase === 'arrival'

  return (
    <div
      ref={rootRef}
      className={`forge${reduceMotion ? ' as-calm' : ''}${offscreen ? ' is-offscreen' : ''}`}
      data-phase={phase}
      data-heat={heat}
    >
      <div className="forge__hearth" aria-hidden="true">
        <div className="forge__ember-bed" />
        <div className="forge__ember-flicker" />
        <div className="forge__ember-hot" />
      </div>
      {/* 火 = fuego/fragua (kanji canónico del repo) */}
      <div className="forge__watermark" aria-hidden="true">
        火
      </div>

      <div className="forge__stage">
        {/* 火 canónico en el kicker (la canvas usaba un kanji "forjar" fuera del subset). */}
        <div className="forge__kicker">
          La forja de sobres <span className="forge__kicker-jp" lang="ja" aria-hidden="true">火</span>
        </div>

        <div className="forge__anvil" aria-hidden="true">
          <div className="forge__anvil-glow" />
          <div className="forge__anvil-face" />
          <div className="forge__anvil-waist" />
        </div>

        <div onKeyDown={handleIngotKeyDown}>
          <ForgeIngot
            strikes={strikes}
            blows={blows}
            broken={broken}
            arriving={arriving}
            calm={reduceMotion}
            onStrike={handleStrike}
          />
        </div>

        <div className="forge__tally" aria-hidden="true">
          {Array.from({ length: blows }).map((_, d) => (
            <span key={d} className="forge__tally-dot" data-struck={d < strikes ? 'true' : 'false'} />
          ))}
        </div>

        {phase === 'striking' && (
          <p className="forge__prompt">
            {strikes === 0 ? 'Golpea el lingote para forjarlo' : 'Sigue golpeando'}
          </p>
        )}
        {phase === 'breaking' && <p className="forge__prompt">¡Se rompe!</p>}
        {phase === 'arrival' && <p className="forge__hint">el lingote llega al yunque…</p>}

        {!broken && (
          <button type="button" className="forge__direct" onClick={handleDirect}>
            Abrir directo
          </button>
        )}
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {liveMsg}
      </div>
    </div>
  )
}
