const TIER_DEFS = [
  { id: 'S', label: 'S', maxRatio: 0.1 },
  { id: 'A', label: 'A', maxRatio: 0.25 },
  { id: 'B', label: 'B', maxRatio: 0.5 },
  { id: 'C', label: 'C', maxRatio: 0.75 },
  { id: 'D', label: 'D', maxRatio: 1 },
]

export function buildAnimeTierList(personajes = []) {
  const ordenados = [...personajes]
    .filter((p) => p?.slug)
    .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))
  if (ordenados.length === 0) return []

  const groups = TIER_DEFS.map((tier) => ({ ...tier, personajes: [] }))
  ordenados.forEach((personaje, index) => {
    const tier = groups[tierIndexFor(index, ordenados.length)] ?? groups.at(-1)
    tier.personajes.push(personaje)
  })
  return groups.filter((tier) => tier.personajes.length > 0)
}

function tierIndexFor(index, total) {
  const s = Math.max(1, Math.ceil(total * TIER_DEFS[0].maxRatio))
  const a = Math.max(s + 1, Math.ceil(total * TIER_DEFS[1].maxRatio))
  const b = Math.max(a + 1, Math.ceil(total * TIER_DEFS[2].maxRatio))
  const c = Math.max(b + 1, Math.ceil(total * TIER_DEFS[3].maxRatio))
  if (index < s) return 0
  if (index < a) return 1
  if (index < b) return 2
  if (index < c) return 3
  return 4
}

export function filterAnimeMovers(movimientos = [], anime, limit = 5) {
  if (!anime) return []
  return [...movimientos]
    .filter((item) => item?.anime === anime)
    .sort((a, b) => moverScore(b) - moverScore(a))
    .slice(0, limit)
}

function moverScore(item) {
  if (item?.esNuevo) return 10_000
  const delta = item?.delta ?? 0
  if (delta > 0) return 5_000 + delta
  return Math.abs(delta)
}

export function getMonthlyHero(rankingMes = [], anime) {
  if (!anime) return null
  const item = rankingMes.find((fila) => fila?.personaje?.anime === anime)
  if (!item?.personaje?.slug) return null
  return {
    personaje: item.personaje,
    votos: item.votos ?? 0,
  }
}

export function getHallOfFame(torneos = [], personajesBySlug = new Map(), anime, limit = 4) {
  if (!anime) return []
  return [...torneos]
    .filter((torneo) => torneo?.estado === 'FINISHED' && torneo?.ganadorSlug)
    .map((torneo) => {
      const ganador = personajesBySlug.get(torneo.ganadorSlug)
      return ganador?.anime === anime ? { torneo, ganador } : null
    })
    .filter(Boolean)
    .sort((a, b) => dateValue(b.torneo.fechaFinalizacion) - dateValue(a.torneo.fechaFinalizacion))
    .slice(0, limit)
}

function dateValue(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
}

export function buildCrossAnimeRecommendations(similares = [], anime, limit = 6) {
  if (!anime) return []
  return [...similares]
    .filter((item) => item?.slug && item.anime !== anime)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
}

export function getClosestEloDuel(porElo = []) {
  const ordenados = [...porElo]
    .filter((p) => p?.slug)
    .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))
  if (ordenados.length < 2) return null

  let best = null
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const a = ordenados[i]
    const b = ordenados[i + 1]
    const diff = Math.abs((a.elo ?? 0) - (b.elo ?? 0))
    if (!best || diff < best.diff) {
      best = { a, b, diff }
    }
  }
  return best
}

export function getRevelation(movers = []) {
  return movers.find((item) => item?.esNuevo || (item?.delta ?? 0) > 0) ?? null
}
