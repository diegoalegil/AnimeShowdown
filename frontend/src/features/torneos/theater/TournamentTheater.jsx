import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import ActRail from './ActRail'
import ShowTimeline from './ShowTimeline'
import CoronationRite from './CoronationRite'
import { compileScript, computeLayout, deriveBracketState, normalizeRounds, valueTextPaso } from './theater-utils'
import { useSoundOptional } from '../../../contexts/SoundContext'
import { formatDateSafe, parseDateSafe } from '../../../lib/dateUtils'
import { getEstadoBadge } from '../../../lib/torneosQueries'
import ReactionsBar from '../../../components/ReactionsBar'
import './theater.css'

/**
 * TournamentTheater — el TEATRO que ENMARCA toda la página /torneos/:slug.
 *
 * Decisión del owner (re-arquitectura sobre el canvas): el teatro NO sustituye
 * al bracket; lo ENMARCA. El telón se abre sobre el contenido, el PROSCENIO
 * pasa a ser la cabecera de la página (el único <h1> grabado, con microdata
 * SportsEvent, badge de estado, descripción, fechas y ReactionsBar), y el
 * cuerpo rico de la página vive DENTRO del marco como `children`.
 *
 * MODOS:
 *  · IN_PROGRESS — marco ligero (telón abre, proscenio, faroles). Se renderiza
 *    {children} TAL CUAL: el Bracket vivo del repo ES el cuadro. NO se monta
 *    ActRail aquí (cambio clave respecto al canvas). Sin "ver la función".
 *  · FINISHED — marco + control "遊 ver la función". Al pulsarlo abre el OVERLAY
 *    de la función: ShowTimeline (scrubber/play/velocidad/narrador) + ActRail
 *    (réplica scrubbable derivada) + CoronationRite al final, keyado por slug
 *    del campeón. "← volver al cuadro" cierra el overlay y vuelven los children.
 *  · SCHEDULED — proscenio + Tablilla (telón cerrado). Los children (p.ej. el
 *    panel de predicción) siguen renderizándose debajo.
 *
 * GUION (timings): Acto 0 telón 700ms (ease-brush) · título por corte de tinta
 * a +400ms · faroles fade 400ms a +650ms. Función: 1400ms/duelo (corte 420ms →
 * avance 600ms → asiento). Coronación: 550 → 380 → 900 → 800ms.
 *
 * @param {object} props
 * @param {import('./theater-utils').Torneo} props.torneo  shape REAL de useTorneoBySlug
 * @param {Array} props.enfrentamientos  array PLANO de enfrentamientos (NO Match[][])
 * @param {import('react').ReactNode} props.children  el cuerpo real de la página
 * @param {(slug:string)=>string} props.hrefPersonaje  (solo dentro de la función)
 */
