// Movimiento: transiciones de ruta, entrada al hacer scroll e inclinación de
// las cartas. Solo se anima transform y opacity; todo respeta
// prefers-reduced-motion.

const hayVentana = () => typeof window !== 'undefined'

// Las MediaQueryList se crean una vez por ventana; `.matches` es siempre actual.
const consultas = new WeakMap()
function coincide(consulta) {
  if (!hayVentana() || typeof window.matchMedia !== 'function') return false
  let porVentana = consultas.get(window)
  if (!porVentana) consultas.set(window, (porVentana = new Map()))
  let lista = porVentana.get(consulta)
  if (!lista) porVentana.set(consulta, (lista = window.matchMedia(consulta)))
  return lista.matches
}

/** true si el sistema pide reducir el movimiento. */
export const movimientoReducido = () => coincide('(prefers-reduced-motion: reduce)')

/** true si el navegador soporta la View Transitions API. */
export function soportaTransiciones() {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
}

/** Si conviene animar el cambio de ruta (para la prop viewTransition de Link). */
export const transicionActiva = () => soportaTransiciones() && !movimientoReducido()

/**
 * Ejecuta `actualizar` dentro de una View Transition cuando se puede y
 * directamente cuando no. Devuelve una promesa que se cumple al terminar.
 * `tipo` queda en <html data-vt> mientras dura, para que el CSS elija la
 * coreografía (p. ej. «siguiente» o «anterior» entre fichas).
 */
export function conTransicion(actualizar, { tipo } = {}) {
  if (!transicionActiva()) {
    const resultado = actualizar()
    return Promise.resolve(resultado).then(() => {})
  }
  const dataset = document.documentElement?.dataset
  if (dataset && tipo) dataset.vt = tipo
  return document
    .startViewTransition(actualizar)
    .finished.catch(() => {})
    .finally(() => {
      if (dataset && tipo && dataset.vt === tipo) delete dataset.vt
    })
}

// ---------------------------------------------------------------------------
// Elemento compartido: la carta pulsada en la galería se transforma en la
// ilustración de la ficha. Solo un elemento de la página puede llevar el
// nombre a la vez, así que se quita del anterior antes de ponerlo.
// ---------------------------------------------------------------------------

let compartido = null

export function nombrarCompartido(elemento, nombre = 'carta') {
  if (compartido && compartido !== elemento) compartido.style.viewTransitionName = ''
  compartido = elemento
  if (elemento) elemento.style.viewTransitionName = nombre
}

// ---------------------------------------------------------------------------
// Revelado: los elementos con data-revelar aparecen al entrar en pantalla,
// una sola vez y escalonados. Un único IntersectionObserver para toda la app.
// ---------------------------------------------------------------------------

const PASO_MS = 55
const MAX_RETARDO_MS = 330
let observador = null

function marcarVisto(elemento, retardo = 0) {
  if (retardo) elemento.style.setProperty('--retardo', `${retardo}ms`)
  elemento.dataset.revelar = 'visto'
}

function obtenerObservador() {
  if (observador || !hayVentana() || typeof window.IntersectionObserver !== 'function') return observador
  observador = new window.IntersectionObserver(
    (entradas) => {
      let orden = 0
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue
        observador.unobserve(entrada.target)
        marcarVisto(entrada.target, Math.min(orden * PASO_MS, MAX_RETARDO_MS))
        orden++
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  )
  return observador
}

/**
 * Ref de callback para React: `<li data-revelar ref={revelar}>`. Es la misma
 * función para todos los elementos, así que no crea closures por carta.
 */
export function revelar(elemento) {
  if (!elemento || elemento.dataset.revelar === 'visto') return undefined
  const io = obtenerObservador()
  if (!io) {
    marcarVisto(elemento)
    return undefined
  }
  io.observe(elemento)
  return () => io.unobserve(elemento)
}

// ---------------------------------------------------------------------------
// Inclinación: la carta bajo el puntero gira hacia él (máx. ~8°) y un brillo
// la recorre. Un solo par de listeners por contenedor, cálculo en
// requestAnimationFrame y sin lecturas de layout dentro del bucle.
// ---------------------------------------------------------------------------

export const INCLINACION_MAX = 8

/** Valores de la inclinación para un punto relativo (0..1) sobre la carta. */
export function calcularInclinacion(px, py, max = INCLINACION_MAX) {
  const x = Math.min(Math.max(px, 0), 1)
  const y = Math.min(Math.max(py, 0), 1)
  return {
    rx: (0.5 - y) * 2 * max,
    ry: (x - 0.5) * 2 * max,
    brillo: x * 100,
  }
}

const puedeInclinar = () => !movimientoReducido() && coincide('(hover: hover) and (pointer: fine)')

/**
 * Activa la inclinación en todas las `[data-inclinar]` dentro de
 * `contenedor`. Devuelve una función que la desactiva.
 */
export function activarInclinacion(contenedor, { selector = '[data-inclinar]', max = INCLINACION_MAX } = {}) {
  if (!contenedor || !puedeInclinar()) return () => {}

  let actual = null
  let caja = null
  let puntero = null
  let frame = 0

  function soltar() {
    if (!actual) return
    actual.style.removeProperty('--rx')
    actual.style.removeProperty('--ry')
    actual.style.removeProperty('--brillo')
    delete actual.dataset.inclinada
    actual = null
    caja = null
  }

  function pintar() {
    frame = 0
    if (!actual || !caja || !puntero) return
    const { rx, ry, brillo } = calcularInclinacion(
      (puntero.x - caja.left) / caja.width,
      (puntero.y - caja.top) / caja.height,
      max,
    )
    actual.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
    actual.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
    actual.style.setProperty('--brillo', brillo.toFixed(1))
  }

  function mover(evento) {
    if (evento.pointerType === 'touch') return
    const objetivo = typeof evento.target?.closest === 'function' ? evento.target.closest(selector) : null
    if (objetivo !== actual) {
      soltar()
      if (!objetivo || !contenedor.contains(objetivo)) return
      actual = objetivo
      actual.dataset.inclinada = ''
    }
    if (!actual) return
    // Una lectura de layout al entrar en la carta (o tras un scroll), nunca en el frame.
    if (!caja) caja = actual.getBoundingClientRect()
    puntero = { x: evento.clientX, y: evento.clientY }
    if (!frame) frame = requestAnimationFrame(pintar)
  }

  function invalidarCaja() {
    caja = null
  }

  contenedor.addEventListener('pointermove', mover, { passive: true })
  contenedor.addEventListener('pointerleave', soltar, { passive: true })
  window.addEventListener('scroll', invalidarCaja, { passive: true })

  return () => {
    contenedor.removeEventListener('pointermove', mover)
    contenedor.removeEventListener('pointerleave', soltar)
    window.removeEventListener('scroll', invalidarCaja)
    if (frame) cancelAnimationFrame(frame)
    soltar()
  }
}
