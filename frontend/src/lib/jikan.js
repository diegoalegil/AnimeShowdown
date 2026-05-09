const BASE = 'https://api.jikan.moe/v4'
const cache = new Map()

export async function buscarPersonajeJikan(nombre) {
  if (cache.has(nombre)) return cache.get(nombre)
  try {
    const url = `${BASE}/characters?q=${encodeURIComponent(
      nombre,
    )}&limit=1&order_by=favorites&sort=desc`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Jikan ${res.status}`)
    const data = await res.json()
    const personaje = data?.data?.[0] || null
    cache.set(nombre, personaje)
    return personaje
  } catch {
    cache.set(nombre, null)
    return null
  }
}