export default function TournamentTheater({ torneo, enfrentamientos, children, hrefPersonaje }) {
  const reduced = useReducedMotion() ?? false
  const { play } = useSoundOptional()
  const scheduled = torneo.estado === 'SCHEDULED'
  const finished = torneo.estado === 'FINISHED'

  // Adaptador REAL→CANVAS: el detalle sirve un array plano; lo normalizamos a
  // Match[][] (el shape que esperan las funciones puras del teatro). Solo se
  // usa para alimentar la FUNCIÓN (overlay de FINISHED); el cuadro vivo lo
  // pinta el Bracket del repo en children.
  const rounds = useMemo(() => normalizeRounds(enfrentamientos), [enfrentamientos])
  const hasRounds = rounds.length > 0 && rounds[0].length > 0
  const guion = useMemo(() => compileScript(rounds), [rounds])
  const total = guion.totalSteps
  const layout = useMemo(() => (hasRounds ? computeLayout(rounds) : null), [rounds, hasRounds])

  // responsive (layout 390px → actos en columna)
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // entrada (acto 0/1)
  const [curtain, setCurtain] = useState(false)
  const [title, setTitle] = useState(false)
  const [lanterns, setLanterns] = useState(false)
  const timersRef = useRef([])

  // función (overlay, solo FINISHED)
  const [modo, setModo] = useState('bracket')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [cut, setCut] = useState(false)
  const overlayRef = useRef(null)
  const ctrlBtnRef = useRef(null)

  // ── Acto 0 al montar. SIEMPRE vía callbacks de setTimeout (jamás setState
  // síncrono en el cuerpo del effect — lo prohíbe react-hooks/set-state-in-effect
  // del repo). reduced/scheduled: estado final directo en un tick (delay 0). ──
  useEffect(() => {
    const T = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id }
    if (reduced || scheduled) {
      T(() => { setCurtain(!scheduled); setTitle(true); setLanterns(true) }, 0)
    } else {
      T(() => { setCurtain(true); play('playWhoosh') }, 30)
      T(() => setTitle(true), 420)
      T(() => { setLanterns(true); play('playClack') }, 660)
    }
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
    // play fuera de deps: telon one-shot; re-correrlo al togglear mute repetiria
    // la apertura. Mute gateado en play().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, scheduled])

  // ── Bucle de reproducción de la función ──
  useEffect(() => {
    if (modo !== 'funcion' || !playing) return undefined
    if (step >= total) {
      const stop = setTimeout(() => setPlaying(false), 0)  // detener: nunca síncrono
      return () => clearTimeout(stop)
    }
    const stepMs = (reduced ? 700 : 1400) / speed
    const local = []
    if (!reduced) {
      // El corte de tinta del paso (setCut) jamás se dispara síncrono en el
      // cuerpo del effect: arranca en un tick (delay 0) y se retira a 420ms.
      local.push(setTimeout(() => { setCut(true); play('playVerdictStamp') }, 0))   // corte: arranca
      local.push(setTimeout(() => setCut(false), 420 / speed))                // corte: se retira
      local.push(setTimeout(() => play('playAcunado'), (420 + 560) / speed))        // asiento del ganador
    }
    local.push(setTimeout(() => setStep((s) => Math.min(total, s + 1)), stepMs))
    return () => local.forEach(clearTimeout)
    // play fuera de deps: el bucle ya depende de step/playing; meter play
    // reprogramaria el paso al togglear mute. Mute gateado en play().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, step, modo, speed, reduced, total])

  // ── Foco del overlay (WCAG 2.4.3): al abrir la función movemos el foco a la
  // región; al salir lo restaura `salir` enfocando el botón "ver la función"
  // RECIÉN REMONTADO (no el nodo viejo, que el desmontaje del ControlBar deja
  // detached → el foco caería al <body>). rAF para no enfocar de forma síncrona
  // en el cuerpo del effect. ──
  useEffect(() => {
    if (modo !== 'funcion') return undefined
    const el = overlayRef.current
    if (!el) return undefined
    const id = requestAnimationFrame(() => el.focus())
    return () => cancelAnimationFrame(id)
  }, [modo])

  // ── Pausa de loops decorativos fuera del viewport (faroles/cian) ──
  // Observamos el HEADER del proscenio (donde viven los halos de los faroles),
  // no la raíz .teatro que enmarca toda la página: si observáramos la raíz,
  // siempre intersectaría y `.is-offscreen` nunca se activaría al scrollear.
  const rootRef = useRef(null)
  const prosceniioRef = useRef(null)
  useEffect(() => {
    const el = prosceniioRef.current
    if (!el || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver(([e]) => el.classList.toggle('is-offscreen', !e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Estado derivado de la función (idempotente). Solo se evalúa en el overlay.
  const bracketStep = modo === 'funcion' ? step : total
  const derived = useMemo(
    () => (hasRounds ? deriveBracketState(torneo, rounds, bracketStep) : { rondas: [], campeon: null }),
    [torneo, rounds, bracketStep, hasRounds],
  )
  const cutId = modo === 'funcion' && step < total ? guion.steps[step].matchId : null
  const showCoronation = modo === 'funcion' && step >= total && Boolean(derived.campeon)

  const narrator = useMemo(() => {
    if (modo !== 'funcion') return ''
    if (step >= total) return `Función completa: ${total} de ${total} duelos jugados. Campeón: ${derived.campeon?.nombre ?? ''}.`
    if (playing) return `Paso ${step + 1} de ${total}: ${guion.steps[step].narracion}`
    return valueTextPaso(step, guion)
  }, [modo, step, playing, total, guion, derived.campeon])

  // Solo abrimos la función si hay algo que representar (cuadro + ≥1 duelo).
  const puedeVerFuncion = finished && hasRounds && total > 0
  const verLaFuncion = () => {
    prevFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null
    setModo('funcion'); setStep(0); setPlaying(true); play('playClack')
  }
  const salir = () => {
    setModo('bracket'); setPlaying(false)
    // rAF corre tras el commit del remount del ControlBar → el botón existe.
    requestAnimationFrame(() => ctrlBtnRef.current?.focus())
  }
  const onStep = (v) => { setPlaying(false); setStep(v) }

  return (
    <div className="teatro" ref={rootRef} itemScope itemType="https://schema.org/SportsEvent" style={{ position: 'relative' }}>
      <span className="teatro-watermark" aria-hidden="true" lang="ja"
        style={{ position: 'absolute', right: '3%', top: 80, fontSize: 'clamp(8rem, 22vw, 20rem)', fontWeight: 900, zIndex: 0, lineHeight: 1 }}>戦</span>

      <Proscenio torneo={torneo} lanterns={lanterns} title={title} reduced={reduced} scheduled={scheduled} mobile={mobile} headerRef={prosceniioRef} />

      {scheduled && (
        <div style={{ position: 'relative', zIndex: 1, overflow: 'hidden', marginTop: 14, borderRadius: 'var(--radius-card)',
          border: '1px solid color-mix(in srgb,var(--color-gold) 14%, transparent)',
          background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-canvas) 60%, var(--color-bg)), var(--color-canvas))', minHeight: 280 }}>
          <Telon abre={false} />
          <Tablilla torneo={torneo} />
        </div>
      )}

      {/* Control de la función (solo FINISHED con cuadro representable). */}
      {puedeVerFuncion && (
        <div style={{ position: 'relative', zIndex: 3, margin: mobile ? '14px 0' : '16px 0 18px' }}>
          {modo === 'bracket' && <ControlBar onPlay={verLaFuncion} btnRef={ctrlBtnRef} />}
        </div>
      )}

      {/* OVERLAY de la función — réplica scrubbable + coronación (FINISHED). */}
      {modo === 'funcion' && layout && (
        <FuncionOverlay
          overlayRef={overlayRef}
          derived={derived} layout={layout} guion={guion} step={step}
          playing={playing} speed={speed} narrator={narrator} cut={cut} cutId={cutId}
          showCoronation={showCoronation} reduced={reduced} mobile={mobile}
          hrefPersonaje={hrefPersonaje}
          onStep={onStep} onPlay={setPlaying} onSpeed={setSpeed} onSalir={salir}
        />
      )}

      {/* El cuerpo real de la página vive DENTRO del marco. Se mantiene montado
          incluso bajo el overlay para no perder estado/red al volver. El telón
          de dos hojas se abre sobre el cuerpo al entrar (no en SCHEDULED, que
          tiene su propio telón cerrado sobre la Tablilla). */}
      <div style={{ position: 'relative', marginTop: 14, ...(modo === 'funcion' ? { display: 'none' } : null) }}>
        {!scheduled && <Telon abre={curtain} overBody />}
        {children}
      </div>
    </div>
  )
}

/* ── Subcomponentes a nivel de módulo (nunca dentro del componente) ── */

/** OVERLAY de la función: scrubber + réplica derivada + coronación al final. */
function FuncionOverlay({ overlayRef, derived, layout, guion, step, playing, speed, narrator, cut, cutId,
  showCoronation, reduced, mobile, hrefPersonaje, onStep, onPlay, onSpeed, onSalir }) {
  return (
    <div ref={overlayRef} tabIndex={-1} role="region" aria-label="Función del torneo"
      onKeyDown={(e) => { if (e.key === 'Escape') onSalir() }}
      style={{ position: 'relative', zIndex: 3, outline: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: mobile ? '100%' : 880, margin: mobile ? '0 0 14px' : '0 auto 14px' }}>
        <ShowTimeline guion={guion} step={step} playing={playing} speed={speed} narrator={narrator}
          onStep={onStep} onPlay={onPlay} onSpeed={onSpeed} />
        <button type="button" onClick={onSalir}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--color-fg-muted)', cursor: 'pointer', fontSize: 12.5, padding: '4px 2px', minHeight: 32 }}>
          ← volver al cuadro
        </button>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-card)',
        border: '1px solid color-mix(in srgb,var(--color-gold) 14%, transparent)',
        background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-canvas) 60%, var(--color-bg)), var(--color-canvas))',
        padding: mobile ? '18px 12px' : '8px 18px 26px', minHeight: 220 }}>
        {/* inert mientras la coronación está encima: saca del foco y del árbol
            de accesibilidad los rollos tapados (WCAG 2.4.3 / 1.3.2). */}
        <div inert={showCoronation || undefined} style={{ position: 'relative', zIndex: 1, overflow: mobile ? 'visible' : 'auto', paddingBottom: 8 }}>
          <ActRail derived={derived} layout={layout} modo="funcion" enter={false} act1Key={0}
            cutId={cutId} cutActive={cut && playing} liveRoundIdx={-1}
            reduced={reduced} mobile={mobile} hrefPersonaje={hrefPersonaje} />
        </div>
        {showCoronation && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center', padding: 16,
            background: 'color-mix(in srgb, var(--color-canvas) 72%, transparent)' }}>
            <div style={{ width: 'min(440px, 100%)' }}>
              <CoronationRite key={derived.campeon.slug} campeon={derived.campeon} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Proscenio = cabecera de la página. Contiene el ÚNICO <h1> y el microdata. */
function Proscenio({ torneo, lanterns, title, reduced, scheduled, mobile, headerRef }) {
  const corteCls = (title && !reduced && !scheduled) ? 'teatro-corte teatro-corte--play' : 'teatro-corte'
  const badge = getEstadoBadge(torneo.estado)
  const fechaInicioDate = parseDateSafe(torneo.fechaInicio)
  const fechaFinDate = parseDateSafe(torneo.fechaFinalizacion)
  const fechaInicioFmt = formatDateSafe(torneo.fechaInicio, { day: 'numeric', month: 'short', year: 'numeric' })
  const fechaFinFmt = formatDateSafe(torneo.fechaFinalizacion, { day: 'numeric', month: 'short', year: 'numeric' })
  const canonical = `https://animeshowdown.dev/torneos/${torneo.slug}`
  return (
    <header ref={headerRef} style={{ position: 'relative', zIndex: 2, padding: mobile ? '12px 14px 16px' : '16px 26px 22px',
      borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
      background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold) 16%, var(--color-canvas)), color-mix(in srgb,var(--color-accent) 24%, var(--color-canvas)) 60%, var(--color-canvas))',
      borderBottom: '2px solid color-mix(in srgb,var(--color-gold) 40%, transparent)',
      boxShadow: 'inset 0 1px 0 color-mix(in srgb,var(--color-gold-bright) 30%,transparent)' }}>
      <meta itemProp="url" content={canonical} />
      {fechaInicioDate && <meta itemProp="startDate" content={torneo.fechaInicio} />}
      {fechaFinDate && <meta itemProp="endDate" content={torneo.fechaFinalizacion} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 10 : 22 }}>
        {!mobile && <Lantern on={lanterns} offset={0} />}
        <div style={{ flex: 1, textAlign: 'center', position: 'relative', minWidth: 0 }}>
          <p className="font-mono" style={{ margin: 0, fontSize: mobile ? 9 : 10.5, letterSpacing: 2, color: 'var(--color-gold-pale)' }}><span lang="ja">番付</span> · la función del torneo</p>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <h1 itemProp="name" className="font-display" style={{ margin: '2px 0 0', fontSize: mobile ? 22 : 'clamp(26px, 4vw, 42px)', fontWeight: 900, lineHeight: 1.05,
              color: 'var(--color-gold-bright)', textShadow: '0 1px 0 color-mix(in srgb,var(--color-canvas) 80%,transparent), 0 -1px 1px color-mix(in srgb,var(--color-canvas) 60%,transparent)' }}>
              {torneo.nombre}
            </h1>
            <span aria-hidden="true" className={corteCls} style={{ '--teatro-corte-delay': '0ms' }} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '4px 12px', borderRadius: 'var(--radius-pill)',
            border: '1px solid color-mix(in srgb,var(--color-gold) 22%, transparent)', background: 'color-mix(in srgb,var(--color-surface) 70%, transparent)',
            fontSize: 12, fontWeight: 600, color: 'var(--color-fg-muted)' }}>
            <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </div>
          {torneo.descripcion && (
            <p itemProp="description" style={{ margin: '8px auto 0', maxWidth: 640, fontSize: mobile ? 12.5 : 13.5, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
              {torneo.descripcion}
            </p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: mobile ? 11 : 12.5, color: 'var(--color-fg-muted)' }}>
            {torneo.numParticipantes} personajes
            {fechaInicioFmt && ` · ${fechaInicioFmt}`}
            {fechaFinFmt && ` → ${fechaFinFmt}`}
          </p>
          {torneo?.id && (
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
              <ReactionsBar targetType="TORNEO" targetId={torneo.id} />
            </div>
          )}
        </div>
        {!mobile && <Lantern on={lanterns} offset={1.7} />}
      </div>
    </header>
  )
}

