import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotionPref } from '../../../hooks/useReducedMotionPref'
import { runDuelEntrance, runDuelExit, ENTRANCE_T } from '../duel-entrance-core'
import './duel-entrance.css'

/**
 * DuelEntrance — coreógrafo de la entrada de combatientes en /votar.
 *
 * REEMPLAZA el montaje del par de VoteArena (el AnimatePresence popLayout
 * con fade y±12): cada carta entra desde su lateral como si caminara al
 * centro del recinto, planta la base con un squash sutil, el VS de tinta
 * nace con un corte vertical y los nombres se pintan debajo con corte de
 * tinta (cover scaleX que se retira con filo dorado).
 *
 * QUÉ NO TOCA: el impacto físico del click al votar (punch framer de
 * VoteCard + VoteImpactEffects) queda INTACTO — la coreografía anima los
 * WRAPPERS (.as-duel-figure), nunca el <button> interior.
 *
 * Coreografía (duel-entrance-core.js es la única fuente de verdad):
 * t0 izquierda 480ms ease-lift desde -12% · t+120 derecha · t+420 squash
 * 120ms · t+520 VS scaleY 180ms + filo a t+700 (120ms) · t+600 nombres
 * 240ms ease-brush, stagger 60ms · fin t+900 (= NEXT_DELAY_MS: la
 * ceremonia nunca excede la ventana de auto-next). Par nuevo: salida
 * un-paso-atrás 220ms y re-entrada ×0.7. Modo rápido: fade de 120ms.
 *
 * El grid conserva el responsive REAL de la arena (2 columnas en móvil,
 * VS central solo en sm+): el modo apilado de la demo rompería la ley
 * "todo el duelo cabe sin scroll" del móvil. El eje de entrada es X en
 * ambos breakpoints. Reduced-motion (gate único PRM+calma): par directo.
 *
 * WAAPI sobre refs (cero re-render por frame, cero <style> runtime/CSP).
 * Solo transform/opacity. CLS cero: la reserva de caja la sigue dando
 * VoteCard (aspect 2:3 + max-height), sin cambios.
 *
 * @param {object} props
 * @param {string} props.pairKey clave del par. Al cambiar, DuelEntrance
 *   coreografía salida → swap → re-entrada ×0.7. Con la MISMA key, a/b
 *   se espejan en seco (revelado del modo a ciegas, datos frescos).
 * @param {{slug:string,nombre:string,anime:string,kanji:?string}} props.a
 *   Lado izquierdo. `kanji` = kanji de universo (getAnimeIdentity); null
 *   = sin asomo (p. ej. identidad oculta en modo a ciegas).
 * @param {{slug:string,nombre:string,anime:string,kanji:?string}} props.b
 * @param {(side:'left'|'right', fig:object) => import('react').ReactNode} props.renderCard
 *   Render del VoteCard de cada lado, INTACTO, con `captionHidden` (el
 *   nombre lo pinta DuelEntrance para poder cortarlo con tinta). Recibe la
 *   FIGURA MOSTRADA (snapshot con lag): durante la salida del par la carta
 *   sigue siendo la saliente — usa fig.personaje, no el par actual.
 * @param {import('react').ReactNode} [props.vsBadgeCompact] Badge compacto
 *   de móvil: entra con la ceremonia (fade en el nacimiento del VS) y sale
 *   con el par. Sin él, móvil no pinta VS.
 * @param {(side:'left'|'right', fig:object) => import('react').ReactNode} [props.nameExtra]
 *   Extra bajo el nombre (p.ej. el link "Ver ficha" post-voto), alineado
 *   con su lado y revelado junto al nombre.
 * @param {import('react').ReactNode} [props.vsBadge] VsBadge existente —
 *   se monta dentro del glifo del VS (slam de voto intacto). Si se omite,
 *   se pinta el glifo 対 + VS de la casa.
 * @param {import('react').ReactNode} [props.tieSlot] Botón de empate
 *   existente — se cuelga bajo el VS sin taparlo (.as-duel-vs-tie).
 * @param {boolean} props.fastMode Modo rápido del repo: la entrada entera
 *   es un fade de 120ms; el auto-avance JAMÁS espera a la ceremonia.
 * @param {boolean} [props.holdCeremony=false] Tour del primer duelo activo:
 *   la ceremonia espera su telón (figuras en espera, cero solape).
 * @param {(fase: string) => void} [props.onPhase] Fases de la ceremonia
 *   ('left-in'|'right-in'|'plant'|'vs'|'names'|'flash'|'done') — punto de
 *   enganche del sonido. El modo rápido y reduced-motion solo emiten
 *   'done', así que lo que cuelgues aquí respeta la cadencia gratis.
 * @param {() => void} [props.onEntranceDone] Fin de la pieza (nombres
 *   asentados). NO usar para gatear el voto: las cartas son interactivas
 *   desde el primer frame.
 */
