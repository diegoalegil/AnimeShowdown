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
    return Promise.resolve(resultado).then(desaplanar)
  }
  const dataset = document.documentElement?.dataset
  if (dataset && tipo) dataset.vt = tipo
  return document
    .startViewTransition(actualizar)
    .finished.catch(() => {})
    .finally(() => {
      if (dataset && tipo && dataset.vt === tipo) delete dataset.vt
      desaplanar()
    })
}

// La carta compartida se aplana solo mientras se captura (ver nombrarCompartido).
function desaplanar() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return
  for (const marco of document.querySelectorAll('[data-compartida]')) marco.removeAttribute('data-compartida')
}

// ---------------------------------------------------------------------------
// Elemento compartido: la carta pulsada en la galería se transforma en la
// ilustración de la ficha. Solo un elemento de la página puede llevar el
// nombre a la vez, así que se quita del anterior antes de ponerlo.
//
// Safari no captura elementos con nombre dentro de un contenedor con
// content-visibility: auto (los grupos de cartas de la galería y del álbum),
// así que mientras la carta lleva el nombre, su contenedor pasa a
// content-visibility: visible. Esos contenedores llevan data-diferido.
// ---------------------------------------------------------------------------

const DIFERIDOS = '[data-diferido]'
const INCLINABLES = '[data-inclinar]'
let compartido = null
let contenedor = null

export function nombrarCompartido(elemento, nombre = 'carta') {
  if (compartido && compartido !== elemento) {
    compartido.style.viewTransitionName = ''
    compartido.closest?.(INCLINABLES)?.removeAttribute('data-compartida')
    contenedor?.style.removeProperty('content-visibility')
    contenedor = null
  }
  compartido = elemento
  if (!elemento) return
  elemento.style.viewTransitionName = nombre
  contenedor = elemento.closest?.(DIFERIDOS) ?? null
  contenedor?.style.setProperty('content-visibility', 'visible')
  // La carta se captura plana: si estaba inclinada bajo el puntero, la
  // transición arrancaría desde su matriz 3D y la «desdoblaría» en el vuelo
  // (data-compartida anula el transform y su transición, ver carta.css).
  elemento.closest?.(INCLINABLES)?.setAttribute('data-compartida', '')
  for (const soltar of inclinaciones) soltar()
}

// ---------------------------------------------------------------------------
// Revelado: los elementos con data-revelar aparecen al entrar en pantalla,
// una sola vez y escalonados. Un único IntersectionObserver para toda la app.
// ---------------------------------------------------------------------------

const PASO_MS = 55
const MAX_RETARDO_MS = 330
let observador = null

// Ritmo del scroll. Con scroll rápido las cartas aparecen sin coreografía:
// no daría tiempo a verla y ocultar y volver a mostrar decenas de cartas
// cuesta frames en un móvil modesto. Mientras el scroll va con calma, los
// grupos cercanos a la pantalla ([data-cerca], ver anticipar en lib/images)
// llevan data-calma y solo entonces sus cartas esperan ocultas su entrada
// (ver [data-revelar] en index.css). Se anota en los grupos y no en <html>:
// cambiarlo en la raíz obligaba a recalcular el estilo de todas las cartas
// pendientes de la página (más de mil en el álbum) a cada cambio de ritmo.
// Hay histéresis para no alternar a cada frame: se pasa a rápido por encima
// de 1,2 px/ms y se vuelve a la calma por debajo de 0,4 px/ms.
export const VELOCIDAD_RAPIDA = 1.2
export const VELOCIDAD_CALMA = 0.4
let rapido = false
const CERCA = '[data-cerca]'

function marcarCalma() {
  for (const grupo of document.querySelectorAll(CERCA)) grupo.toggleAttribute('data-calma', !rapido)
}

/** true mientras el scroll va rápido (ver ritmoScroll). */
export const scrollRapido = () => rapido