/** Farol lateral: encendido por fade, luego latido por cross-fade de opacity (pausable). */
function Lantern({ on, offset = 0 }) {
  return (
    <div aria-hidden="true" className={`teatro-farol ${on ? 'teatro-farol--on' : ''}`}
      style={{ position: 'relative', width: 56, height: 86, flex: '0 0 auto', '--teatro-flicker-offset': `${offset}s` }}>
      <div className="teatro-farol__halo" />
      <div style={{ position: 'absolute', inset: '8px 8px 14px', borderRadius: '40% 40% 36% 36% / 30%',
        background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold-bright) 78%, var(--color-canvas)), color-mix(in srgb,var(--color-accent) 50%, var(--color-canvas)))',
        border: '1px solid color-mix(in srgb,var(--color-canvas) 55%, var(--color-gold))',
        boxShadow: 'inset 0 0 14px color-mix(in srgb,var(--color-canvas) 60%, transparent)', display: 'grid', placeItems: 'center' }}>
        <span lang="ja" className="font-kanji-serif" style={{ color: 'color-mix(in srgb,var(--color-canvas) 75%, var(--color-accent))', fontSize: 22, fontWeight: 900 }}>祭</span>
      </div>
      <div style={{ position: 'absolute', top: 2, left: 14, right: 14, height: 7, borderRadius: 3, background: 'var(--color-canvas)' }} />
      <div style={{ position: 'absolute', bottom: 6, left: 16, right: 16, height: 7, borderRadius: 3, background: 'var(--color-canvas)' }} />
    </div>
  )
}

