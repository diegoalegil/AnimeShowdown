import { Children, cloneElement, useEffect, useId } from 'react'
import './kanban-tooltip.css'

/* ============================================================================
   KanbanTooltip — «Las etiquetas del archivo»
   Tablilla kanban (札) que cuelga de un hilo de 1px desde el ancla.
   Sustituye a los title= nativos.

   Arquitectura:
   - UNA capa singleton (#kt-layer) fuera del árbol de React: el ancla nunca
     re-renderiza por actividad del tooltip. El wrapper solo clona el hijo
     añadiendo data-kt y registra el contenido en un Map módulo-level.
   - UN set de listeners delegados en document (pointerover/out, focusin/out,
     keydown, pointerdown/up/cancel) + scroll/resize con rAF coalescado.
     Jamás un listener por ancla.
   - Animaciones por CLASE CSS (kt-enter / kt-enter-chain / kt-leave) definidas
     en index.css — CSP por hash: cero <style> en runtime, cero estilos inline
     animados. Solo transform/opacity.
   - Posicionamiento: fallback medido (getBoundingClientRect, escritura única
     de left/top — no se anima). CSS anchor positioning queda tras el
     kill-switch KT_USE_NATIVE_ANCHOR (ver NOTAS-HANDOFF §3): aun con soporte
     nativo, el pliegue/hilo necesita la medida del clamp, así que el camino
     medido sigue siendo el canónico hasta validar Safari TP.

   Timing (única fuente: NOTAS-HANDOFF §1):
   OPEN_DELAY 300ms · SWING 240ms · CHAIN_GRACE 400ms · FADE_OUT 120ms ·
   LONG_PRESS 350ms.
============================================================================ */

const OPEN_DELAY = 300
const CHAIN_GRACE = 400
const LONG_PRESS = 350
const THREAD = 12 // px de hilo entre ancla y tablilla
const MARGIN = 8 // clamp respecto al viewport
const LAYER_ID = 'kt-layer'

/** Kill-switch del posicionamiento nativo (anchor positioning). */
const KT_USE_NATIVE_ANCHOR = false

/** @type {Map<string, {variant: 'help'|'data', content?: string, value?: string, label?: string}>} */
const registry = new Map()

let layer = null
let swing = null
let tablet = null
let thread = null
let fold = null
let hole = null

let openAnchor = null
let escAnchor = null
let lastClose = 0
let lastTouch = 0
let showTimer = 0
let lpTimer = 0
let rafId = 0

function el(className) {
  const d = document.createElement('div')
  d.className = className
  return d
}

function closestAnchor(node) {
  return node && node.closest ? node.closest('[data-kt]') : null
}

function setContent(cfg) {
  tablet.textContent = ''
  if (cfg.variant === 'data') {
    const v = el('kt-value')
    v.textContent = cfg.value ?? '—'
    const l = el('kt-label')
    l.textContent = cfg.label ?? ''
    tablet.append(v, l)
  } else {
    const p = el('kt-help')
    p.textContent = cfg.content ?? ''
    tablet.append(p)
  }
}

/**
 * Coloca capa, hilo, ojal y pliegue. Lecturas y escrituras agrupadas: se llama
 * una vez por apertura y como mucho una vez por frame en scroll (rAF).
 * @returns {'bottom'|'top'} lado final tras el flip automático.
 */
