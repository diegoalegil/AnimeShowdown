// La carta del día de la portada: la misma para todos durante un día local y
// otra al siguiente, sin servidor. Se elige con un hash del día.

/** Hash FNV-1a de 32 bits de un texto. */
function fnv1a(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Carta del día `dia` (AAAA-MM-DD) entre `cartas`. */
export function cartaDelDia(dia, cartas) {
  if (!cartas.length) return undefined
  return cartas[fnv1a(`animeshowdown:${dia}`) % cartas.length]
}
