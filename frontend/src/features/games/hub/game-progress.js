import { fechaDelDia, safeStorage } from '../../../lib/games'

export function leerEstadoJuego(storageKey) {
  if (!storageKey) return { completadoHoy: false }
  const raw = safeStorage.get(storageKey)
  if (!raw) return { completadoHoy: false }
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== fechaDelDia()) return { completadoHoy: false }
    const finalizado =
      parsed.finalizado === true ||
      (typeof parsed.rondaIdx === 'number' &&
        Array.isArray(parsed.resultados) &&
        parsed.resultados.length >= parsed.rondaIdx &&
        parsed.rondaIdx >= 3)
    return {
      completadoHoy: finalizado,
      acertado: parsed.acertado === true,
    }
  } catch {
    return { completadoHoy: false }
  }
}

export function leerMejorRacha(bestKey) {
  if (!bestKey) return null
  const raw = safeStorage.get(bestKey)
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
