import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import './support-candle.css'

/**
 * SupportCandle — la meta del mes como vela votiva, no como progress bar.
 *
 * Razonamiento de diseño (Kessen):
 * - Columna fina de cera que se llena en ORO según el progreso (recibido /
 *   objetivo). El llenado anima transform: scaleY con origin-bottom — nunca
 *   height (compositor-only).
 * - La llama "respira" con cross-fade de opacity entre capas pre-renderizadas
 *   (halo + llama + núcleo): cero blur(), cero SVG filters, fiel a la regla
 *   anti-jank de Safari del proyecto.
 * - El bucle de la llama se pausa fuera del viewport (IntersectionObserver)
 *   y con la pestaña oculta (visibilitychange). reduced-motion = estático.
 * - recibido === 0 → vela sin encender, con microcopy que invita sin presión.
 *   Sustituye al antiguo "ocultar la meta si va a 0€": una vela apagada pide
 *   ser encendida; una barra a 0% comunica fracaso.
 * - Números en font-mono (datos), título en font-display. Voz agradecida.
 *
 * Uso: <SupportCandle recibido={META_RECIBIDO_EUR} objetivo={META_OBJETIVO_EUR} />
 */


function SupportCandle({ recibido = 0, objetivo = 25, mes }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const [visible, setVisible] = useState(true)
  const [pestanaOculta, setPestanaOculta] = useState(false)
  const [lista, setLista] = useState(false)

  const encendida = recibido > 0
  const progreso = Math.min(1, objetivo > 0 ? recibido / objetivo : 0)
  const pct = Math.round(progreso * 100)
  const mesAuto = new Date().toLocaleString('es-ES', { month: 'long' })
  const mesLabel = mes ?? mesAuto

  /* El llenado entra desde 0 al montar (un frame después). Con
     reduced-motion no hay clase de transición, así que ese mismo frame
     pinta el estado final — sin rama síncrona (regla del Compiler). */
  useEffect(() => {
    const id = requestAnimationFrame(() => setLista(true))
    return () => cancelAnimationFrame(id)
  }, [])

  /* Pausa del bucle fuera del viewport y con la pestaña oculta. */
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    io.observe(el)
    const onVisibility = () => setPestanaOculta(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const pausada = !visible || pestanaOculta

  return (
    <aside
      ref={ref}
      data-flame-paused={pausada ? '' : undefined}
      className="flex w-full max-w-[230px] flex-col items-center gap-4 text-center"
    >
      <div>
        <h2 className="whitespace-nowrap font-display text-lg font-bold text-fg-strong">La vela de {mesLabel}</h2>
        <p className="mt-1 font-mono text-2xs tabular-nums text-fg-muted">
          <strong className="font-semibold text-gold">{recibido}€</strong> / {objetivo}€ · {pct}%
        </p>
      </div>

      <div className="flex flex-col items-center">
        {encendida ? (
          <span aria-hidden="true" className="relative mb-0.5 block h-8 w-8">
            <span className="candle-halo absolute -inset-5 rounded-full bg-[radial-gradient(circle,var(--color-gold-aura-soft),transparent_65%)]"></span>
            <span className="candle-flame absolute inset-x-2 bottom-0 top-1 bg-[radial-gradient(circle_at_50%_78%,var(--color-gold-pale),var(--color-gold-bright)_55%,transparent_78%)]"></span>
            <span className="candle-flame-core absolute inset-x-3 bottom-0.5 top-3 bg-[radial-gradient(circle_at_50%_85%,var(--color-fg-strong),var(--color-gold-pale)_60%,transparent_80%)]"></span>
          </span>
        ) : null}
        {/* Pabilo */}
        <span aria-hidden="true" className="h-1.5 w-px bg-fg-muted/60"></span>

        {/* Columna de cera */}
        <div
          role="progressbar"
          aria-valuenow={recibido}
          aria-valuemin={0}
          aria-valuemax={objetivo}
          aria-label={`Apoyo recibido en ${mesLabel}: ${recibido} de ${objetivo} euros`}
          className="inset-shadow-hairline relative h-44 w-9 overflow-hidden rounded-lg border border-border bg-surface"
        >
          <div
            className={`absolute inset-0 origin-bottom bg-gradient-to-t from-gold via-gold-bright to-gold-pale ${
              reduce ? '' : 'transition-transform duration-700 ease-lift'
            }`}
            style={{ transform: `scaleY(${lista ? progreso : 0})` }}
          ></div>
          {/* Brillo lateral de la cera */}
          <span aria-hidden="true" className="absolute inset-y-0 left-1 w-px bg-fg-strong/20"></span>
        </div>
        {/* Peana */}
        <span aria-hidden="true" className="inset-shadow-hairline mt-1 h-2.5 w-16 rounded-full border border-border bg-surface-alt"></span>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-2xs leading-relaxed text-fg-muted">
          {encendida
            ? 'Cada ofrenda la llena un poco más. Si llega arriba, lo que sobre alumbra nuevos modos y más personajes.'
            : 'Aún sin encender este mes. La primera ofrenda, del tamaño que sea, la prende.'}
        </p>
        <p className="font-mono text-2xs text-fg-muted/70">objetivo: servidor + dominio</p>
      </div>
    </aside>
  )
}

export default SupportCandle
