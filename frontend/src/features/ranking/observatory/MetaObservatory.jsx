import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  haySerieTemporal,
  moversEntre,
  numeroDias,
  posicionesDelDia,
  proyectarCielo,
} from './observatory-core'
import SkyStar from './SkyStar'
import ConstellationLayer from './ConstellationLayer'
import TideScrubber from './TideScrubber'
import './observatory.css'

const STAGGER_CONSTEL_MS = 90
const ZOOM_CIELO = 1
const ZOOM_CONSTEL = 1.8

/** Resumen textual del día para el aria-live del escrutador. */
function resumenDelDia(movers, dia, dias, nombrePorSlug) {
  if (!movers.length) return ''
  const m = movers[0]
  const nombre = nombrePorSlug.get(m.slug) ?? m.slug
  const atras = dias - 1 - dia
  return `día -${atras}: ${nombre} estaba en el puesto ${m.hasta}º`
}

/**
 * MetaObservatory — el Observatorio del meta. Proyecta el ranking como cielo
 * nocturno (constelación = anime, tamaño = ELO) y orquesta el resto de piezas:
 * encendido escalonado, pan por arrastre/teclado (transform por ref: CERO
 * re-render por frame), zoom en 2 niveles, escrutador de mareas (deriva de las
 * estrellas + estelas de los movers) y leyenda de constelaciones que filtra.
 * Convive con la tabla clásica (botón «volver a la tabla»), no la sustituye.
 *
 * @param {Object} props
 * @param {{slug:string,nombre:string,anime:string,elo:number,posicion:number}[]} props.ranking
 * @param {{slug:string,posicionesPorDia:number[]}[]} [props.movimientos]  serie temporal (opcional)
 * @param {(slug:string)=>string} props.hrefPersonaje
 * @param {string|null} [props.slugDestacado]  estrella propia del usuario (aro oro)
 * @param {string} [props.fecha]               fecha del cielo (texto ya formateado)
 * @param {()=>void} [props.onVolverTabla]
 */
