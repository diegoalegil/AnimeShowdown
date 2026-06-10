// Formateadores puros del flujo de voto.

export function formatVoteScore(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function formatPersonalVoteImpact(impact) {
  if (!impact) return ''
  const plural = impact.count === 1 ? '' : 's'
  return `#${impact.rank} en tu ranking personal · ${impact.count} voto${plural} tuyo${plural}`
}
