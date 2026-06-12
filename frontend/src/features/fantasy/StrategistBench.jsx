import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext'
import './fantasy-bench.css'
import PersonajeImg from '../../components/PersonajeImg'
import MonedaIcon from '../../components/MonedaIcon'

/**
 * StrategistBench — el vestuario del estratega de /fantasy.
 *
 * 5 taquillas de madera lacada (recetas visuales en index.css: .sb-locker-wood),
 * presupuesto como pila física de monedas, banderín colgante con cuenta atrás
 * y mercado de cartas 2:3. Coreografías de fichaje/venta/rechazo con WAAPI
 * (solo transform/opacity, cancelables — ver _flights).
 *
 * Reglas Kessen que cumple:
 *  - Cero hex en JSX: todo via tokens Tailwind / var(--color-*).
 *  - Sin blur ni SVG filters; el "respirar" de la percha y el sway del
 *    banderín son keyframes CSS transform/opacity (index.css, sb-*).
 *  - Loops pausados con html.as-tab-hidden y con [data-offscreen] (IO propio).
 *  - prefers-reduced-motion: fichaje/venta directos, monedas = solo "−N".
 *  - React 19 + Compiler: nada de setState síncrono al inicio de effects,
 *    refs solo en handlers/effects; lo que cambia >1×/frame (odómetro del
 *    presupuesto) se escribe via ref.textContent, no estado.
 *
 * Coreografía FICHAR (500 ms total, 2 animaciones WAAPI encadenadas):
 *  0–240    subida al ápex con arco fingido (rotate +2°, ease de salida)
 *  240–500  caída (ease-in cargado) con squash al aterrizar (offset .86)
 *  +200     monedas pila→taquilla (stagger 30 ms, máx 8) + "−coste" en mono
 *  El commit (onFichar) dispara AL ATERRIZAR — cancelar el vuelo con
 *  cancelFlights() commitea o revierte sin estados zombis.
 *
 * VENDER: vuelo inverso (taquilla→mercado) + monedas regresan + "+coste".
 * RECHAZO (presupuesto insuficiente): la carta vuela, REBOTA en la taquilla
 *  (contacto a ~410 ms, clink seco, retorno 200 ms) y la pila tiembla 1 px.
 *  Se entiende sin leer: no hay toast.
 *
 * @param {object} props
 * @param {Array<{slug:string,nombre:string,anime:string,coste:number}|null>} props.equipo
 *        Las 5 taquillas; null = percha libre. SIEMPRE longitud 5.
 * @param {Array<{slug:string,nombre:string,anime:string,coste:number}>} props.mercado
 *        Cartas disponibles (sin los ya fichados).
 * @param {number} props.presupuesto — monedas disponibles.
 * @param {(slug:string, slot:number) => void} props.onFichar
 *        Commit del fichaje. Se llama al ATERRIZAR la carta (o al instante
 *        con reduced-motion). El host descuenta el coste y actualiza equipo.
 * @param {(slug:string, slot:number) => void} props.onVender
 *        Commit de la venta. Se llama al INICIAR el vuelo inverso.
 * @param {'draft'|'cerrada'|'puntuando'} [props.estado='draft']
 *        'cerrada'/'puntuando' sellan las taquillas (cordón + 封, inputs
 *        deshabilitados, inmutable también visualmente). 'puntuando' además
 *        pone el banderín en "puntuando…".
 * @param {string|number|Date} [props.cierre]
 *        Deadline del banderín. SIN dato de producto aquí: el dueño del
 *        calendario semanal lo inyecta (ver NOTAS-HANDOFF).
 * @param {string} [props.className]
 */
