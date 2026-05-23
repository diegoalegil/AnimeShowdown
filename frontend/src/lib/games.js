import { readCatalogoPersonajesSnapshot } from './personajes-core'

export const ELO_DUEL_BEST_KEY = 'animeshowdown.higherOrLower.best'
export const ELO_DUEL_LEGACY_BEST_KEY = 'animeshowdown.higher-or-lower.best'

/**
 * Utilities compartidas por los modos de juego.
 *
 * <p>Todos client-side: el catálogo se hidrata desde el endpoint compacto
 * del backend y los daily picks se calculan
 * determinísticamente por fecha. No necesitamos backend para Daily —
 * todos los usuarios ven el mismo personaje el mismo día sin sync.
 *
 * <p>Por ahora cada juego usa localStorage para persistir el progreso del
 * día; los leaderboards globales quedan separados de esta capa local.
 */

/** Hash estable djb2 — mejor distribuido que sumar charCodes. */
function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return h >>> 0 // unsigned
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local del cliente).
 * Sin {@code toISOString()} porque eso da UTC y un usuario en JST vería
 * el daily de "ayer" durante 9h. Usamos hora local para que el reset
 * de medianoche coincida con la percepción del usuario.
 */
export function fechaDelDia(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Personaje "del día" determinístico — todos los usuarios ven el mismo
 * en la misma fecha local. Sirve para los Daily de Guess Character /
 * Guess Anime / Anidel. La key {@code prefix} permite que cada juego
 * tenga su propio rotativo (sin que Guess Character y Anidel coincidan
 * en el mismo personaje cada día).
 */
export function personajeDelDia(prefix = '', date = new Date()) {
  const personajes = readCatalogoPersonajesSnapshot()
  if (personajes.length === 0) return null
  const seed = `${prefix}:${fechaDelDia(date)}`
  const idx = djb2(seed) % personajes.length
  return personajes[idx]
}

/**
 * 4 personajes del mismo anime + 1 impostor de otro anime, determinístico
 * por fecha + salt. Si no hay 4 del mismo anime en el catálogo (anime
 * pequeño), cae al siguiente anime con ≥4 personajes.
 *
 * <p>El parámetro {@code salt} permite generar rondas distintas en el
 * mismo día — sin salt, las 3 rondas del Detector de Impostor daban el
 * mismo anime/impostor/orden (bug). Llamando con salt="0","1","2" se
 * obtienen 3 sets distintos pero estables para todos los visitantes.
 *
 * @returns {{anime: string, items: Array<{slug, nombre, anime, imagen, esImpostor: boolean}>}}
 *          o null si el catálogo no permite la ronda (debería pasar nunca con 730 personajes).
 */
export function impostorDelDia(date = new Date(), salt = '') {
  const personajes = readCatalogoPersonajesSnapshot()
  if (personajes.length === 0) return null
  const seed = `impostor:${fechaDelDia(date)}:${salt}`
  const rand = mulberry32(djb2(seed))

  // Agrupa personajes por anime y filtra a animes con ≥4.
  const porAnime = {}
  for (const p of personajes) {
    if (!porAnime[p.anime]) porAnime[p.anime] = []
    porAnime[p.anime].push(p)
  }
  const animesGrandes = Object.entries(porAnime).filter(([, l]) => l.length >= 4)
  if (animesGrandes.length === 0) return null

  const [animeElegido, lista] = animesGrandes[Math.floor(rand() * animesGrandes.length)]

  // 4 del anime elegido
  const baraja = [...lista].sort(() => rand() - 0.5).slice(0, 4)

  // 1 impostor de otro anime cualquiera (no del mismo)
  const otros = personajes.filter((p) => p.anime !== animeElegido)
  const impostor = otros[Math.floor(rand() * otros.length)]

  // Mix + shuffle determinístico
  const items = [...baraja, impostor]
      .map((p) => ({ ...p, esImpostor: p.slug === impostor.slug }))
      .sort(() => rand() - 0.5)

  return { anime: animeElegido, items }
}

/** PRNG determinístico simple inicializado por seed entero. */
function mulberry32(seed) {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Normaliza un string para comparación tolerante: minúsculas, sin acentos,
 * sin espacios extra. Usado por los autocompletes para que "Akame" y
 * "akame" matcheen, y para que "AkameGaKill" busque "Akame ga Kill!".
 */
export function normalizar(s) {
  return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
}

/**
 * Resultado compartible estilo Wordle. Convierte un array de booleanos
 * (correct/incorrect por intento) en línea de squares: 🟩 acierto, 🟥
 * fallo, ⬛ no usado.
 */
export function buildShareSquares(intentos, totalMax) {
  let line = ''
  for (let i = 0; i < totalMax; i++) {
    const intento = intentos[i]
    if (intento == null) line += '⬛'
    else if (intento) line += '🟩'
    else line += '🟥'
  }
  return line
}

/**
 * Wrapper de localStorage que no truena si el navegador deniega acceso
 * (modo privado iOS, cookies bloqueadas). Devuelve null en lectura
 * fallida, no-op en escritura.
 */
export const safeStorage = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
}
