import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getToken: vi.fn(),
}))
vi.mock('./api', () => ({
  api: { get: apiMocks.get, post: apiMocks.post },
  getToken: apiMocks.getToken,
}))

import {
  mergeServerDaily,
  readDailyProgress,
  readDailyStreak,
  hydrateDailyFromServer,
} from './dailyProgress'

const STREAK_KEY = 'animeshowdown.daily-streak.v1'

// El servidor manda su propia `fecha`; para que el test sea determinista la
// igualamos al día local (mergeServerDaily escribe bajo esa fecha y la leemos
// con la misma, así no dependemos de la zona horaria).
function hoy(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

describe('mergeServerDaily', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('sana un localStorage vacío con la verdad del servidor', () => {
    const fecha = hoy()
    mergeServerDaily({
      progreso: { fecha, votos: 7, juegos: 1, rankingVisto: true, completado: false },
      racha: { actual: 3, record: 5, ultimaFechaCompletada: fecha },
    })
    const p = readDailyProgress(fecha)
    expect(p.votes).toBe(7)
    expect(p.gamesCompleted).toBe(1)
    expect(p.rankingViewed).toBe(true)
    const s = readDailyStreak(fecha)
    expect(s.current).toBe(3)
    expect(s.longest).toBe(5)
  })

  it('no regresa los contadores del día: toma el máximo entre local y servidor', () => {
    const fecha = hoy()
    // El cliente va por delante (p.ej. el listener async aún no procesó un voto).
    mergeServerDaily({
      progreso: { fecha, votos: 9, juegos: 1, rankingVisto: false, completado: false },
      racha: { actual: 0, record: 0, ultimaFechaCompletada: null },
    })
    // Una respuesta del servidor más vieja no debe bajar el contador local.
    mergeServerDaily({
      progreso: { fecha, votos: 4, juegos: 0, rankingVisto: false, completado: false },
      racha: { actual: 0, record: 0, ultimaFechaCompletada: null },
    })
    expect(readDailyProgress(fecha).votes).toBe(9)
    expect(readDailyProgress(fecha).gamesCompleted).toBe(1)
  })

  it('adopta la racha del servidor como autoridad del reinicio, preservando el récord', () => {
    const fecha = hoy()
    mergeServerDaily({
      progreso: { fecha, votos: 0, juegos: 0, rankingVisto: false, completado: false },
      racha: { actual: 0, record: 8, ultimaFechaCompletada: null },
    })
    const s = readDailyStreak(fecha)
    expect(s.current).toBe(0)
    expect(s.longest).toBe(8)
  })

  it('sin datos del servidor devuelve el estado local sin romper', () => {
    const out = mergeServerDaily(null)
    expect(out.progress).toBeDefined()
    expect(out.streak).toBeDefined()
  })
})

describe('hydrateDailyFromServer — backfill de racha (migración server-side)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    apiMocks.getToken.mockReturnValue('tok') // sesión presente
  })
  afterEach(() => localStorage.clear())

  const sinRacha = (fecha: string) => ({
    progreso: { fecha, votos: 0, juegos: 0, rankingVisto: false, completado: false },
    racha: { actual: 0, record: 0, ultimaFechaCompletada: null },
  })

  it('siembra la racha local VIVA cuando el servidor no tiene racha', async () => {
    const fecha = hoy()
    localStorage.setItem(STREAK_KEY, JSON.stringify({ current: 4, longest: 4, lastCompletedDate: fecha }))
    apiMocks.get.mockResolvedValue(sinRacha(fecha))
    apiMocks.post.mockResolvedValue({
      progreso: sinRacha(fecha).progreso,
      racha: { actual: 4, record: 4, ultimaFechaCompletada: fecha },
    })

    await hydrateDailyFromServer()

    expect(apiMocks.post).toHaveBeenCalledWith('/api/me/daily/migrar-racha', {
      actual: 4,
      ultimaFechaCompletada: fecha,
    })
    expect(readDailyStreak(fecha).current).toBe(4)
  })

  it('NO siembra si el servidor ya tiene racha', async () => {
    const fecha = hoy()
    localStorage.setItem(STREAK_KEY, JSON.stringify({ current: 4, longest: 4, lastCompletedDate: fecha }))
    apiMocks.get.mockResolvedValue({
      progreso: sinRacha(fecha).progreso,
      racha: { actual: 2, record: 5, ultimaFechaCompletada: fecha },
    })

    await hydrateDailyFromServer()

    expect(apiMocks.post).not.toHaveBeenCalled()
  })

  it('NO siembra una racha local MUERTA (última completada antigua)', async () => {
    const fecha = hoy()
    localStorage.setItem(STREAK_KEY, JSON.stringify({ current: 4, longest: 4, lastCompletedDate: '2000-01-01' }))
    apiMocks.get.mockResolvedValue(sinRacha(fecha))

    await hydrateDailyFromServer()

    expect(apiMocks.post).not.toHaveBeenCalled()
  })
})
