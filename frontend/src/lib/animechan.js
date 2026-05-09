const BASE = 'https://animechan.io/api/v1'
const cache = new Map()

export async function citaPersonaje(nombre) {
  if (cache.has(nombre)) return cache.get(nombre)
  try {
    const url = `${BASE}/quotes/random?character=${encodeURIComponent(nombre)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`AnimeChan ${res.status}`)
    const data = await res.json()
    const quote = {
      content: data?.content || data?.quote || '',
      anime: data?.anime?.name || data?.anime || '',
      character: data?.character?.name || data?.character || nombre,
    }
    if (!quote.content) {
      cache.set(nombre, null)
      return null
    }
    cache.set(nombre, quote)
    return quote
  } catch {
    cache.set(nombre, null)
    return null
  }
}