/** Nuevo ritmo (true = rápido) según el anterior y la velocidad en px/ms. */
export function ritmoScroll(eraRapido, velocidad) {
  return eraRapido ? velocidad > VELOCIDAD_CALMA : velocidad > VELOCIDAD_RAPIDA
}

function seguirRitmo() {
  let previa = null
  let frame = 0
  let reposo = 0
  const medir = (t) => {
    frame = 0
    const y = window.scrollY
    if (previa) {
      const nuevo = ritmoScroll(rapido, Math.abs(y - previa.y) / Math.max(t - previa.t, 1))
      if (nuevo !== rapido) {
        rapido = nuevo
        marcarCalma()
      }
    }
    previa = { t, y }
    // Si el scroll se detiene en seco no llegan más eventos: se vuelve a la calma.
    clearTimeout(reposo)
    reposo = setTimeout(() => {
      previa = null
      if (rapido) {
        rapido = false
        marcarCalma()
      }
    }, 160)
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(medir)
    },
    { passive: true },
  )
}

function marcarVisto(elemento, retardo = 0, directo = rapido) {
  if (directo) {
    elemento.dataset.revelar = 'directo'
    return
  }
  if (retardo) elemento.style.setProperty('--retardo', `${retardo}ms`)
  elemento.dataset.revelar = 'visto'
}

// Elementos a la espera dentro de cada grupo lejano ([data-diferido]). Solo
// se observan los de los grupos cercanos: con mil cartas observadas a la vez,
// calcular sus intersecciones se llevaba la mitad del hilo principal en cada
// frame de scroll de un móvil.
const pendientes = new WeakMap()

function obtenerObservador() {
  if (observador || !hayVentana() || typeof window.IntersectionObserver !== 'function') return observador
  observador = new window.IntersectionObserver(
    (entradas) => {
      let orden = 0
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue
        observador.unobserve(entrada.target)
        pendientes.get(entrada.target.closest?.(DIFERIDOS))?.delete(entrada.target)
        marcarVisto(entrada.target, Math.min(orden * PASO_MS, MAX_RETARDO_MS))
        orden++
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  )
  seguirRitmo()
  return observador
}

/**
 * Ref de callback para React: `<li data-revelar ref={revelar}>`. Es la misma
 * función para todos los elementos, así que no crea closures por carta. Los
 * elementos de un grupo lejano esperan a que el grupo se acerque (acercarGrupo).
 */
export function revelar(elemento) {
  if (!elemento || elemento.dataset.revelar === 'visto') return undefined
  const io = obtenerObservador()
  if (!io) {
    marcarVisto(elemento)
    return undefined
  }
  const grupo = elemento.closest?.(DIFERIDOS)
  if (grupo && !grupo.hasAttribute('data-cerca')) {
    let conjunto = pendientes.get(grupo)
    if (!conjunto) pendientes.set(grupo, (conjunto = new Set()))
    conjunto.add(elemento)
    return () => {
      conjunto.delete(elemento)
      io.unobserve(elemento)
    }
  }
  io.observe(elemento)
  return () => io.unobserve(elemento)
}

/**
 * Un grupo (o cabecera) se acerca a la pantalla o se aleja (lo avisa
 * anticipar, en lib/images): toma la calma del scroll y sus elementos
 * pendientes empiezan o dejan de observarse.
 */
export function acercarGrupo(grupo, cerca) {
  grupo.toggleAttribute('data-calma', cerca && !rapido)
  const conjunto = pendientes.get(grupo)
  if (!conjunto || !observador) return
  for (const elemento of conjunto) {
    if (cerca) observador.observe(elemento)
    else observador.unobserve(elemento)
  }
}

// ---------------------------------------------------------------------------
// Inclinación: la carta bajo el puntero gira hacia él (máx. ~8°) y el brillo
// holográfico (un reflejo que sigue al puntero y una banda de luz) la
// recorre. Un solo juego de listeners por contenedor, cálculo en
// requestAnimationFrame y, mientras el puntero se mueve, sin lecturas de
// layout; la caja se vuelve a leer cuando algo mueve la carta por debajo
// (scroll, redimensionado, reflujo del contenedor).
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
    brilloY: y * 100,
  }
}

