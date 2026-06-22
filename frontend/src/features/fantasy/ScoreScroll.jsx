import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import './fantasy-bench.css'

/**
 * ScoreScroll — el acta del lunes de /fantasy.
 *
 * Pergamino que se DESENROLLA (scaleY origin-top, 500 ms, --ease-lift) y
 * revela línea a línea (stagger 150 ms) el resultado semanal de cada
 * personaje. El delta es un odómetro font-mono (verde-oro positivo, carmesí
 * negativo) y el TOTAL llega con sello hanko 計 estampado (--ease-stamp,
 * caída + overshoot + sangrado pre-horneado). Semana perfecta = sello doble
 * (計 + 完, el segundo 280 ms después).
 *
 * DECISIÓN DE PRODUCTO CERRADA: se puntúa el DELTA DE POSICIÓN del ranking.
 * Todo el copy lo dice así — "subió 4 puestos" — nunca "ganó ELO"
 * (criterio 2; centralizado en fmtMovimiento()).
 *
 * A11y: el acta es una <table> semántica con caption; al completarse, los
 * deltas se anuncian por aria-live (criterio responsive·a11y). Esc cierra.
 *
 * Reglas Kessen: tokens only, sin blur/filters (el sangrado del sello es un
 * box-shadow/text-shadow estático que cross-fadea en opacity), solo
 * transform/opacity, one-shot (cero loops), reduced-motion = estado final
 * directo. Secuenciado por timers, no por onfinish (los finish events se
 * difieren con la pestaña oculta).
 *
 * @param {object} props
 * @param {boolean} props.abierta — controlada por el host; al pasar a true
 *        se reproduce la coreografía completa.
 * @param {Array<{slug:string, nombre:string, delta:number}>} props.lineas
 *        Una por personaje; delta = puestos de ranking (+ sube / − baja).
 * @param {() => void} props.onCerrar
 * @param {string} [props.titulo='Acta de la semana']
 * @param {string} [props.fecha] — etiqueta mono de la cabecera (p. ej.
 *        "lunes · jornada 14"). SIN dato de producto: lo inyecta el host.
 * @param {() => void} [props.onCompleta] — al terminar la coreografía.
 */