function position(anchor) {
  const r = anchor.getBoundingClientRect()
  const tw = tablet.offsetWidth
  const th = tablet.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight

  let side = 'bottom'
  if (r.bottom + THREAD + th + MARGIN > vh && r.top - THREAD - th - MARGIN >= 0) side = 'top'

  const cx = r.left + r.width / 2
  const x = Math.round(Math.min(Math.max(cx - tw / 2, MARGIN), Math.max(MARGIN, vw - tw - MARGIN)))
  const y = side === 'bottom' ? Math.round(r.bottom + THREAD) : Math.round(r.top - THREAD - th)
  // el hilo se clava al centro del ancla, clavado dentro de la tablilla
  const tx = Math.round(Math.min(Math.max(cx - x, 14), tw - 14))

  layer.style.left = x + 'px'
  layer.style.top = y + 'px'
  layer.dataset.side = side

  if (side === 'bottom') {
    thread.style.top = -THREAD + 'px'
    hole.style.top = '-7px'
    fold.style.top = '-7px'
    swing.style.transformOrigin = tx + 'px ' + -THREAD + 'px'
  } else {
    thread.style.top = th + 4 + 'px'
    hole.style.top = th + 1 + 'px'
    fold.style.top = th - 7 + 'px'
    swing.style.transformOrigin = tx + 'px ' + (th + THREAD) + 'px'
  }
  thread.style.left = tx - 0.5 + 'px'
  hole.style.left = tx - 3 + 'px'
  fold.style.left = tx - 7 + 'px'
  return side
}

function setAnim(cls) {
  swing.classList.remove('kt-enter', 'kt-enter-chain', 'kt-leave')
  if (cls) {
    // re-arranca la animación aunque la clase coincida con la anterior
    void swing.offsetWidth
    swing.classList.add(cls)
  }
}

function show(anchor, { instant } = {}) {
  clearTimeout(showTimer)
  showTimer = 0
  const cfg = registry.get(anchor.dataset.kt)
  if (!cfg) return
  if (openAnchor && openAnchor !== anchor) openAnchor.removeAttribute('aria-describedby')

  setContent(cfg)
  layer.style.display = 'block'
  layer.style.visibility = 'hidden'
  position(anchor)
  layer.style.visibility = ''
  anchor.setAttribute('aria-describedby', LAYER_ID)
  openAnchor = anchor

  if (instant) setAnim('kt-enter-chain')
  else setAnim('kt-enter') // reduced-motion: index.css lo degrada a fade 120ms
}

function hide({ immediate } = {}) {
  clearTimeout(showTimer)
  showTimer = 0
  if (!openAnchor) return
  openAnchor.removeAttribute('aria-describedby')
  openAnchor = null
  lastClose = performance.now()
  if (immediate) {
    setAnim(null)
    layer.style.display = 'none'
    return
  }
  setAnim('kt-leave')
}

function wantsChain() {
  return !!openAnchor || performance.now() - lastClose < CHAIN_GRACE
}

function scheduleShow(anchor) {
  clearTimeout(showTimer)
  if (wantsChain()) show(anchor, { instant: true })
  else showTimer = setTimeout(() => show(anchor, { instant: false }), OPEN_DELAY)
}

/* — listeners delegados (se instalan UNA vez) — */

function onPointerOver(e) {
  if (performance.now() - lastTouch < 700) return // tras touch no hay hover real
  const a = closestAnchor(e.target)
  if (!a || a === escAnchor || a === openAnchor) return
  scheduleShow(a)
}

function onPointerOut(e) {
  const a = closestAnchor(e.target)
  if (!a) return
  if (e.relatedTarget && a.contains(e.relatedTarget)) return
  clearTimeout(showTimer)
  showTimer = 0
  if (openAnchor === a) hide({})
  if (escAnchor === a) escAnchor = null
}

function onFocusIn(e) {
  if (performance.now() - lastTouch < 700) return
  const a = closestAnchor(e.target)
  if (!a || a === escAnchor || a === openAnchor) return
  scheduleShow(a)
}

function onFocusOut(e) {
  const a = closestAnchor(e.target)
  if (!a) return
  clearTimeout(showTimer)
  showTimer = 0
  if (openAnchor === a) hide({})
  if (escAnchor === a) escAnchor = null
}

function onKeyDown(e) {
  if (e.key === 'Escape' && openAnchor) {
    escAnchor = openAnchor // suprime reapertura hasta salir del ancla
    hide({})
  }
}

