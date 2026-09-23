// Cartas que llegan al álbum: las conseguidas desde la última visita se
// «pegan» en su hueco con una pequeña coreografía la primera vez que se ven,
// y entonces quedan marcadas como vistas. Un único IntersectionObserver para
// todos los huecos; solo se anima transform y opacity (Web Animations).
import { movimientoReducido } from './motion.js'

/** Pausa entre cartas que llegan a la vez, y el máximo acumulado. */
export const PASO_PEGADO_MS = 110
export const MAX_RETARDO_PEGADO_MS = 660
export const DURACION_PEGADO_MS = 820

/** Retardo de la carta `orden` dentro de un grupo que entra a la vez. */
export const retardoPegado = (orden) => Math.min(orden * PASO_PEGADO_MS, MAX_RETARDO_PEGADO_MS)

/**
 * Fotogramas de la llegada: la carta baja desde algo más arriba, girada,
 * se posa con un pequeño asiento y queda en su sitio.
 */
export const FOTOGRAMAS_PEGADO = [
  { opacity: 0, transform: 'translate3d(0, -40px, 0) rotate(-5deg) scale(1.05)' },
  { opacity: 1, offset: 0.4 },
  { transform: 'translate3d(0, 3px, 0) rotate(0.6deg) scale(1)', offset: 0.78 },
  { opacity: 1, transform: 'none' },
]

const FOTOGRAMAS_SELLO = [
  { opacity: 0, transform: 'scale(1.8)' },
  { opacity: 1, transform: 'scale(0.94)', offset: 0.7 },
  { opacity: 1, transform: 'none' },
]

/**
 * Anima la llegada de la carta de un hueco. `fill: backwards` mantiene la
 * carta oculta durante el retardo y, al terminar, la deja con su estilo
 * normal (sin capas de composición que queden vivas).
 */
export function animarPegado(bolsillo, orden = 0) {
  const carta = bolsillo.querySelector('.carta')
  if (!carta?.animate) return []
  const retardo = retardoPegado(orden)
  if (movimientoReducido()) {
    return [carta.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: retardo, fill: 'backwards' })]
  }
  const animaciones = [
    carta.animate(FOTOGRAMAS_PEGADO, {
      duration: DURACION_PEGADO_MS,
      delay: retardo,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards',
    }),
  ]
  // El sello 新 se estampa cuando la carta ya se ha posado.
  const sello = bolsillo.querySelector('.carta-sello--nueva')
  if (sello) {
    animaciones.push(
      sello.animate(FOTOGRAMAS_SELLO, {
        duration: 420,
        delay: retardo + DURACION_PEGADO_MS * 0.72,
        easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
        fill: 'backwards',
      }),
    )
  }
  return animaciones
}

/**
 * Crea el observador de los huecos por pegar. `alPegar(ids)` recibe las
 * cartas que acaban de entrar en pantalla (para marcarlas como vistas).
 * Devuelve una ref de callback para React: `<li data-pegar={id} ref={…}>`.
 */
export function crearPegado(alPegar) {
  let observador = null

  function pegarYa(bolsillos) {
    bolsillos.forEach((b, i) => animarPegado(b, i))
    alPegar(bolsillos.map((b) => b.dataset.pegar))
  }

  function obtener() {
    if (observador || typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') return observador
    observador = new window.IntersectionObserver(
      (entradas) => {
        const llegan = entradas.filter((e) => e.isIntersecting).map((e) => e.target)
        if (!llegan.length) return
        for (const b of llegan) observador.unobserve(b)
        pegarYa(llegan)
      },
      { threshold: 0.3 },
    )
    return observador
  }

  return function pegarAlVer(bolsillo) {
    if (!bolsillo?.dataset.pegar) return undefined
    const io = obtener()
    if (!io) {
      // Sin IntersectionObserver: se pegan al momento, sin coreografía.
      alPegar([bolsillo.dataset.pegar])
      return undefined
    }
    io.observe(bolsillo)
    return () => io.unobserve(bolsillo)
  }
}
