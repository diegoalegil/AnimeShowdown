import { getPopularidad } from '../../lib/personajes-core'

const RECENT_PAIRS_KEY = 'animeshowdown.votar.recent-pairs'
const RECENT_CHARS_KEY = 'animeshowdown.votar.recent-chars'
const RECENT_PAIRS_MAX = 48
const RECENT_CHARS_MAX = 10

export function pairKey(slugA, slugB) {
  return slugA < slugB ? `${slugA}|${slugB}` : `${slugB}|${slugA}`
}

function readSessionList(key) {
  try {
    if (typeof sessionStorage === 'undefined') return []
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSessionList(key, list, max) {
  try {
    if (typeof sessionStorage === 'undefined') return
    const trimmed = list.slice(-max)
    sessionStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // sessionStorage can fail in private mode; pairing still works without anti-repeat memory.
  }
}

export function recordRecentPair(slugA, slugB) {
  if (!slugA || !slugB) return
  const pairs = readSessionList(RECENT_PAIRS_KEY)
  pairs.push(pairKey(slugA, slugB))
  writeSessionList(RECENT_PAIRS_KEY, pairs, RECENT_PAIRS_MAX)
  const chars = readSessionList(RECENT_CHARS_KEY)
  chars.push(slugA, slugB)
  writeSessionList(RECENT_CHARS_KEY, chars, RECENT_CHARS_MAX * 2)
}

export function selectRandomPair(catalogoPersonajes) {
  const personajes = Array.isArray(catalogoPersonajes) ? catalogoPersonajes : []
  if (personajes.length < 2) return [null, null]
  const recentPairs = new Set(readSessionList(RECENT_PAIRS_KEY))
  const recentChars = new Set(readSessionList(RECENT_CHARS_KEY))

  const pickIdxA = () => {
    for (let i = 0; i < 30; i++) {
      const idx = Math.floor(Math.random() * personajes.length)
      if (!recentChars.has(personajes[idx].slug)) return idx
    }
    return Math.floor(Math.random() * personajes.length)
  }

  const tryPair = (deltaMax, intentos, blockRecent) => {
    const idxA = pickIdxA()
    const a = personajes[idxA]
    const popA = getPopularidad(a.slug)
    for (let i = 0; i < intentos; i++) {
      const idxB = Math.floor(Math.random() * personajes.length)
      if (idxB === idxA) continue
      const b = personajes[idxB]
      if (Math.abs(getPopularidad(b.slug) - popA) > deltaMax) continue
      if (blockRecent && recentPairs.has(pairKey(a.slug, b.slug))) continue
      if (blockRecent && recentChars.has(b.slug)) continue
      return [a, b]
    }
    return null
  }

  const pair =
    tryPair(12, 25, true) ?? tryPair(12, 12, false) ?? tryPair(25, 10, true)
  if (pair) {
    return pair
  }

  const idxA = Math.floor(Math.random() * personajes.length)
  let idxB = Math.floor(Math.random() * personajes.length)
  while (idxB === idxA) idxB = Math.floor(Math.random() * personajes.length)
  return [personajes[idxA], personajes[idxB]]
}

export function getPairWithFixed(catalogoPersonajes, fixedPersonaje) {
  const personajes = Array.isArray(catalogoPersonajes) ? catalogoPersonajes : []
  if (!fixedPersonaje || personajes.length < 2) return [null, null]
  const recentChars = new Set(readSessionList(RECENT_CHARS_KEY))
  const popA = getPopularidad(fixedPersonaje.slug)

  const candidatos = personajes
    .filter((p) => p.slug !== fixedPersonaje.slug)
    .map((p) => ({
      personaje: p,
      score:
        Math.abs(getPopularidad(p.slug) - popA) +
        (recentChars.has(p.slug) ? 20 : 0),
    }))
    .sort((x, y) => x.score - y.score)
    .slice(0, 24)

  const rival = candidatos[Math.floor(Math.random() * candidatos.length)]?.personaje
  if (!rival) return selectRandomPair(personajes)
  return Math.random() > 0.5 ? [fixedPersonaje, rival] : [rival, fixedPersonaje]
}

export function getPairFromAnime(catalogoPersonajes, anime) {
  const pool = (Array.isArray(catalogoPersonajes) ? catalogoPersonajes : [])
    .filter((p) => p.anime === anime)
  if (pool.length < 2) return selectRandomPair(catalogoPersonajes)
  return selectRandomPair(pool)
}