/**
 * Telón decorativo (aria-hidden) de dos hojas.
 * @param {boolean} props.abre  dispara la apertura (hojas salen ±102%, forwards).
 * @param {boolean} [props.overBody]  cubre el cuerpo de la página (enmarcado
 *   ligero IN_PROGRESS/FINISHED): SIEMPRE pointer-events:none para no bloquear
 *   nunca el bracket vivo; el contenedor del telón se limita a la franja
 *   superior, las hojas se retiran sobre ella al entrar.
 */
function Telon({ abre, overBody = false }) {
  const leaf = (lado) => (
    <div className={`teatro-telon__hoja teatro-telon__hoja--${lado}`} aria-hidden="true"
      style={{ position: 'absolute', top: 0, bottom: 0, width: '51%', [lado === 'izq' ? 'left' : 'right']: 0, zIndex: 5 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10,
        background: 'repeating-linear-gradient(90deg, var(--color-gold) 0 6px, color-mix(in srgb,var(--color-gold) 40%, var(--color-canvas)) 6px 12px)' }} />
    </div>
  )
  const wrapStyle = overBody
    ? { position: 'absolute', left: 0, right: 0, top: 0, height: 'clamp(220px, 40vh, 420px)', overflow: 'hidden', pointerEvents: 'none', zIndex: 4 }
    : undefined
  return (
    <div className={abre ? 'teatro-telon teatro-telon--abre' : 'teatro-telon'} aria-hidden="true" style={wrapStyle}>
      {leaf('izq')}{leaf('der')}
    </div>
  )
}

