/**
 * Convierte un color HEX (#rgb o #rrggbb) al formato de canales "r g b" que
 * usan los tokens CSS del shell visual (`rgb(var(--visual-accent) / alpha)`).
 *
 * Devuelve null si el input no es un hex válido, para que el caller pueda caer
 * al accent por defecto del visual sin romper nada. Se usa para teñir el fondo
 * procedural por universo/personaje a partir de `imagenColorDominante`.
 */
export function hexToRgbChannels(hex) {
  if (typeof hex !== 'string') return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}
