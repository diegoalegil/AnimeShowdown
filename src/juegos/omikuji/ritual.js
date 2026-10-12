// La física del ritual, sin pantalla: mientras se agita el cilindro oscila
// con amplitud creciente; al soltarlo se asienta con un decaimiento que
// conserva la fase (sin saltos). Todo en grados y segundos.

/** Velocidad angular del vaivén (rad/s): unas tres sacudidas por segundo y pico. */
export const OMEGA = 21
/** Amplitud inicial y máxima (grados) y cuánto crece por segundo mantenido. */
export const AMPLITUD_MIN = 1.8
export const AMPLITUD_MAX = 6
export const CRECIMIENTO = 4.2
/** Cuánto dura el asentamiento al soltar (s) y su constante de decaimiento. */
export const ASENTAMIENTO_S = 0.3
export const DECAIMIENTO = 9
/** Agitado automático (toque corto o teclado), en segundos. */
export const AUTO_S = 0.9

/** Amplitud tras `t` segundos agitando: crece hasta el máximo. */
export const amplitudTras = (t) => Math.min(AMPLITUD_MAX, AMPLITUD_MIN + CRECIMIENTO * Math.max(0, t))

/** Fuerza (0..1) para el medidor, según la amplitud alcanzada. */
export const fuerzaDe = (amplitud) => Math.min(1, Math.max(0, (amplitud - AMPLITUD_MIN) / (AMPLITUD_MAX - AMPLITUD_MIN)))

/** Ángulo (grados) a los `t` segundos de agitado, con un leve bamboleo que lo hace menos de reloj. */
export function anguloAgitando(t) {
  const bamboleo = 1 + 0.08 * Math.sin(t * 7.3)
  return amplitudTras(t) * Math.sin(OMEGA * t) * bamboleo
}

/** Fase (rad) en el instante en que se suelta, para que el asentamiento siga desde ahí. */
export const faseEn = (t) => OMEGA * t

/** Ángulo durante el asentamiento, `t` segundos después de soltar con amplitud `a0` y fase `fase0`. */
export const anguloAsentando = (t, a0, fase0) => a0 * Math.exp(-DECAIMIENTO * t) * Math.sin(fase0 + OMEGA * t)

/**
 * Los acoples del cilindro: una inclinación hacia delante y un pequeño
 * desplazamiento lateral que acompañan al giro, como si lo sostuviera una mano.
 */
export function posturaDe(angulo) {
  return { rz: angulo, rx: 0.35 * angulo, tx: 0.9 * angulo }
}
