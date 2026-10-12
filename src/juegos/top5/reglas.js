// Mi Top 5: la lógica del altar sin React. Cinco huecos ordenados con ids de
// cartas (personajes o especiales), que se añaden al primer hueco libre, se
// suben, se bajan y se quitan. Lo que se guarda y se lee de localStorage pasa
// siempre por `sanearAltar`, así que un dato roto o una carta que ya no existe
// nunca llega a la pantalla.
import { catalogo } from '../../lib/catalog.js'

export const HUECOS = 5
export const NUMERALES = ['一', '二', '三', '四', '五']
export const CLAVE_GUARDADO = 'animeshowdown:juegos:top5:v1'

/** Un altar vacío: cinco huecos sin carta. */
export const altarVacio = () => Array(HUECOS).fill(null)

/**
 * Convierte lo que haya (lo leído de localStorage, lo que sea) en un altar
 * válido: solo ids que existen en el catálogo, sin repetidos, compactados al
 * principio y con exactamente HUECOS posiciones.
 */
export function sanearAltar(bruto, existe = (id) => catalogo.existe(id)) {
  const lista = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.altar) ? bruto.altar : []
  const vistos = new Set()
  const ids = []
  for (const id of lista) {
    if (typeof id !== 'string' || vistos.has(id) || !existe(id)) continue
    vistos.add(id)
    ids.push(id)
    if (ids.length === HUECOS) break
  }
  return [...ids, ...Array(HUECOS - ids.length).fill(null)]
}

/** Cartas del altar (sin huecos), en orden. */
export const ocupados = (altar) => altar.filter(Boolean)

/** true si no queda ningún hueco libre. */
export const completo = (altar) => ocupados(altar).length === HUECOS

/**
 * Añade una carta al primer hueco libre. Devuelve { altar, puesto } (puesto
 * desde 1) o { altar, error } si ya estaba o no cabe; `altar` es siempre
 * el resultado (el mismo si no cambia).
 */
export function anadir(altar, id) {
  if (altar.includes(id)) return { altar, error: 'Ese personaje ya está en tu altar.' }
  const hueco = altar.indexOf(null)
  if (hueco === -1) return { altar, error: 'El altar está completo. Quita una carta para añadir otra.' }
  const nuevo = altar.slice()
  nuevo[hueco] = id
  return { altar: nuevo, puesto: hueco + 1 }
}

/** Quita una carta y compacta los huecos hacia el principio. */
export function quitar(altar, id) {
  return sanearAltar(
    altar.filter((x) => x && x !== id),
    () => true,
  )
}

/**
 * Mueve la carta del puesto `desde` al puesto `hasta` (índices 0..4),
 * intercambiándola con la que hubiera. Fuera de rango o sobre un hueco
 * vacío, no hace nada.
 */
export function mover(altar, desde, hasta) {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= HUECOS || hasta >= HUECOS) return altar
  if (!altar[desde] || !altar[hasta]) return altar
  const nuevo = altar.slice()
  ;[nuevo[desde], nuevo[hasta]] = [nuevo[hasta], nuevo[desde]]
  return nuevo
}

/** Las cartas del altar resueltas en el catálogo, en orden (los huecos, null). */
export const cartasDe = (altar) => altar.map((id) => (id ? catalogo.carta(id) : null))

/** Lee el altar guardado; sin storage o con datos rotos, uno vacío. */
export function leerAltar(storage = globalThis.localStorage) {
  try {
    const crudo = storage?.getItem(CLAVE_GUARDADO)
    return crudo ? sanearAltar(JSON.parse(crudo)) : altarVacio()
  } catch {
    return altarVacio()
  }
}

/** Guarda el altar; si el storage no está o falla, se ignora. */
export function guardarAltar(altar, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CLAVE_GUARDADO, JSON.stringify({ v: 1, altar }))
  } catch {
    // Sin localStorage (modo privado, cuota) el altar vive solo en la pestaña.
  }
}
