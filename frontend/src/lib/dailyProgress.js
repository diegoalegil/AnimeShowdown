import { fechaDelDia } from './games'
import { api, getToken } from './api'

export const DAILY_PROGRESS_EVENT = 'animeshowdown:daily-progress'
export const DAILY_VOTE_TARGET = 10
export const DAILY_GAME_TARGET = 1

const PROGRESS_PREFIX = 'animeshowdown.daily-progress.v1'
const STREAK_KEY = 'animeshowdown.daily-streak.v1'

function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Local progress is a nice-to-have. The app must still work without it.
  }
}

function readJson(key, fallback) {
  const raw = safeGet(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function progressKey(date = fechaDelDia()) {
  return `${PROGRESS_PREFIX}:${date}`
}

function defaultProgress(date = fechaDelDia()) {
  return {
    date,
    votes: 0,
    gamesCompleted: 0,
    rankingViewed: false,
    shared: false,
    completed: false,
  }
}

function normalizeProgress(value, date = fechaDelDia()) {
  const progress = { ...defaultProgress(date), ...(value || {}) }
  progress.date = date
  progress.votes = Math.max(0, Number(progress.votes) || 0)
  progress.gamesCompleted = Math.max(0, Number(progress.gamesCompleted) || 0)
  progress.rankingViewed = Boolean(progress.rankingViewed)
  progress.shared = Boolean(progress.shared)
  progress.completed =
    progress.votes >= DAILY_VOTE_TARGET &&
    progress.gamesCompleted >= DAILY_GAME_TARGET &&
    progress.rankingViewed
  return progress
}

function previousLocalDate(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number)
  if (!year || !month || !day) return null
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() - 1)
  return fechaDelDia(d)
}

function offsetLocalDate(dateString, offsetDays) {
  const [year, month, day] = String(dateString).split('-').map(Number)
  if (!year || !month || !day) return null
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + offsetDays)
  return fechaDelDia(d)
}

function normalizeStreak(value) {
  return {
    current: Math.max(0, Number(value?.current) || 0),
    longest: Math.max(0, Number(value?.longest) || 0),
    lastCompletedDate: value?.lastCompletedDate || null,
  }
}

function notify(progress, streak) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(DAILY_PROGRESS_EVENT, {
      detail: { progress, streak },
    }),
  )
}

export function readDailyProgress(date = fechaDelDia()) {
  return normalizeProgress(readJson(progressKey(date), null), date)
}

export function readDailyStreak(date = fechaDelDia()) {
  const streak = normalizeStreak(readJson(STREAK_KEY, null))
  if (!streak.lastCompletedDate) return streak
  // La racha solo sigue viva si la última jornada completada fue hoy o ayer.
  // Si es anterior, está rota: devolver `current` crudo mostraría un dato
  // falso ("Racha: 5 días") hasta la próxima misión. Se recalcula en lectura
  // (no se persiste: el valor guardado se corrige al completar la siguiente).
  if (
    streak.lastCompletedDate === date ||
    streak.lastCompletedDate === previousLocalDate(date)
  ) {
    return streak
  }
  return { ...streak, current: 0 }
}

export function readRecentDailyProgress(days = 7, date = fechaDelDia()) {
  const totalDays = Math.max(1, Math.min(31, Number(days) || 7))
  return Array.from({ length: totalDays }, (_, index) => {
    const day = offsetLocalDate(date, index - (totalDays - 1))
    return readDailyProgress(day)
  }).filter(Boolean)
}

export function updateDailyProgress(mutator, date = fechaDelDia()) {
  const before = readDailyProgress(date)
  const next = normalizeProgress(mutator({ ...before }) || before, date)
  safeSet(progressKey(date), JSON.stringify(next))

  let streak = readDailyStreak(date)
  if (!before.completed && next.completed && streak.lastCompletedDate !== date) {
    const yesterday = previousLocalDate(date)
    const continued = streak.lastCompletedDate === yesterday
    const current = continued ? streak.current + 1 : 1
    streak = {
      current,
      longest: Math.max(streak.longest, current),
      lastCompletedDate: date,
    }
    safeSet(STREAK_KEY, JSON.stringify(streak))
  }

  notify(next, streak)
  return { progress: next, streak }
}