function StrategistBench({
  equipo,
  mercado,
  presupuesto,
  onFichar,
  onVender,
  estado = 'draft',
  cierre,
  className = '',
}) {
  const reduced = useReducedMotion()
  const { play } = useSound()
  const sealed = estado === 'cerrada' || estado === 'puntuando'

  const rootRef = useRef(null)
  const budgetRef = useRef(null)
  const pileRef = useRef(null)
  const marketRef = useRef(null)
  // Registro de vuelos vivos: slug → { cancel() }. cancelFlights() corta
  // clones y timers sin dejar estados zombis (criterio 1).
  const flightsRef = useRef(new Map())
  const timersRef = useRef(new Set())
  const reservedRef = useRef(new Set())
  const [announce, setAnnounce] = useState('')
  const [enVuelo, setEnVuelo] = useState(() => new Set())

  // ---- utilidades de coreografía -----------------------------------------

  const after = useCallback((ms, fn) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn() }, ms)
    timersRef.current.add(id)
    return id
  }, [])

  const cancelFlights = useCallback(() => {
    flightsRef.current.forEach((f) => f.cancel())
    flightsRef.current.clear()
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
    reservedRef.current.clear()
    setEnVuelo(new Set())
  }, [])

  useEffect(() => cancelFlights, [cancelFlights]) // limpieza al desmontar

  // Pausa de loops fuera de viewport: marca [data-offscreen] en el root;
  // index.css pausa .sb-loop bajo ese atributo (y bajo html.as-tab-hidden).
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => {
      el.toggleAttribute('data-offscreen', !e.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /** Vuelo FLIP con arco fingido. Secuenciado por timers (no onfinish):
   *  los finish events se difieren en pestañas ocultas y dejarían el commit
   *  colgado; los timers commitean siempre. */
  const flyCard = useCallback((opts) => {
    const { fromEl, toEl, targetW, bounce, key, onContact, onLand, onDone } = opts
    if (!fromEl || !toEl || reduced) { onLand?.(); onDone?.(); return }
    const a = fromEl.getBoundingClientRect()
    const b = toEl.getBoundingClientRect()
    const clone = fromEl.cloneNode(true)
    clone.removeAttribute('id')
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
    Object.assign(clone.style, {
      position: 'fixed', left: `${a.left}px`, top: `${a.top}px`,
      width: `${a.width}px`, height: `${a.height}px`, margin: '0',
      zIndex: '80', pointerEvents: 'none', transformOrigin: '50% 50%',
      transition: 'none',
    })
    document.body.appendChild(clone)
    const s = (targetW || a.width) / a.width
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2)
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2)
    const apex = `translate(${dx * 0.45}px,${dy * 0.45 - 64}px) rotate(2deg) scale(${1 + (s - 1) * 0.5})`
    let done = false
    flightsRef.current.set(key, {
      cancel: () => { if (done) return; done = true; clone.remove(); flightsRef.current.delete(key) },
    })
    clone.animate(
      [{ transform: 'translate(0,0) rotate(0deg) scale(1)' }, { transform: apex }],
      { duration: 240, easing: 'cubic-bezier(0.3,0.1,0.35,1)', fill: 'forwards' },
    )
    after(240, () => {
      if (done) return
      if (bounce) {
        const hit = `translate(${dx * 0.92}px,${dy * 0.92}px) scale(${s})`
        clone.animate([{ transform: apex }, { transform: hit }],
          { duration: 170, easing: 'cubic-bezier(0.55,0,0.9,0.6)', fill: 'forwards' })
        after(170, () => {
          if (done) return
          onContact?.()
          clone.animate([
            { transform: hit },
            { transform: `translate(${dx * 0.86}px,${dy * 0.86}px) rotate(-2deg) scale(${s * 1.02})`, offset: 0.3 },
            { transform: 'translate(0,0) rotate(0deg) scale(1)' },
          ], { duration: 200, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' })
          after(200, () => { done = true; clone.remove(); flightsRef.current.delete(key); onDone?.() })
        })
      } else {
        const land = `translate(${dx}px,${dy}px) rotate(0deg)`
        clone.animate([
          { transform: apex, easing: 'cubic-bezier(0.55,0,0.9,0.55)' },
          { transform: `${land} scale(${s})`, offset: 0.72, easing: 'ease-out' },
          { transform: `${land} scale(${s * 1.05},${s * 0.92})`, offset: 0.86, easing: 'ease-out' },
          { transform: `${land} scale(${s})` },
        ], { duration: 260, fill: 'forwards' })
        after(190, () => { if (!done) onContact?.() })
        after(260, () => {
          if (done) return
          done = true
          flightsRef.current.delete(key)
          onLand?.()
          after(40, () => { clone.remove(); onDone?.() })
        })
      }
    })
  }, [after, reduced])

  /** Monedas pila↔taquilla. Con reduced-motion solo el contador "−N"/"+N". */
  const flyCoins = useCallback((slotEl, coste, dir) => {
    const pile = pileRef.current
    if (!pile) return
    // etiqueta mono flotante (también en reduced-motion: es el contador)
    const r = pile.getBoundingClientRect()
    const label = document.createElement('div')
    label.textContent = `${dir < 0 ? '−' : '+'}${coste}`
    label.className = `sb-float-label ${dir < 0 ? 'text-accent-text' : 'text-gold-bright'}`
    Object.assign(label.style, { left: `${r.left + r.width / 2}px`, top: `${r.top - 4}px` })
    document.body.appendChild(label)
    after(950, () => label.remove())
    if (reduced || !slotEl) return
    const sr = slotEl.getBoundingClientRect()
    const n = Math.min(8, Math.max(3, Math.round(coste / 35)))
    for (let i = 0; i < n; i++) {
      after(i * 30, () => {
        const from = dir < 0 ? r : sr
        const to = dir < 0 ? sr : r
        const x0 = from.left + from.width / 2 - 28
        const y0 = dir < 0 ? from.bottom - 22 - i * 9 : from.top + from.height / 2 - 8
        const c = document.createElement('div')
        c.className = 'sb-coin sb-coin-flying'
        Object.assign(c.style, { left: `${x0}px`, top: `${y0}px` })
        document.body.appendChild(c)
        const dx = (to.left + to.width / 2) - (x0 + 28)
        const dy = (to.top + to.height / 2) - (y0 + 8)
        c.animate([
          { transform: 'translate(0,0) scale(1)' },
          { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 36}px) scale(0.9)`, offset: 0.5 },
          { transform: `translate(${dx}px,${dy}px) scale(0.7)`, opacity: 0.85 },
        ], { duration: 420, easing: 'cubic-bezier(0.3,0.05,0.45,1)', fill: 'forwards' })
        after(450, () => c.remove())
      })
    }
  }, [after, reduced])

  // ---- acciones -----------------------------------------------------------

  const fichar = useCallback((item) => {
    if (sealed || enVuelo.has(item.slug)) return
    let slot = -1
    for (let i = 0; i < equipo.length; i++) {
      if (!equipo[i] && !reservedRef.current.has(i)) { slot = i; break }
    }
    if (slot < 0) { setAnnounce('No hay taquillas libres.'); return }
    const cardEl = document.getElementById(`sb-mk-${item.slug}`)
    const slotEl = document.getElementById(`sb-slot-${slot}`)

    if (item.coste > presupuesto) {
      // RECHAZO: rebote + clink + temblor de pila. Sin texto (criterio 3);
      // el aria-live sí lo verbaliza para lectores de pantalla.
      setAnnounce(`Presupuesto insuficiente: ${item.nombre} cuesta ${item.coste} y quedan ${presupuesto}.`)
      if (reduced) { play('playPackFlip'); return }
      setEnVuelo((s) => new Set(s).add(item.slug))
      flyCard({
        fromEl: cardEl, toEl: slotEl, targetW: 152, bounce: true, key: `mk-${item.slug}`,
        onContact: () => {
          play('playPackFlip')
          pileRef.current?.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(1px)' }, { transform: 'translateX(-1px)' }, { transform: 'translateX(1px)' }, { transform: 'translateX(0)' }],
            { duration: 200, easing: 'linear' },
          )
        },
        onDone: () => setEnVuelo((s) => { const n = new Set(s); n.delete(item.slug); return n }),
      })
      return
    }

    reservedRef.current.add(slot)
    play('playWhoosh')
    setEnVuelo((s) => new Set(s).add(item.slug))
    after(200, () => flyCoins(slotEl, item.coste, -1))
    flyCard({
      fromEl: cardEl, toEl: slotEl, targetW: 152, key: `mk-${item.slug}`,
      onContact: () => play('playImpact'),
      onLand: () => {
        reservedRef.current.delete(slot)
        setEnVuelo((s) => { const n = new Set(s); n.delete(item.slug); return n })
        setAnnounce(`${item.nombre} fichado por ${item.coste} monedas.`)
        onFichar(item.slug, slot)
      },
    })
  }, [after, enVuelo, equipo, flyCard, flyCoins, onFichar, play, presupuesto, reduced, sealed])

  const vender = useCallback((slot) => {
    if (sealed) return
    const item = equipo[slot]
    if (!item || flightsRef.current.has(`lk-${slot}`)) return
    play('playWhoosh')
    flyCoins(document.getElementById(`sb-slot-${slot}`), item.coste, 1)
    flyCard({
      fromEl: document.getElementById(`sb-card-${slot}`),
      toEl: marketRef.current, targetW: 136, key: `lk-${slot}`,
      onContact: () => play('playImpact'),
    })
    setAnnounce(`${item.nombre} vendido. Recuperas ${item.coste} monedas.`)
    onVender(item.slug, slot) // commit al iniciar el vuelo inverso
  }, [equipo, flyCard, flyCoins, onVender, play, sealed])

  // ---- banderín: cuenta atrás --------------------------------------------

  const [countdown, setCountdown] = useState('')
  useEffect(() => {
    if (!cierre || estado === 'puntuando') return undefined
    const target = new Date(cierre).getTime()
    const fmt = () => {
      let ms = Math.max(0, target - Date.now())
      const d = Math.floor(ms / 86400000); ms -= d * 86400000
      const h = Math.floor(ms / 3600000); ms -= h * 3600000
      const m = Math.floor(ms / 60000); ms -= m * 60000
      const s = Math.floor(ms / 1000)
      const p = (n) => String(n).padStart(2, '0')
      return `${d}d ${p(h)}:${p(m)}:${p(s)}`
    }
    const primero = setTimeout(() => setCountdown(fmt()), 0)
    const id = setInterval(() => setCountdown(fmt()), 1000)
    return () => {
      clearTimeout(primero)
      clearInterval(id)
    }
  }, [cierre, estado])

  const nCoins = Math.max(0, Math.min(12, Math.round(presupuesto / 60)))
  const coinJit = useMemo(() => [10, 16, 8, 18, 12, 6, 16, 10, 14, 8, 17, 11], [])

  // ---- render ---------------------------------------------------------------

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* banderín */}
      <div className="pointer-events-none absolute -top-2 right-3 z-10 sm:right-6" aria-hidden={false}>
        <div className="sb-pennant-rod" />
        <div className="sb-loop sb-pennant-sway mx-auto w-[106px] origin-top">
          <div className="sb-pennant flex flex-col items-center gap-1.5 px-2 pb-8 pt-3.5">
            <span lang="ja" className="font-kanji-serif text-3xl font-bold leading-none text-gold-pale">締</span>
            <span className="font-mono text-2xs text-fg-strong/75">cierre semanal</span>
            {estado === 'puntuando' ? (
              <span className="font-mono text-xs font-bold text-gold-pale">
                puntuando<span className="sb-loop sb-dot">.</span><span className="sb-loop sb-dot [animation-delay:0.2s]">.</span><span className="sb-loop sb-dot [animation-delay:0.4s]">.</span>
              </span>
            ) : (
              <span className="whitespace-nowrap font-mono text-[13px] font-bold text-fg-strong">{countdown}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:gap-6">
        {/* taquillas */}
        <div role="list" aria-label="Tu equipo: cinco taquillas" className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-0.5 pb-2 pt-1.5">
          {equipo.map((item, i) => (
            <div key={i} role="listitem" className="sb-locker-wood relative flex-none snap-start rounded-2xl p-2.5 pb-3" style={{ width: 188 }}>
              <div className="sb-locker-grain pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true" />
              <div className="relative flex items-center gap-2 rounded-lg border border-gold/30 bg-black/30 px-2.5 py-1.5">
                <span className="font-mono text-2xs text-gold">{`0${i + 1}`}</span>
                <span className="truncate text-xs font-semibold text-fg">{item ? item.nombre : 'taquilla libre'}</span>
              </div>
              <div id={`sb-slot-${i}`} className="relative mt-2.5 grid h-[252px] place-items-center overflow-hidden rounded-xl border border-white/5 bg-gradient-to-b from-canvas to-surface/60">
                {item ? (
                  <button
                    type="button"
                    id={`sb-card-${i}`}
                    onClick={() => vender(i)}
                    disabled={sealed}
                    aria-label={`Vender a ${item.nombre} y recuperar ${item.coste} monedas`}
                    title="Vender (recupera las monedas)"
                    className="relative h-[228px] w-[152px] overflow-hidden rounded-xl border border-border bg-surface-alt transition-[transform,border-color] duration-200 ease-lift hover:-translate-y-0.5 hover:border-border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-default"
                  >
                    <PersonajeImg slug={item.slug} nombre={item.nombre} alt="" fit="cover" loading="lazy" sizes="152px" className="absolute inset-0 h-full w-full" />
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-black/55 px-2 py-0.5 font-mono text-2xs font-bold text-gold">
                      <MonedaIcon className="h-3 w-3" />{item.coste}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8 text-center">
                      <span className="block text-xs font-bold text-fg-strong">{item.nombre}</span>
                      <span className="block text-2xs text-fg-muted">{item.anime}</span>
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="sb-loop sb-invite pointer-events-none absolute inset-1.5 rounded-xl border border-gold/30" aria-hidden="true" />
                    <div className="grid place-items-center gap-2.5">
                      <div className="sb-loop sb-hanger-bob origin-top" aria-hidden="true">
                        <svg width="64" height="46" viewBox="0 0 64 46" fill="none">
                          <path d="M32 13 q0 -8 7 -8" className="stroke-gold" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
                          <path d="M7 38 L32 15 L57 38 Z" className="stroke-gold" strokeWidth="2.5" strokeLinejoin="round" opacity="0.75" />
                        </svg>
                      </div>
                      <span className="font-mono text-2xs text-fg-muted/75">libre</span>
                    </div>
                  </>
                )}
              </div>
              <div className="relative mt-2.5 grid gap-1 px-7" aria-hidden="true">
                <div className="h-0.5 rounded-full bg-white/5" /><div className="h-0.5 rounded-full bg-white/5" /><div className="h-0.5 rounded-full bg-white/5" />
              </div>
              {sealed && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
                  <div className="absolute inset-0 bg-canvas/25" />
                  <div className="sb-cord absolute -left-[14%] -right-[14%] top-[47%] h-1.5 -rotate-[7deg]" />
                  <div lang="ja" className="font-kanji-serif absolute left-1/2 top-[42%] grid h-10 w-9 -translate-x-1/2 -rotate-[5deg] place-items-center rounded bg-fg-strong text-xl font-bold text-hanko shadow-elev-1">封</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* presupuesto: pila física */}
        <div className="flex w-[96px] flex-col items-center gap-1.5 pb-3 sm:w-[150px]">
          <span className="font-mono text-2xs text-fg-muted">presupuesto</span>
          <span ref={budgetRef} className="font-mono text-3xl font-extrabold leading-none text-gold">{presupuesto}</span>
          <div ref={pileRef} role="img" aria-label={`Pila de monedas: ${presupuesto} disponibles`} className="relative mt-1.5 h-[158px] w-[90px]">
            {Array.from({ length: nCoins }, (_, i) => (
              <div key={i} className="sb-coin absolute" style={{ left: coinJit[i % coinJit.length], bottom: i * 11 }} aria-hidden="true" />
            ))}
          </div>
        </div>
      </div>

      {/* mercado */}
      <section aria-label="Mercado de fichajes" className="mt-6">
        <div className="mb-3.5 flex flex-wrap items-baseline gap-2.5">
          <h2 className="text-[15px] font-semibold text-fg">mercado</h2>
          <span lang="ja" aria-hidden="true" className="font-kanji-serif text-[15px] text-gold/55">市</span>
          <span className="font-mono text-2xs text-fg-muted">Enter ficha la carta enfocada · clic en una taquilla vende</span>
        </div>
        <div ref={marketRef} className="flex snap-x snap-proximity gap-3.5 overflow-x-auto px-0.5 pb-4 pt-1">
          {mercado.map((m) => {
            const caro = m.coste > presupuesto
            return (
              <button
                key={m.slug}
                type="button"
                id={`sb-mk-${m.slug}`}
                onClick={() => fichar(m)}
                disabled={sealed}
                aria-label={`Fichar a ${m.nombre} (${m.anime}) por ${m.coste} monedas${caro ? '. Presupuesto insuficiente' : ''}`}
                className={`relative h-[204px] w-[136px] flex-none snap-start overflow-hidden rounded-xl border border-border bg-surface-alt transition-[transform,border-color,opacity] duration-200 ease-lift hover:-translate-y-0.5 hover:border-border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${enVuelo.has(m.slug) ? 'opacity-0' : caro ? 'opacity-55' : ''}`}
              >
                <PersonajeImg slug={m.slug} nombre={m.nombre} alt="" fit="cover" loading="lazy" sizes="136px" className="absolute inset-0 h-full w-full" />
                <span className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-2xs font-bold ${caro ? 'border border-accent/55 bg-accent-soft text-accent-text' : 'border border-gold/30 bg-black/55 text-gold'}`}>
                  <MonedaIcon className="h-3 w-3" />{m.coste}
                </span>
                <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-7 text-center">
                  <span className="block text-xs font-bold text-fg-strong">{m.nombre}</span>
                  <span className="block text-2xs text-fg-muted">{m.anime}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div aria-live="polite" className="sr-only">{announce}</div>
    </div>
  )
}

export default StrategistBench
