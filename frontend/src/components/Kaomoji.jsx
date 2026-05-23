/**
 * Kaomoji rotativos para loading states y micro-feedback.
 *
 * <p>5 emoticonos japoneses puramente Unicode (sin emoji platform-specific).
 * Una "elección estable" por sesión — el mismo loading kaomoji cada vez
 * que se monta el componente con el mismo `seed`, evita parpadeo visual.
 *
 * <p>Renderless con prop: el caller decide qué visual quiere envolverlo
 * (size, color, animation). Por defecto, kaomoji+texto.
 */
export const KAOMOJI_HAPPY = [
  '(◕‿◕)',
  '(≧◡≦)',
  '٩(◕‿◕)۶',
  '(´• ω •`)',
  '(｡◕‿◕｡)',
]

export const KAOMOJI_LOADING = [
  '(￣ヘ￣)',
  '(づ｡◕‿‿◕｡)づ',
  '(•‿•)',
  '(=°▽°=)',
  '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
]

export const KAOMOJI_VACIO = [
  '(◞‸◟)',
  '(￣ω￣;)',
  '(´；ω；`)',
  '(╥﹏╥)',
]

export const KAOMOJI_ERROR = [
  '(╯°□°)╯',
  '(>_<)',
  '(╬ Ò﹏Ó)',
  '(っ °Д °;)っ',
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

export function pickHappy(seed) {
  return pickFromSeed(KAOMOJI_HAPPY, seed)
}

export function pickLoading(seed) {
  return pickFromSeed(KAOMOJI_LOADING, seed)
}

export function pickVacio(seed) {
  return pickFromSeed(KAOMOJI_VACIO, seed)
}

export function pickError(seed) {
  return pickFromSeed(KAOMOJI_ERROR, seed)
}
