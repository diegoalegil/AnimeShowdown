import { useEffect, useRef } from 'react'
import { useReducedMotionPref } from '../../../hooks/useReducedMotionPref'
import { useSoundOptional } from '../../../contexts/SoundContext'
import { ESTADO_EVENTO } from '../../../data/eventos'
import { HANABI_CRISANTEMOS_LAYOUT } from './festival-core'
import HanabiBurst from './HanabiBurst'
import './festival.css'

/**
 * Tres filas de faroles en parallax horizontal sutil. Componente auxiliar a
 * nivel de modulo (regla react-refresh): nunca se define dentro del padre. El
 * padre le pasa la ref de la fila como ARGUMENTO directo.
 *
 * @param {object} props
 * @param {'back'|'mid'|'front'} props.tier
 * @param {number} props.count  faroles en la fila
 * @param {React.Ref<HTMLDivElement>} props.rowRef
 */
function LanternRow({ tier, count, rowRef }) {
  const faroles = Array.from({ length: count }, (_, i) => i)
  return (
    <div ref={rowRef} className={`fest-lantern-row fest-lantern-row--${tier} is-lit`}>
      {faroles.map((i) => (
        <span key={i} className={`fest-lantern fest-lantern--${i % 2 === 0 ? 'carmin' : 'oro'}`}>
          <span className="fest-lantern__glow" />
          <span className="fest-lantern__cap" />
          <span className="fest-lantern__paper" />
          <span className="fest-lantern__base" />
          <span className="fest-lantern__tassel" />
        </span>
      ))}
    </div>
  )
}

/**
 * FestivalProcession — takeover escenografico de /eventos/:slug como matsuri
 * nocturno que ENMARCA el contenido real del evento (no lo sustituye). Cielo +
 * luna (LCP, gradiente sin blur, kanji 祭 grabado), tres filas de faroles en
 * parallax horizontal MUY sutil ligado al scroll vertical (translateX +-12px por
 * fila, escrito por ref en un rAF: cero estado por frame, jamas scroll-jacking),
 * y la calle = el contenido real (header, hitos, secciones) que el padre pasa
 * como slots/children.
 *
 * Adaptacion al dominio REAL (decision del owner):
 *  - NO conoce `bloques` ni mapea puestos: el padre pasa el contenido real ya
 *    montado (mision/stats/ranking dentro de YataiStall) como `children`.
 *  - El estado usa los valores REALES: ESTADO_EVENTO.ACTIVO|PROXIMO|PASADO.
 *  - La hanabi se dispara UNA vez en la entrada SOLO si el evento esta ACTIVO
 *    (`estado === ACTIVO`), no por cruce de hito.
 *
 * Accesibilidad: la escenografia (cielo/luna/faroles/hanabi) va aria-hidden; el
 * contenido real conserva su h1/h2 y enlaces. El anuncio de la hanabi de entrada
 * lo emite un nodo aria-live de aqui, una sola vez.
 *
 * Perf/Safari: solo transform/opacity; cero blur/backdrop-filter; loops pausados
 * con reduced-motion y html.as-calm/as-tab-hidden (global). No hay pausa propia
 * por scroll: la escenografia vive en un backdrop position:fixed que nunca sale
 * del viewport, asi que un IntersectionObserver sobre la pieza seria inoperante.
 * La luna es un gradiente.
 *
 * @param {object} props
 * @param {'ACTIVO'|'PROXIMO'|'PASADO'} props.estado  estado REAL del evento
 * @param {React.ReactNode} props.header   cabecera real (kicker + h1 + desc + countdown)
 * @param {React.ReactNode} [props.milestones]  senda de hitos (MilestonePath)
 * @param {React.ReactNode} props.children  secciones reales (mision/stats/ranking)
 * @param {React.ReactNode} [props.farewell]  bloque de despedida (estado PASADO)
 */
export default function FestivalProcession({ estado, header, milestones, children, farewell }) {
  const reduce = useReducedMotionPref()
  // useSoundOptional: tolerante fuera de SoundProvider (tests/harness) — devuelve
  // un play() no-op y nunca lanza. play() ya esta mute-gated internamente.
  const { play } = useSoundOptional()
  const activo = estado === ESTADO_EVENTO.ACTIVO
  const proximo = estado === ESTADO_EVENTO.PROXIMO
  const pasado = estado === ESTADO_EVENTO.PASADO

  const stageRef = useRef(null)
  const backRef = useRef(null)
  const midRef = useRef(null)
  const frontRef = useRef(null)
  const anuncioRef = useRef(null)

  /* ---- Parallax por scroll: translateX por fila escrito en ref via rAF.
       Pausado en reduced-motion. Nunca toca el scroll nativo. ---- */
  useEffect(() => {
    const rows = [backRef.current, midRef.current, frontRef.current]
    if (reduce) {
      rows.forEach((r) => r?.style.setProperty('--row-shift', '0px'))
      return undefined
    }
    let raf = 0
    const clamp = (v) => Math.max(-12, Math.min(12, v))
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY || window.pageYOffset || 0
        backRef.current?.style.setProperty('--row-shift', `${clamp(y * 0.005).toFixed(2)}px`)
        midRef.current?.style.setProperty('--row-shift', `${clamp(y * -0.0032).toFixed(2)}px`)
        frontRef.current?.style.setProperty('--row-shift', `${clamp(y * 0.002).toFixed(2)}px`)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduce])

  /* ---- Anuncio AT + campanilla de la hanabi de entrada: una sola vez si esta
       ACTIVO. El texto entra DESPUES del montaje (effect), para que aria-live
       polite lo lea como cambio. La campanilla va mute-gated por play() y solo
       suena si el navegador ya tiene un AudioContext "running" (politica de
       autoplay): sin gesture previo el resume() se rechaza en silencio. ---- */
  useEffect(() => {
    if (!activo) return undefined
    const node = anuncioRef.current
    if (!node) return undefined
    play('playCampanilla')
    const t = setTimeout(() => {
      if (node) node.textContent = 'El festival esta en marcha: fuegos artificiales de apertura.'
    }, 60)
    return () => clearTimeout(t)
  }, [activo, play])

  const stageClass = `fest${pasado ? ' fest--terminado' : proximo ? ' fest--proximo' : ' fest--activo'}`

  return (
    <div ref={stageRef} className={stageClass} data-reduce={reduce ? '' : undefined}>
      {/* Escenografia FIJA, decorativa */}
      <div className="fest-backdrop" aria-hidden="true">
        <div className="fest-sky" />
        <div className="fest-stars" />
        <div className="fest-moon">
          <span className="fest-moon__halo" />
          {/* Sin kanji por evento en el dominio real -> fallback canonico 祭. */}
          <span className="fest-moon__kanji">{'祭'}</span>
        </div>
        <LanternRow tier="back" count={7} rowRef={backRef} />
        <LanternRow tier="mid" count={7} rowRef={midRef} />
        <LanternRow tier="front" count={7} rowRef={frontRef} />
        <HanabiBurst celebrar={activo} layout={HANABI_CRISANTEMOS_LAYOUT} reduce={reduce} />
      </div>

      <div className="fest-scroll">
        <header className="fest-head">{header}</header>

        {milestones}

        <div className="fest-street">{children}</div>

        {pasado && farewell}
      </div>

      {/* Anuncio de la hanabi de entrada: una sola vez, aria-live polite. */}
      <span className="fest-sr" aria-live="polite" ref={anuncioRef} />
    </div>
  )
}