/** Barra de control "遊 ver la función" (solo FINISHED, fuera del overlay). */
function ControlBar({ onPlay, btnRef }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', padding: '12px 16px',
      borderRadius: 'var(--radius-card)', border: '1px solid color-mix(in srgb,var(--color-gold) 14%,transparent)', background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-gold)' }} />
        <span style={{ fontSize: 13, color: 'var(--color-fg)' }}>
          Torneo terminado · la obra puede representarse de principio a fin.
        </span>
      </div>
      <button type="button" ref={btnRef} onClick={onPlay}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 18px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
          fontSize: 14, fontWeight: 800, color: 'var(--color-fg-strong)', border: '1px solid color-mix(in srgb,var(--color-gold) 30%,transparent)',
          background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
          boxShadow: 'inset 0 1px 0 color-mix(in srgb,var(--color-fg-strong) 18%,transparent), 0 0 34px -16px var(--color-accent)' }}>
        <span lang="ja" aria-hidden="true" className="font-kanji-serif">遊</span> ver la función
      </button>
    </div>
  )
}

/** Tablilla de fecha para SCHEDULED (telón cerrado). Usa dateUtils (fechaInicio). */
function Tablilla({ torneo }) {
  const fecha = parseDateSafe(torneo.fechaInicio)
  const txt = fecha
    ? formatDateSafe(torneo.fechaInicio, { day: '2-digit', month: 'long', year: 'numeric' })
    : 'fecha por anunciar'
  const hora = fecha ? formatDateSafe(torneo.fechaInicio, { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div style={{ position: 'relative', zIndex: 7, display: 'grid', placeItems: 'center', minHeight: 280, padding: 20 }}>
      <div style={{ textAlign: 'center', padding: '22px 26px', borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold) 14%, var(--color-canvas)), color-mix(in srgb,var(--color-canvas) 80%, var(--color-gold)))',
        border: '2px solid color-mix(in srgb,var(--color-gold) 45%, transparent)',
        boxShadow: 'var(--shadow-elev-2), inset 0 1px 0 color-mix(in srgb,var(--color-gold-bright) 30%,transparent)', transform: 'rotate(-1.2deg)' }}>
        <span lang="ja" className="font-kanji-serif" aria-hidden="true" style={{ fontSize: 40, fontWeight: 900, color: 'var(--color-gold-bright)' }}>近日</span>
        <p style={{ margin: '8px 0 2px', fontSize: 13, color: 'var(--color-gold-pale)', fontFamily: 'var(--font-mono)' }}>PRÓXIMA FUNCIÓN</p>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-fg-strong)' }}>{txt}</p>
        {hora && <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}>{hora} · {torneo.numParticipantes} personajes</p>}
      </div>
    </div>
  )
}
