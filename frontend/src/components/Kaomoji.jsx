/**
 * Kaomoji para estados vacíos y micro-feedback.
 *
 * <p>Emoticonos japoneses puramente Unicode (sin emoji platform-specific).
 * Elección estable por `seed`: el mismo seed devuelve siempre el mismo
 * kaomoji entre renders/visitas, evitando parpadeo visual.
 */
export const KAOMOJI_VACIO = [
  '(◞‸◟)',
  '(￣ω￣;)',
  '(´；ω；`)',
  '(╥﹏╥)',
]

/**
 * Hash estable de un string a [0, len) — para que el mismo seed siempre
 * devuelva el mismo kaomoji entre renders/visitas. Reusa djb2 inline.
 */
function pickFromSeed(arr, seed = '') {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i)
  return arr[(h >>> 0) % arr.length]
}

export function pickVacio(seed) {
  return pickFromSeed(KAOMOJI_VACIO, seed)
}