function onPointerDown(e) {
  if (e.pointerType !== 'touch') return
  lastTouch = performance.now()
  const a = closestAnchor(e.target)
  clearTimeout(lpTimer)
  if (a) {
    if (a !== openAnchor) lpTimer = setTimeout(() => show(a, { instant: false }), LONG_PRESS)
  } else if (openAnchor) {
    hide({}) // tap fuera cierra
  }
}

function onPointerUp() {
  clearTimeout(lpTimer)
}

function onScrollOrResize() {
  if (!openAnchor || rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    if (openAnchor) position(openAnchor)
  })
}

function onLeaveFinished(e) {
  if (e.target === swing && e.animationName === 'kt-fade-out' && !openAnchor) {
    layer.style.display = 'none'
  }
}

let installed = false

function ensureLayer() {
  if (installed || typeof document === 'undefined') return
  installed = true

  layer = el('kt-layer')
  layer.id = LAYER_ID
  layer.setAttribute('role', 'tooltip')
  if (KT_USE_NATIVE_ANCHOR && CSS.supports?.('anchor-name', '--kt-a')) {
    layer.classList.add('kt-anchored') // @supports en index.css; ver NOTAS §3
  }
  swing = el('kt-swing')
  fold = el('kt-fold')
  tablet = el('kt-tablet')
  thread = el('kt-thread')
  hole = el('kt-hole')
  swing.append(fold, tablet, thread, hole)
  layer.append(swing)
  document.body.appendChild(layer)

  document.addEventListener('pointerover', onPointerOver)
  document.addEventListener('pointerout', onPointerOut)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('pointerup', onPointerUp, { passive: true })
  document.addEventListener('pointercancel', onPointerUp, { passive: true })
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  swing.addEventListener('animationend', onLeaveFinished)
  // La capa y los listeners viven lo que viva la app: coste fijo y mínimo;
  // no hay loops (todas las animaciones son one-shot), nada que pausar.
}

/**
 * Tooltip kanban de marca. Envuelve UN hijo (el ancla) y le añade `data-kt`;
 * todo lo demás (capa, eventos, posicionamiento) es singleton compartido.
 *
 * No pongas contenido esencial-solo-hover: el dato importante debe tener
 * alternativa visible en la UI (criterio A11Y del sistema).
 *
 * @param {object} props
 * @param {'help'|'data'} [props.variant='help'] `help`: texto de máx. 2 líneas
 *   (clamp visual). `data`: valor grande en font-mono + label pequeño — para
 *   ELO, odds, fechas.
 * @param {string} [props.content] Texto de la variante `help`.
 * @param {string} [props.value] Valor de la variante `data` (ya formateado:
 *   este componente no formatea números — eso es de LiveNumber/helpers).
 * @param {string} [props.label] Label pequeño bajo el valor en `data`.
 * @param {import('react').ReactElement} props.children EXACTAMENTE un hijo que
 *   acepte data-attributes (el ancla). Si el ancla real está `disabled`,
 *   envuélvela: `<span tabindex="0"><button disabled …/></span>` con
 *   `pointer-events: none` en el botón — un control disabled no emite eventos.
 *
 * @example
 * <KanbanTooltip content="El ELO mide la fuerza relativa según tus duelos.">
 *   <button type="button" className="…" aria-label="Qué es el ELO">?</button>
 * </KanbanTooltip>
 *
 * @example
 * <KanbanTooltip variant="data" value="1 847" label="ELO actual">
 *   <span tabIndex={0} className="…">1 847</span>
 * </KanbanTooltip>
 */
export default function KanbanTooltip({ variant = 'help', content, value, label, children }) {
  const id = useId()

  useEffect(() => {
    ensureLayer()
    registry.set(id, { variant, content, value, label })
    return () => {
      registry.delete(id)
      if (openAnchor && openAnchor.dataset.kt === id) hide({ immediate: true })
    }
  }, [id, variant, content, value, label])

  const child = Children.only(children)
  return cloneElement(child, { 'data-kt': id })
}

export { LAYER_ID as KANBAN_TOOLTIP_LAYER_ID }