const puedeInclinar = () => !movimientoReducido() && coincide('(hover: hover) and (pointer: fine)')

// Las inclinaciones activas, para soltarlas todas antes de una transición compartida.
const inclinaciones = new Set()

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
  let reubicando = 0

  function soltar() {
    if (!actual) return
    actual.style.removeProperty('--rx')
    actual.style.removeProperty('--ry')
    actual.style.removeProperty('--brillo')
    actual.style.removeProperty('--brillo-y')
    delete actual.dataset.inclinada
    actual = null
    caja = null
  }

  function adoptar(objetivo) {
    soltar()
    if (!objetivo || !contenedor.contains(objetivo)) return false
    actual = objetivo
    actual.dataset.inclinada = ''
    return true
  }

  function pintar() {
    if (!actual || !caja || !puntero) return
    const { rx, ry, brillo, brilloY } = calcularInclinacion(
      (puntero.x - caja.left) / caja.width,
      (puntero.y - caja.top) / caja.height,
      max,
    )
    actual.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
    actual.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
    actual.style.setProperty('--brillo', brillo.toFixed(1))
    actual.style.setProperty('--brillo-y', brilloY.toFixed(1))
  }

  // pointermove y pointerover: el segundo es lo único que llega cuando el
  // scroll cambia la carta que hay bajo un puntero quieto.
  function mover(evento) {
    if (evento.pointerType === 'touch') return
    const objetivo = typeof evento.target?.closest === 'function' ? evento.target.closest(selector) : null
    if (objetivo !== actual && !adoptar(objetivo)) return
    if (!actual) return
    // Una lectura de layout al entrar en la carta, nunca en el frame.
    if (!caja) caja = actual.getBoundingClientRect()
    puntero = { x: evento.clientX, y: evento.clientY }
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0
        pintar()
      })
    }
  }

  // Algo ha movido la carta sin que el puntero se moviera (scroll, cambio de
  // tamaño, reflujo): se mira de nuevo qué hay debajo y se relee su caja. Si
  // ya no hay carta, se suelta; si no, se quedaba inclinada y encendida.
  function reubicar() {
    if (!actual || !puntero || reubicando) return
    reubicando = requestAnimationFrame(() => {
      reubicando = 0
      if (!actual || !puntero) return
      const bajo = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(puntero.x, puntero.y) : null
      const objetivo = bajo?.closest?.(selector) ?? null
      if (objetivo !== actual && !adoptar(objetivo)) return
      caja = actual.getBoundingClientRect()
      pintar()
    })
  }

  contenedor.addEventListener('pointermove', mover, { passive: true })
  contenedor.addEventListener('pointerover', mover, { passive: true })
  contenedor.addEventListener('pointerleave', soltar, { passive: true })
  window.addEventListener('scroll', reubicar, { passive: true })
  window.addEventListener('resize', reubicar, { passive: true })
  const observadorTamano = typeof ResizeObserver === 'function' ? new ResizeObserver(reubicar) : null
  observadorTamano?.observe(contenedor)
  inclinaciones.add(soltar)

  return () => {
    contenedor.removeEventListener('pointermove', mover)
    contenedor.removeEventListener('pointerover', mover)
    contenedor.removeEventListener('pointerleave', soltar)
    window.removeEventListener('scroll', reubicar)
    window.removeEventListener('resize', reubicar)
    observadorTamano?.disconnect()
    inclinaciones.delete(soltar)
    if (frame) cancelAnimationFrame(frame)
    if (reubicando) cancelAnimationFrame(reubicando)
    soltar()
  }
}