export default function DuelEntrance({
  pairKey,
  a,
  b,
  renderCard,
  vsBadge = null,
  vsBadgeCompact = null,
  tieSlot = null,
  nameExtra,
  fastMode,
  holdCeremony = false,
  onPhase,
  onEntranceDone,
}) {
  const reduceMotion = useReducedMotionPref()
  // El par MOSTRADO va por detrás del par pedido: al cambiar pairKey,
  // primero la salida sobre el DOM saliente, luego swap + re-entrada ×0.7.
  const [shown, setShown] = useState({ pairKey, a, b, scale: 1 })
  const [exiting, setExiting] = useState(false)
  // Misma key con datos nuevos (revelado a ciegas, refresh): espejo en
  // seco ajustando DURANTE el render (patrón oficial, Compiler-safe).
  if (shown.pairKey === pairKey && (shown.a !== a || shown.b !== b)) {
    setShown((v) => ({ ...v, a, b }))
  }
  const leftFigure = useRef(null)
  const rightFigure = useRef(null)
  const vsWrap = useRef(null)
  const vsCompact = useRef(null)
  const vsLine = useRef(null)
  const vsFlash = useRef(null)
  const leftCover = useRef(null)
  const rightCover = useRef(null)
  const cancelRef = useRef(null)
  const exitForRef = useRef(null)
  const ranKeyRef = useRef(null)
  const doneRef = useRef(onEntranceDone)
  const phaseRef = useRef(onPhase)
  useEffect(() => {
    doneRef.current = onEntranceDone
    phaseRef.current = onPhase
  }, [onEntranceDone, onPhase])

  useEffect(() => {
    // Salida una sola vez por pairKey nuevo (el guard absorbe re-runs por
    // cambios de fastMode/reduceMotion a mitad de vuelo).
    if (pairKey === shown.pairKey || exitForRef.current === pairKey) {
      return undefined
    }
    exitForRef.current = pairKey
    cancelRef.current?.()
    const t = setTimeout(() => {
      setExiting(true)
      cancelRef.current = runDuelExit(
        {
          leftFigure: leftFigure.current,
          rightFigure: rightFigure.current,
          alsoFade: [vsWrap.current, vsCompact.current],
        },
        {
          axis: 'x',
          fast: fastMode,
          reduceMotion,
          onDone: () => {
            setExiting(false)
            setShown({ pairKey, a, b, scale: ENTRANCE_T.reEntryScale })
          },
        },
      )
    }, 0)
    return () => clearTimeout(t)
  }, [pairKey, shown.pairKey, a, b, fastMode, reduceMotion])

  useLayoutEffect(() => {
    const els = {
      leftFigure: leftFigure.current,
      rightFigure: rightFigure.current,
      vsLine: vsLine.current,
      vsFlash: vsFlash.current,
      vsCompact: vsCompact.current,
      leftCover: leftCover.current,
      rightCover: rightCover.current,
    }
    if (holdCeremony && !reduceMotion) {
      // El telón del tour manda: figuras en espera, cero ceremonia.
      ;[els.leftFigure, els.rightFigure].forEach((el) => {
        if (el) el.style.opacity = '0'
      })
      if (els.vsLine) els.vsLine.style.transform = 'scaleY(0)'
      ranKeyRef.current = null
      return undefined
    }
    // La ceremonia corre UNA vez por par mostrado (el guard absorbe
    // re-runs por el espejo de nombres del modo a ciegas o por toggles
    // de preferencias — jamás re-anima el mismo par).
    if (ranKeyRef.current === shown.pairKey) return undefined
    ranKeyRef.current = shown.pairKey
    ;[els.leftFigure, els.rightFigure].forEach((el) => {
      if (el) el.style.opacity = ''
    })
    if (els.vsLine) els.vsLine.style.transform = ''
    cancelRef.current?.()
    cancelRef.current = runDuelEntrance(els, {
      scale: shown.scale,
      axis: 'x',
      fast: fastMode,
      reduceMotion,
      onPhase: (fase) => phaseRef.current?.(fase),
      onDone: () => doneRef.current?.(),
    })
    return () => cancelRef.current?.()
  }, [shown, holdCeremony, fastMode, reduceMotion])

  // OJO React Compiler: nada de componentes definidos dentro del render
  // (remount por render = mataría el estado/punch de VoteCard), y los
  // refs viajan como argumentos directos (dentro de un objeto el lint
  // los trata como lectura de ref en render).
  const figure = (side, p, figureRef, coverRef) => (
    <div ref={figureRef} className="as-duel-figure" key={side}>
      {p.kanji && (
        <span className="as-duel-kanji-peek" lang="ja" aria-hidden="true">
          {p.kanji}
        </span>
      )}
      <div>
        {renderCard(side, p)}
        <div
          className={`as-duel-name flex min-w-0 flex-col px-1 pt-2 ${
            side === 'right' ? 'items-end text-right' : 'items-start text-left'
          }`}
        >
          <h2 className="line-clamp-1 w-full text-base font-bold text-fg-strong sm:text-lg">
            {p.nombre}
          </h2>
          <p className="line-clamp-1 w-full text-[12px] text-fg-muted">{p.anime}</p>
          {nameExtra?.(side, p)}
          <span ref={coverRef} className="as-duel-name-cover" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  )

  return (
    <div
      data-votar-arena
      data-exiting={exiting || undefined}
      className="relative grid grid-cols-2 items-start gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-6"
    >
      {vsBadgeCompact && (
        <div
          ref={vsCompact}
          className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2 sm:hidden"
        >
          {vsBadgeCompact}
        </div>
      )}
      {figure('left', shown.a, leftFigure, leftCover)}
      <div
        ref={vsWrap}
        className="hidden items-stretch justify-center sm:flex"
      >
        <div className="as-duel-vs">
          <span ref={vsLine} className="as-duel-vs-line" aria-hidden="true"></span>
          <span ref={vsFlash} className="as-duel-vs-flash" aria-hidden="true"></span>
          <div className="as-duel-vs-glyph">
            {vsBadge ?? (
              <span className="as-duel-vs-kanji" lang="ja" aria-hidden="true">
                対
              </span>
            )}
            <span className="as-duel-vs-label">VS</span>
          </div>
          {tieSlot && <div className="as-duel-vs-tie">{tieSlot}</div>}
        </div>
      </div>
      {figure('right', shown.b, rightFigure, rightCover)}
    </div>
  )
}
