const BASE = 'https://api.jikan.moe/v4'
const cache = new Map()

function buildQuery(nombre, anime) {
  // Nombres cortos (≤4 chars) son ambiguos en Jikan ("L", "Aqua", "Rei").
  // Concatenamos el anime para desambiguar y mejorar match.
  if (nombre.length <= 4 && anime) {
    return `${nombre} ${anime}`
  }
  return nombre
}

function mejorMatch(resultados, anime) {
  if (!resultados || resultados.length === 0) return null
  if (!anime) return resultados[0]
  // Si tenemos varios resultados, preferir el que tenga el anime entre sus animeografías
  const animeLower = anime.toLowerCase()
  const conAnime = resultados.find((r) =>
    r.anime?.some((a) =>
      (a.anime?.title || '').toLowerCase().includes(animeLower),
    ),
  )
  return conAnime || resultados[0]
}

export async function buscarPersonajeJikan(nombre, anime) {
  const key = `${nombre}|${anime || ''}`
  if (cache.has(key)) return cache.get(key)
  try {
    const query = buildQuery(nombre, anime)
    const url = `${BASE}/characters?q=${encodeURIComponent(
      query,
    )}&limit=10&order_by=favorites&sort=desc`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Jikan ${res.status}`)
    const data = await res.json()
    const match = mejorMatch(data?.data, anime)
    cache.set(key, match)
    return match
  } catch {
    cache.set(key, null)
    return null
  }
}