function ScoreScroll({ abierta, lineas, onCerrar, titulo = 'Acta de la semana', fecha, onCompleta }) {
  const reduced = useReducedMotion()
  const { play } = useSound()
  const dialogRef = useRef(null)
  const paperRef = useRef(null)
  const closeRef = useRef(null)
  const timersRef = useRef(new Set())
  const rafsRef = useRef(new Set())
  const [announce, setAnnounce] = useState('')
  const [run, setRun] = useState(0) // bump = replay

  // Contrato a11y de modal (trap de Tab, Escape, scroll-lock, restore de foco)
  // SIN tocar la coreografía del pergamino: el foco inicial va al botón cerrar
  // (igual que ya hacía la coreografía). No reusamos AccessibleDialog porque su
  // chrome + puertas shōji romperían el acta desenrollándose.
  useFocusTrap(dialogRef, { open: abierta, onClose: onCerrar, initialFocusRef: closeRef })

  const total = lineas.reduce((a, l) => a + l.delta, 0)
  const perfecta = lineas.length > 0 && lineas.every((l) => l.delta > 0)

  const after = useCallback((ms, fn) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn() }, ms)
    timersRef.current.add(id)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
    // Cancela los rAF del odómetro: sin esto, al "repetir acta" dos loops
    // escriben el mismo span a la vez (y siguen tras desmontar).
    rafsRef.current.forEach(cancelAnimationFrame)
    rafsRef.current.clear()
  }, [])

  const fmtDelta = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0')
  /** ÚNICO punto de copy del movimiento: posición, no ELO (criterio 2). */
  const fmtMovimiento = (d) =>
    d > 0 ? `subió ${d} ${d === 1 ? 'puesto' : 'puestos'}`
      : d < 0 ? `bajó ${Math.abs(d)} ${d === -1 ? 'puesto' : 'puestos'}`
        : 'mantiene su posición'

  /** Odómetro sobre ref.textContent (>1×/frame: nunca estado). */
  const odometer = useCallback((el, target, dur) => {
    if (!el) return
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1)
      el.textContent = fmtDelta(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) rafsRef.current.add(requestAnimationFrame(step))
    }
    rafsRef.current.add(requestAnimationFrame(step))
    after(dur + 80, () => { el.textContent = fmtDelta(target) })
  }, [after])

  const stamp = useCallback((el, bleedEl, rot) => {
    if (!el) return
    if (reduced) { el.animate([{ opacity: 1 }], { duration: 1, fill: 'forwards' }); return }
    el.animate([
      { opacity: 0, transform: `translateY(-46px) scale(1.65) rotate(${rot - 8}deg)` },
      { opacity: 1, offset: 0.25 },
      { opacity: 1, transform: `translateY(0) scale(1) rotate(${rot}deg)` },
    ], { duration: 420, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'forwards' }) // ease-stamp
    after(230, () => {
      play('playAcunado')
      paperRef.current?.animate([
        { transform: 'scaleY(1) translate(0,0)' }, { transform: 'scaleY(1) translate(-2px,1px)' },
        { transform: 'scaleY(1) translate(2px,-1px)' }, { transform: 'scaleY(1) translate(0,0)' },
      ], { duration: 110, easing: 'linear' })
      bleedEl?.animate(
        [{ opacity: 0.85, transform: `rotate(${rot}deg) scale(1.14)` }, { opacity: 0, transform: `rotate(${rot}deg) scale(1)` }],
        { duration: 600, easing: 'ease-out', fill: 'forwards' },
      )
    })
  }, [after, play, reduced])

  // Coreografía completa: corre al abrir y en cada replay (run).
  useEffect(() => {
    if (!abierta) return undefined
    const paper = paperRef.current
    if (!paper) return undefined
    const D = reduced ? 0 : 1
    const LIFT = 'cubic-bezier(0.16,1,0.3,1)'
    closeRef.current?.focus()
    play('playWhoosh')

    paper.animate(
      [{ opacity: 0, transform: 'scaleY(0.02)' }, { opacity: 1, transform: 'scaleY(1)' }],
      { duration: Math.max(1, 500 * D), easing: LIFT, fill: 'forwards' },
    )
    lineas.forEach((ln, i) => {
      after((500 + i * 150) * D, () => {
        const row = paper.querySelector(`[data-ss-row="${i}"]`)
        row?.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: Math.max(1, 320 * D), easing: LIFT, fill: 'forwards' },
        )
        if (!reduced) odometer(paper.querySelector(`[data-ss-num="${i}"]`), ln.delta, 400)
      })
    })
    const tTotal = (500 + lineas.length * 150 + 150) * D
    after(tTotal, () => {
      paper.querySelector('[data-ss-total-row]')?.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: Math.max(1, 320 * D), easing: LIFT, fill: 'forwards' },
      )
      if (!reduced) odometer(paper.querySelector('[data-ss-total]'), total, 500)
    })
    const tSeal = tTotal + 420 * D
    after(tSeal, () => stamp(paper.querySelector('[data-ss-seal="1"]'), paper.querySelector('[data-ss-bleed="1"]'), -6))
    if (perfecta) after(tSeal + 280 * D, () => stamp(paper.querySelector('[data-ss-seal="2"]'), paper.querySelector('[data-ss-bleed="2"]'), 7))
    after(tSeal + 800 * D + 10, () => {
      setAnnounce(`Acta completa. ${lineas.map((l) => `${l.nombre} ${fmtMovimiento(l.delta)}`).join('. ')}. Balance total: ${fmtDelta(total)} puestos.${perfecta ? ' Semana perfecta: sello doble.' : ''}`)
      onCompleta?.()
    })
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, run])

  if (!abierta) return null

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-60 grid place-items-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-canvas/80" onClick={onCerrar} aria-hidden="true" />
      <div className="relative w-full max-w-[540px]">
        <div className="sb-scroll-rod relative z-[2]" aria-hidden="true" />
        <div ref={paperRef} className="sb-paper relative -mt-1 mx-2 origin-top rounded-b-2xl rounded-t px-6 py-6 opacity-0" style={{ transform: 'scaleY(0.02)' }}>
          {fecha && <p className="m-0 font-mono text-2xs text-canvas/55">{fecha}</p>}
          <h2 className="font-kanji-serif mb-0.5 mt-1 text-[23px] font-bold text-canvas">{titulo}</h2>
          <p className="mb-4 mt-0 font-mono text-2xs text-canvas/60">se puntúa el cambio de posición en el ranking — no el ELO</p>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Resultado semanal por personaje: puestos de ranking ganados o perdidos</caption>
            <thead>
              <tr className="text-left font-mono text-[10.5px] text-canvas/50">
                <th scope="col" className="border-b border-canvas/25 pb-1.5 font-medium">personaje</th>
                <th scope="col" className="border-b border-canvas/25 pb-1.5 font-medium">movimiento</th>
                <th scope="col" className="border-b border-canvas/25 pb-1.5 text-right font-medium">puestos</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((ln, i) => (
                <tr key={ln.slug} data-ss-row={i} className="opacity-0">
                  <td className="border-b border-canvas/10 py-2 font-semibold">{ln.nombre}</td>
                  <td className="border-b border-canvas/10 py-2 text-canvas/65">{fmtMovimiento(ln.delta)}</td>
                  <td className={`border-b border-canvas/10 py-2 text-right font-mono text-[15px] font-bold ${ln.delta >= 0 ? 'text-scroll-up' : 'text-scroll-down'}`}>
                    <span data-ss-num={i}>{fmtDelta(ln.delta)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr data-ss-total-row className="opacity-0">
                <td colSpan={2} className="pt-3 font-bold">balance de la semana</td>
                <td className={`pt-3 text-right font-mono text-lg font-extrabold ${total >= 0 ? 'text-scroll-up' : 'text-scroll-down'}`}>
                  <span data-ss-total>{fmtDelta(total)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="flex min-h-[104px] items-center justify-end gap-3 pr-1.5 pt-2.5">
            {perfecta && <Seal n="2" kanji="完" rot={7} className="-mr-6 h-[78px] w-[78px]" />}
            <Seal n="1" kanji="計" rot={-6} />
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <button type="button" onClick={() => { clearTimers(); setRun((r) => r + 1) }} className="min-h-11 rounded-pill border border-canvas/35 px-4 font-mono text-xs text-canvas hover:border-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">↻ repetir acta</button>
            <button type="button" ref={closeRef} onClick={onCerrar} className="min-h-11 rounded-pill bg-canvas px-4 font-mono text-xs text-fg-strong hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">cerrar</button>
          </div>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{announce}</div>
    </div>
  )
}

/* Sello hanko del acta (computado fuera del render del scroll). */
function Seal({ n, kanji, rot, className = '' }) {
  return (
    <div className={`relative h-[86px] w-[86px] ${className}`}>
      <div data-ss-seal={n} lang="ja" className="absolute inset-0 grid place-items-center rounded-xl border-[3px] border-hanko bg-hanko/5 text-[46px] font-bold text-hanko opacity-0" style={{ transform: `rotate(${rot}deg)`, backfaceVisibility: 'hidden' }}>{kanji}</div>
      <div data-ss-bleed={n} aria-hidden="true" className="sb-seal-bleed absolute inset-0 rounded-xl opacity-0" style={{ transform: `rotate(${rot}deg)` }} />
    </div>
  )
}

export default ScoreScroll
