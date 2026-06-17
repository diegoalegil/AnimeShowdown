// ============================================================================
// SanctuaryRoom.jsx — contenedor de sala. Cada sala es un <section> con un
// <h2> real y un titular que entra por CORTE DE TINTA. Despierta UNA sola vez
// al alcanzar el 40% de visibilidad (IntersectionObserver); el re-scroll NO
// re-dispara. La escenografia (children) es aria-hidden; el contenido textual
// y accesible lo pasa el consumidor.
//
// Stack: React 19 + Tailwind v4 (tokens) + sanctuary.css. Cero hex en JSX.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { TIMING } from './sanctuary-core'

/**
 * @typedef {object} SanctuaryRoomProps
 * @property {string} id            id de sala (ancla; coincide con el guion)
 * @property {string} kanji         kanji de la sala (marca de agua)
 * @property {string} eyebrow       cintillo mono ("Sala 03 · El altar...")
 * @property {string} titulo        texto del <h2>
 * @property {string} [labelScreen] data-screen-label para contexto de comentarios
 * @property {React.ReactNode} [scenery] escenografia a sangre (aria-hidden)
 * @property {(awake:boolean)=>void} [onWake] callback al despertar (sonido, etc.)
 * @property {string} [className]
 * @property {React.ReactNode} children contenido accesible de la sala
 */

/**
 * Contenedor de una sala del santuario.
 * @param {SanctuaryRoomProps} props
 */
function SanctuaryRoom({
  id,
  kanji,
  eyebrow,
  titulo,
  labelScreen,
  scenery = null,
  onWake,
  className = '',
  // Nivel del encabezado de sala. La Entrada es el ÚNICO <h1> de la página
  // (el peregrino); el resto de salas son <h2>. A11y: jamás dos h1.
  headingLevel = 'h2',
  // Algunas salas (espejo, emaki) llevan su titular GRANDE dentro del propio
  // contenido (la escena a sangre / el rollo). El <h2> de sala sigue siendo
  // real y obligatorio, pero se rinde sr-only para no duplicarlo en pantalla.
  headingSrOnly = false,
  children,
}) {
  const Heading = headingLevel === 'h1' ? 'h1' : 'h2'
  const ref = useRef(null)
  const [awake, setAwake] = useState(false)
  // Espejo de onWake en ref (los espejos de props van en effect sin deps de
  // render; jamas xRef.current = prop en el cuerpo del render).
  const onWakeRef = useRef(onWake)
  useEffect(() => {
    onWakeRef.current = onWake
  })

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    // jsdom / navegadores sin IO: despierta de inmediato (camino degradado =
    // el de reduced-motion, todo visible). El setState va en un timer, no en el
    // cuerpo del effect (regla react-hooks/set-state-in-effect: el setState
    // síncrono encadena renders; en un callback de timer es legal).
    if (typeof IntersectionObserver !== 'function') {
      const t = setTimeout(() => {
        setAwake(true)
        onWakeRef.current?.(true)
      }, 0)
      return () => clearTimeout(t)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= TIMING.wakeRatio) {
            setAwake(true)
            onWakeRef.current?.(true)
            io.disconnect() // una sola vez por visita
            break
          }
        }
      },
      { threshold: [TIMING.wakeRatio] },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      id={id}
      data-screen-label={labelScreen}
      aria-labelledby={`sanctuary-h-${id}`}
      className={`relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden ${
        awake ? 'is-awake' : ''
      } ${className}`}
    >
      {scenery ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {scenery}
        </div>
      ) : null}

      {kanji ? (
        <span
          aria-hidden="true"
          lang="ja"
          className="pointer-events-none absolute right-[-2%] top-1/2 -translate-y-1/2 select-none font-kanji-serif leading-none text-gold/5 text-[clamp(180px,44vh,420px)]"
        >
          {kanji}
        </span>
      ) : null}

      <div className="relative z-[2] w-full max-w-[820px] px-6 text-center">
        {eyebrow ? (
          <span className="sanctuary-ink-wrap mb-1.5 inline-block">
            <span className="sanctuary-ink-cut" />
            <span className="font-mono text-[13px] text-gold">{eyebrow}</span>
          </span>
        ) : null}
        <Heading
          id={`sanctuary-h-${id}`}
          className={
            headingSrOnly
              ? 'sr-only'
              : 'sanctuary-rise m-0 text-balance text-[clamp(1.3rem,4.5vw,2rem)] font-bold text-fg'
          }
          style={headingSrOnly ? undefined : { '--pd': '0.1s' }}
        >
          {titulo}
        </Heading>
        {children}
      </div>
    </section>
  )
}

export default SanctuaryRoom
