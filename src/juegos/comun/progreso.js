// Progreso de los juegos: racha, récord y partidas de cada uno, y cuántos
// sobres han dado en total. Vive en localStorage, aparte de la colección, y
// sigue el mismo patrón que lib/collection.js: datos puros y saneados, y un
// almacén compatible con useSyncExternalStore (ver useProgreso.js).
//
// Formato guardado (versión 1):
//   {
//     v: 1,
//     juegos: {
//       [slug]: {
//         racha:    rondas ganadas seguidas (vuelve a 0 al perder)
//         record:   la mejor racha
//         jugadas:  rondas terminadas
//         ganadas:  rondas ganadas
//         mejor:    la mejor puntuación de una ronda (para los juegos que puntúan)
//       }
//     },
//     sobres: sobres extra ganados en total (los que quedan por abrir los sabe la colección)
//   }
import { almacenSeguro } from '../../lib/collection.js'
import { SLUGS } from '../registro.js'

export const CLAVE_PROGRESO = 'animeshowdown:juegos:v1'
export const VERSION_PROGRESO = 1
const MAX_CUENTA = 10 ** 9

/** Progreso de un juego que aún no se ha jugado. */
export const SIN_JUGAR = Object.freeze({ racha: 0, record: 0, jugadas: 0, ganadas: 0, mejor: 0 })

export const progresoVacio = () => ({ v: VERSION_PROGRESO, juegos: {}, sobres: 0 })

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
const cuenta = (n) => (Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_CUENTA) : 0)

/** Progreso válido de un juego a partir de cualquier valor guardado. */
function sanearJuego(bruto) {
  if (!esObjeto(bruto)) return { ...SIN_JUGAR }
  const racha = cuenta(bruto.racha)
  const jugadas = cuenta(bruto.jugadas)
  return {
    racha,
    record: Math.max(cuenta(bruto.record), racha),
    jugadas,
    ganadas: Math.min(cuenta(bruto.ganadas), jugadas),
    mejor: cuenta(bruto.mejor),
  }
}

/**
 * Convierte cualquier valor leído del almacenamiento en un progreso válido:
 * solo juegos conocidos (`slugs`), cuentas enteras y coherentes.
 */
export function sanearProgreso(bruto, slugs = SLUGS) {
  if (!esObjeto(bruto) || bruto.v !== VERSION_PROGRESO) return progresoVacio()
  const juegos = {}
  if (esObjeto(bruto.juegos)) {
    for (const slug of slugs) if (Object.hasOwn(bruto.juegos, slug)) juegos[slug] = sanearJuego(bruto.juegos[slug])
  }
  return { v: VERSION_PROGRESO, juegos, sobres: cuenta(bruto.sobres) }
}

/** Progreso de un juego (SIN_JUGAR si no se ha jugado). */
export const progresoDe = (progreso, slug) => progreso.juegos[slug] ?? SIN_JUGAR

/**
 * Anota el final de una ronda: suma la partida, alarga la racha si se ganó
 * (o la corta si no), actualiza el récord y la mejor puntuación y, si la
 * ronda dio un sobre, lo cuenta. Devuelve el progreso nuevo.
 */
export function anotarRonda(progreso, slug, { ganada, puntos = 0, sobre = false }) {
  const antes = progresoDe(progreso, slug)
  const racha = ganada ? antes.racha + 1 : 0
  const juego = {
    racha,
    record: Math.max(antes.record, racha),
    jugadas: antes.jugadas + 1,
    ganadas: antes.ganadas + (ganada ? 1 : 0),
    mejor: Math.max(antes.mejor, Number.isFinite(puntos) ? Math.max(0, Math.floor(puntos)) : 0),
  }
  return { ...progreso, juegos: { ...progreso.juegos, [slug]: juego }, sobres: progreso.sobres + (sobre ? 1 : 0) }
}

/** Suma de las rondas jugadas y ganadas en todos los juegos. */
export function totales(progreso) {
  let jugadas = 0
  let ganadas = 0
  for (const juego of Object.values(progreso.juegos)) {
    jugadas += juego.jugadas
    ganadas += juego.ganadas
  }
  return { jugadas, ganadas, sobres: progreso.sobres }
}

/**
 * Crea el almacén del progreso, compatible con useSyncExternalStore.
 *
 * @param {object} opciones
 * @param {() => Storage} opciones.storage  acceso perezoso a localStorage
 * @param {string[]} [opciones.slugs]        juegos que se guardan
 * @param {Window} [opciones.ventana]        para escuchar cambios desde otras pestañas
 */
export function crearAlmacenProgreso({ storage, slugs = SLUGS, ventana, clave = CLAVE_PROGRESO }) {
  const disco = almacenSeguro(storage)
  const oyentes = new Set()
  let estado = null

  function leerDisco() {
    let bruto
    try {
      bruto = JSON.parse(disco.leer(clave) ?? 'null')
    } catch {
      bruto = null
    }
    return sanearProgreso(bruto, slugs)
  }

  function guardar(nuevo) {
    estado = nuevo
    disco.escribir(clave, JSON.stringify(nuevo))
    for (const oyente of oyentes) oyente()
  }

  function alCambiarOtraPestana(evento) {
    if (evento.key !== clave) return
    estado = leerDisco()
    for (const oyente of oyentes) oyente()
  }

  const getSnapshot = () => (estado ??= leerDisco())

  return {
    getSnapshot,

    subscribe(oyente) {
      oyentes.add(oyente)
      if (oyentes.size === 1) ventana?.addEventListener('storage', alCambiarOtraPestana)
      return () => {
        oyentes.delete(oyente)
        if (oyentes.size === 0) ventana?.removeEventListener('storage', alCambiarOtraPestana)
      }
    },

    /** Anota una ronda (ver anotarRonda) y devuelve el progreso nuevo del juego. */
    anotarRonda(slug, resultado) {
      if (!slugs.includes(slug)) throw new Error(`Juego desconocido: ${slug}`)
      guardar(anotarRonda(getSnapshot(), slug, resultado))
      return progresoDe(estado, slug)
    },
  }
}