function MetaObservatory({
  ranking = [],
  movimientos = [],
  hrefPersonaje,
  slugDestacado = null,
  fecha = '',
  onVolverTabla,
}) {
  const calma = useReducedMotion()
  const cielo = useMemo(() => proyectarCielo(ranking), [ranking])
  const dias = useMemo(() => numeroDias(movimientos), [movimientos])
  const haySerie = useMemo(() => haySerieTemporal(movimientos), [movimientos])

  const [dia, setDia] = useState(() => Math.max(0, dias - 1))
  // Re-sincroniza el día a «hoy» si cambia la serie (derived-state con guard).
  const [diasPrev, setDiasPrev] = useState(dias)
  if (diasPrev !== dias) {
    setDiasPrev(dias)
    setDia(Math.max(0, dias - 1))
  }
  const esHoy = dias === 0 || dia === dias - 1

  const posDia = useMemo(
    () => (esHoy ? null : posicionesDelDia(cielo, movimientos, dia)),
    [cielo, movimientos, dia, esHoy],
  )
  const moversScrub = useMemo(
    () => (esHoy ? [] : moversEntre(movimientos, dias - 1, dia).slice(0, 5)),
    [movimientos, dias, dia, esHoy],
  )
  const slugsScrub = useMemo(() => new Set(moversScrub.map((m) => m.slug)), [moversScrub])
  const risersHoy = useMemo(() => {
    if (dias < 2) return new Set()
    return new Set(
      moversEntre(movimientos, dias - 2, dias - 1)
        .filter((m) => m.delta > 0)
        .map((m) => m.slug),
    )
  }, [movimientos, dias])
  const nombrePorSlug = useMemo(
    () => new Map(cielo.estrellas.map((e) => [e.slug, e.nombre])),
    [cielo],
  )
  const resumen = useMemo(
    () => resumenDelDia(moversScrub, dia, dias, nombrePorSlug),
    [moversScrub, dia, dias, nombrePorSlug],
  )

  const [animeFiltrado, setAnimeFiltrado] = useState(null)
  const [acercado, setAcercado] = useState(false)

  const viewportRef = useRef(null)
  const lienzoRef = useRef(null)
  const panRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef(null)

  // Clamp de pan a los límites del cielo a una escala dada (función pura de cielo).
  const clampPan = useCallback(
    (x, y, escala) => {
      const vp = viewportRef.current
      if (!vp) return { x, y }
      const w = cielo.ancho * escala
      const h = cielo.alto * escala
      return {
        x: Math.max(Math.min(0, vp.clientWidth - w), Math.min(0, x)),
        y: Math.max(Math.min(0, vp.clientHeight - h), Math.min(0, y)),
      }
    },
    [cielo],
  )

  // Escribe el transform del lienzo por ref (sin estado → sin re-render).
  const aplicarTransform = useCallback((escala, conTransicion) => {
    const el = lienzoRef.current
    if (!el) return
    el.style.transition = conTransicion ? 'transform 450ms var(--ease-lift)' : 'none'
    el.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${escala})`
  }, [])

  // Posición inicial: centra el cielo en vertical, arranca por la izquierda.
  useEffect(() => {
    const vp = viewportRef.current
    if (vp) panRef.current = clampPan(0, vp.clientHeight / 2 - cielo.alto / 2, ZOOM_CIELO)
    aplicarTransform(ZOOM_CIELO, false)
  }, [cielo, clampPan, aplicarTransform])

  // Cambio de zoom: re-clampa y transiciona el transform del lienzo.
  useEffect(() => {
    const escala = acercado ? ZOOM_CONSTEL : ZOOM_CIELO
    panRef.current = clampPan(panRef.current.x, panRef.current.y, escala)
    aplicarTransform(escala, true)
  }, [acercado, clampPan, aplicarTransform])

  const escalaActual = () => (acercado ? ZOOM_CONSTEL : ZOOM_CIELO)

  const onPointerDown = (e) => {
    const vp = viewportRef.current
    vp?.setPointerCapture?.(e.pointerId)
    vp?.classList.add('is-grabbing')
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseX: panRef.current.x,
      baseY: panRef.current.y,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: e.timeStamp,
      vx: 0,
      vy: 0,
    }
    aplicarTransform(escalaActual(), false)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const escala = escalaActual()
    panRef.current = clampPan(d.baseX + (e.clientX - d.x), d.baseY + (e.clientY - d.y), escala)
    const dt = e.timeStamp - d.lastT || 16
    d.vx = (e.clientX - d.lastX) / dt
    d.vy = (e.clientY - d.lastY) / dt
    d.lastX = e.clientX
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    aplicarTransform(escala, false)
  }

  const onPointerUp = () => {
    const d = dragRef.current
    viewportRef.current?.classList.remove('is-grabbing')
    if (d && !calma) {
      // Inercia simple: una glide con momento, vía transición CSS (sin rAF).
      const escala = escalaActual()
      panRef.current = clampPan(panRef.current.x + d.vx * 120, panRef.current.y + d.vy * 120, escala)
      aplicarTransform(escala, true)
    }
    dragRef.current = null
  }

  // Alternativa de teclado al pan: las flechas mueven el foco entre estrellas
  // (en orden de ranking) y el lienzo sigue al foco.
  const onKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const estrellas = lienzoRef.current?.querySelectorAll('.sky-star')
    if (!estrellas || estrellas.length === 0) return
    e.preventDefault()
    const adelante = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    let idx = Array.prototype.indexOf.call(estrellas, document.activeElement)
    if (idx === -1) idx = adelante ? -1 : estrellas.length
    const siguiente = Math.max(0, Math.min(estrellas.length - 1, idx + (adelante ? 1 : -1)))
    estrellas[siguiente].focus()
  }

  // El lienzo sigue al foco: centra la estrella enfocada en el viewport.
  const centrarEstrella = useCallback(
    (slug) => {
      const estrella = cielo.estrellas.find((s) => s.slug === slug)
      const vp = viewportRef.current
      if (!estrella || !vp) return
      const escala = acercado ? ZOOM_CONSTEL : ZOOM_CIELO
      panRef.current = clampPan(
        vp.clientWidth / 2 - estrella.x * escala,
        vp.clientHeight / 2 - estrella.y * escala,
        escala,
      )
      aplicarTransform(escala, true)
    },
    [cielo, acercado, clampPan, aplicarTransform],
  )

  return (
    <section className="observatory" aria-label="Observatorio del meta">
      <header className="observatory__cabecera">
        <div className="observatory__titulo-grupo">
          {fecha ? <p className="observatory__fecha font-mono">{fecha}</p> : null}
          <h2 className="observatory__titulo">El observatorio del meta</h2>
        </div>
        <div className="observatory__acciones">
          <button
            type="button"
            className="observatory__zoom"
            aria-pressed={acercado}
            onClick={() => setAcercado((z) => !z)}
          >
            {acercado ? 'Alejar' : 'Acercar'}
          </button>
          {onVolverTabla ? (
            <button type="button" className="observatory__volver" onClick={onVolverTabla}>
              Volver a la tabla
            </button>
          ) : null}
        </div>
      </header>

      <div className="observatory__leyenda" role="group" aria-label="Constelaciones por anime">
        {cielo.constelaciones.map((c) => (
          <button
            key={c.anime}
            type="button"
            className={`observatory__chip${animeFiltrado === c.anime ? ' is-activa' : ''}`}
            aria-pressed={animeFiltrado === c.anime}
            onClick={() => setAnimeFiltrado((a) => (a === c.anime ? null : c.anime))}
          >
            {c.anime}
          </button>
        ))}
      </div>

      <div
        ref={viewportRef}
        className="observatory__viewport"
        role="application"
        tabIndex={0}
        aria-label="Cielo del ranking. Arrastra para desplazarte; las flechas mueven el foco entre estrellas."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div
          ref={lienzoRef}
          className="observatory__lienzo"
          style={{ width: `${cielo.ancho}px`, height: `${cielo.alto}px` }}
        >
          <ConstellationLayer
            constelaciones={cielo.constelaciones}
            ancho={cielo.ancho}
            alto={cielo.alto}
            animado={!calma}
            reducedMotion={calma}
            animeFiltrado={animeFiltrado}
          />
          {cielo.estrellas.map((e) => {
            const pos = posDia?.get(e.slug)
            const estrella = pos ? { ...e, x: pos.x, y: pos.y } : e
            return (
              <SkyStar
                key={e.slug}
                estrella={estrella}
                href={hrefPersonaje ? hrefPersonaje(e.slug) : '#'}
                retardoMs={e.indiceConstelacion * STAGGER_CONSTEL_MS + e.rangoEnAnime * 40}
                destacada={e.slug === slugDestacado}
                titila={esHoy && risersHoy.has(e.slug)}
                estelaDesde={!esHoy && slugsScrub.has(e.slug) ? { x: e.x, y: e.y } : null}
                atenuada={animeFiltrado != null && e.anime !== animeFiltrado}
                reducedMotion={calma}
                onFocoEstrella={centrarEstrella}
              />
            )
          })}
        </div>
      </div>

      <TideScrubber
        dias={dias}
        valor={dia}
        onCambio={setDia}
        habilitado={haySerie}
        resumen={resumen}
      />
    </section>
  )
}

export default MetaObservatory
