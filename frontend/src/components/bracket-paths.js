// Geometría de los caminos del bracket (módulo hermano de BracketPaths.jsx:
// el .jsx solo exporta el componente por react-refresh, y esto se testea
// sin montar nada).

/** Redondeo a 0.5px: hairlines nítidos + firma de geometría estable. */
export const half = (v) => Math.round(v * 2) / 2

/**
 * Codo ortogonal con esquinas suavizadas (quadratic). El vértice cae en
 * midX (mitad del gap entre columnas); el radio se acota para que funcione
 * hasta con el gap-3 actual del grid: r = min(radio, |Δy|/2, gap/2 − 1).
 */
export function elbowPath(x1, y1, x2, y2, radius = 10) {
  const dy = y2 - y1
  if (Math.abs(dy) < 2) return `M ${x1} ${y1} L ${x2} ${y2}`
  const midX = x1 + (x2 - x1) / 2
  const dir = dy > 0 ? 1 : -1
  const r = Math.max(1, Math.min(radius, Math.abs(dy) / 2, Math.max(1, (x2 - x1) / 2 - 1)))
  return (
    `M ${x1} ${y1}` +
    ` H ${midX - r}` +
    ` Q ${midX} ${y1} ${midX} ${y1 + dir * r}` +
    ` V ${y2 - dir * r}` +
    ` Q ${midX} ${y2} ${midX + r} ${y2}` +
    ` H ${x2}`
  )
}