export function recordDailyVote(count = 1) {
  return updateDailyProgress((progress) => ({
    ...progress,
    votes: progress.votes + Math.max(1, Number(count) || 1),
  }))
}

export function setDailyGamesCompleted(count) {
  const res = updateDailyProgress((progress) => ({
    ...progress,
    gamesCompleted: Math.max(progress.gamesCompleted, Number(count) || 0),
  }))
  pushServerDaily('/api/me/daily/juego')
  return res
}

export function recordDailyRankingView() {
  const res = updateDailyProgress((progress) => ({
    ...progress,
    rankingViewed: true,
  }))
  pushServerDaily('/api/me/daily/ranking-visto')
  return res
}

// --- Sincronización server-side (#1) -------------------------------------
// Para usuarios con sesión, el backend es la verdad de la misión y la racha:
// persiste, cruza dispositivos y habilita notificaciones. localStorage sigue
// siendo la capa instantánea y el fallback para invitados. Los votos los
// registra el backend solo (vía el evento de voto); aquí solo empujamos los
// pasos client-side (juego, ranking) y tiramos del estado al iniciar sesión.

function haySesion() {
  return Boolean(getToken())
}

/**
 * Mezcla la vista del servidor en localStorage. Los contadores del día no
 * retroceden (max, por si el listener async aún no procesó un voto reciente);
 * la racha la adopta del servidor, que es la autoridad del reinicio/continuación
 * (un current local podría estar inflado tras saltarse un día).
 */
export function mergeServerDaily(server) {
  if (!server || !server.progreso) {
    return { progress: readDailyProgress(), streak: readDailyStreak() }
  }
  const fecha = server.progreso.fecha || fechaDelDia()
  const local = readDailyProgress(fecha)
  const merged = normalizeProgress(
    {
      ...local,
      votes: Math.max(local.votes, Number(server.progreso.votos) || 0),
      gamesCompleted: Math.max(local.gamesCompleted, Number(server.progreso.juegos) || 0),
      rankingViewed: local.rankingViewed || Boolean(server.progreso.rankingVisto),
    },
    fecha,
  )
  safeSet(progressKey(fecha), JSON.stringify(merged))

  const r = server.racha || {}
  const longestLocal = normalizeStreak(readJson(STREAK_KEY, null)).longest
  const streak = normalizeStreak({
    current: Number(r.actual) || 0,
    longest: Math.max(Number(r.record) || 0, longestLocal),
    lastCompletedDate: r.ultimaFechaCompletada || null,
  })
  safeSet(STREAK_KEY, JSON.stringify(streak))

  const vivo = readDailyStreak(fecha)
  notify(merged, vivo)
  return { progress: merged, streak: vivo }
}

/** Tira del progreso+racha del servidor y lo mezcla. Best-effort: si falla, el
 * localStorage sigue funcionando. No hace nada para invitados. */
export async function hydrateDailyFromServer() {
  if (!haySesion()) return null
  try {
    return mergeServerDaily(await api.get('/api/me/daily'))
  } catch {
    return null
  }
}

function pushServerDaily(path) {
  if (!haySesion()) return
  // Best-effort: no bloquea la UI ni propaga errores (el optimismo local ya
  // actualizó el estado). El backend es idempotente por día.
  Promise.resolve(api.post(path)).catch(() => {})
}

export function recordDailyShare() {
  return updateDailyProgress((progress) => ({
    ...progress,
    shared: true,
  }))
}

export function listenDailyProgress(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => {
    callback(event.detail || {
      progress: readDailyProgress(),
      streak: readDailyStreak(),
    })
  }
  const storageHandler = (event) => {
    if (
      event.key === STREAK_KEY ||
      event.key === progressKey(fechaDelDia())
    ) {
      callback({
        progress: readDailyProgress(),
        streak: readDailyStreak(),
      })
    }
  }
  window.addEventListener(DAILY_PROGRESS_EVENT, handler)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(DAILY_PROGRESS_EVENT, handler)
    window.removeEventListener('storage', storageHandler)
  }
}
