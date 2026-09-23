// Coreografía de los sobres con la Web Animations API: el envoltorio que se
// rasga, las cartas que vuelan a la mesa y, al guardar, hacia la colección.
// Solo transform y opacity. Todas las medidas se leen de una vez antes de
// empezar; durante la animación no se toca el layout.
import { movimientoReducido } from './motion.js'

export const SUAVE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const FIRME = 'cubic-bezier(0.65, 0, 0.35, 1)'
const ACELERA = 'cubic-bezier(0.55, 0, 0.9, 0.45)'

/** Tiempos de la apertura (ms). */
export const APERTURA = {
  presion: 300, // el sobre cede bajo el dedo
  sello: { retardo: 170, duracion: 560 },
  tira: { retardo: 260, duracion: 640 },
  mitades: { retardo: 520, duracion: 780 },
  cartas: { retardo: 600, paso: 70, duracion: 860 },
}

/** Tiempos del vuelo a la colección (ms). */
export const GUARDADO = { paso: 60, duracion: 760 }

const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

/** Desplazamiento que lleva el centro de la caja `desde` al de `hasta`. */
export function vuelo(desde, hasta) {
  const a = centro(desde)
  const b = centro(hasta)
  return { dx: b.x - a.x, dy: b.y - a.y }
}

const px = (n) => `${n.toFixed(1)}px`

/**
 * Anima la apertura dentro de `mesa`: el sobre rasgado ([data-pieza]) y las
 * cartas (.naipe) que salen de él. Devuelve las animaciones creadas.
 */
export function animarApertura(mesa) {
  const pieza = (nombre) => mesa.querySelector(`[data-pieza="${nombre}"]`)
  const naipes = [...mesa.querySelectorAll('.naipe')]
  const caja = pieza('caja')

  if (movimientoReducido() || !caja) {
    const fundido = { duration: 200, easing: 'linear', fill: 'both' }
    return [
      ...(caja ? [caja.animate([{ opacity: 1 }, { opacity: 0 }], fundido)] : []),
      ...naipes.map((n) => n.animate([{ opacity: 0 }, { opacity: 1 }], fundido)),
    ]
  }

  // Lecturas de layout, todas antes de escribir nada.
  const sobre = caja.getBoundingClientRect()
  const cajas = naipes.map((n) => n.getBoundingClientRect())

  const animaciones = []
  const animar = (el, keyframes, opciones) => {
    if (el) animaciones.push(el.animate(keyframes, { fill: 'both', ...opciones }))
  }

  // 1. El sobre cede un poco al pulsarlo, como papel bajo el dedo.
  animar(
    caja,
    [
      { transform: 'none' },
      { transform: 'scale(0.965) translateY(2px)', offset: 0.35 },
      { transform: 'scale(1.012)', offset: 0.72 },
      { transform: 'none' },
    ],
    { duration: APERTURA.presion, easing: 'ease-out', fill: 'none' },
  )

  // 2. El sello se parte y cada mitad salta hacia su lado.
  for (const [lado, signo] of [
    ['izquierda', -1],
    ['derecha', 1],
  ]) {
    animar(
      pieza(`sello-${lado}`),
      [
        { transform: 'none', opacity: 1 },
        { transform: `rotate(${signo * 6}deg)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${signo * 34}px, -14px) rotate(${signo * 32}deg)`, opacity: 0 },
      ],
      { duration: APERTURA.sello.duracion, delay: APERTURA.sello.retardo, easing: SUAVE },
    )
  }

  // 3. La tira de arriba se levanta por la línea de puntos y se va.
  animar(
    pieza('tira'),
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translate(-1%, -6%) rotate(-3deg)', opacity: 1, offset: 0.3 },
      { transform: 'translate(24%, -70%) rotate(12deg)', opacity: 0 },
    ],
    { duration: APERTURA.tira.duracion, delay: APERTURA.tira.retardo, easing: FIRME },
  )

  // 4. El cuerpo se abre por la mitad; las dos hojas caen hacia fuera.
  for (const [lado, signo] of [
    ['izquierda', -1],
    ['derecha', 1],
  ]) {
    animar(
      pieza(lado),
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${signo * 6}%, 1%) rotate(${signo * 2}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${signo * 62}%, 9%) rotate(${signo * 9}deg)`, opacity: 0 },
      ],
      { duration: APERTURA.mitades.duracion, delay: APERTURA.mitades.retardo, easing: SUAVE },
    )
  }
  animar(pieza('sombra'), [{ opacity: 1 }, { opacity: 0 }], {
    duration: APERTURA.mitades.duracion * 0.6,
    delay: APERTURA.mitades.retardo,
    easing: 'linear',
  })

  // 5. Las cartas salen del sobre, apiladas, y vuelan a su sitio en la mesa.
  const { retardo, paso, duracion: vueloCartas } = APERTURA.cartas
  const mitad = (naipes.length - 1) / 2
  naipes.forEach((naipe, i) => {
    const { dx, dy } = vuelo(cajas[i], sobre)
    const escala = Math.min(Math.max((sobre.width * 0.8) / (cajas[i].width || 1), 0.5), 1.4)
    const giro = (i - mitad) * -2.2
    animar(
      naipe,
      [
        { transform: `translate(${px(dx)}, ${px(dy + 6)}) scale(${escala.toFixed(3)}) rotate(${giro}deg)`, opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: vueloCartas, delay: retardo + i * paso, easing: SUAVE },
    )
  })

  return animaciones
}

/**
 * Anima las cartas de la mesa hacia `destino` (el contador de la colección
 * en la cabecera). Si no hay destino visible, se recogen hacia arriba.
 */
export function animarGuardado(mesa, destino) {
  const naipes = [...mesa.querySelectorAll('.naipe')]
  if (movimientoReducido()) {
    return naipes.map((n) => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }))
  }

  const cajas = naipes.map((n) => n.getBoundingClientRect())
  const meta = destino?.getBoundingClientRect()
  const hayMeta = meta && meta.width > 0

  return naipes.map((naipe, i) => {
    const caja = cajas[i]
    const { dx, dy } = hayMeta ? vuelo(caja, meta) : { dx: 0, dy: -caja.top - caja.height }
    const escala = hayMeta ? Math.max((meta.height * 1.4) / caja.height, 0.04) : 0.6
    const giro = (i % 2 ? 1 : -1) * (8 + i * 3)
    return naipe.animate(
      [
        { transform: 'none', opacity: 1 },
        // Toma impulso: se levanta un poco antes de salir disparada.
        { transform: `translate(${px(dx * 0.04)}, -18px) scale(1.03)`, opacity: 1, offset: 0.22 },
        { transform: `translate(${px(dx)}, ${px(dy)}) scale(${escala.toFixed(3)}) rotate(${giro}deg)`, opacity: 0.2 },
      ],
      { duration: GUARDADO.duracion, delay: i * GUARDADO.paso, easing: ACELERA, fill: 'forwards' },
    )
  })
}

/** El contador de la colección da un pequeño salto al recibir las cartas. */
export function rebotar(elemento) {
  if (!elemento || movimientoReducido()) return
  elemento.animate(
    [{ transform: 'none' }, { transform: 'translateY(-3px) scale(1.18)', offset: 0.35 }, { transform: 'none' }],
    { duration: 420, easing: SUAVE },
  )
}

/** Espera a que terminen todas; cancelar una animación no es un error. */
export function alTerminar(animaciones) {
  return Promise.all(animaciones.map((a) => a.finished.catch(() => undefined)))
}
