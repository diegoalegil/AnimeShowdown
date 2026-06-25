import {
  getStatsPersonajeEstimado,
  readCatalogoPersonajesSnapshot,
} from './personajes-core'
import type { PersonajeLite } from './types'

type GamePersonaje = PersonajeLite & { anime: string }

type DailyResetCountdown = {
  h: number
  m: number
  ms: number
  label: string
}

type ImpostorItem = GamePersonaje & { esImpostor: boolean }

type ImpostorRound = {
  anime: string
  items: ImpostorItem[]
}

export type OraculoRespuesta = 'si' | 'no' | 'nose'

export type OraculoQuestionKind = 'anime' | 'tag' | 'elo'

export type OraculoQuestion = {
  id: string
  label: string
  texto: string
  kind: OraculoQuestionKind
  value: string
  weight: number
}

export type OraculoAnswerRecord = Record<string, OraculoRespuesta>

export type OraculoTagProvider = (personaje: GamePersonaje) => string[]

export type OraculoCandidate = GamePersonaje & {
  score: number
  confianza: number
  matches: number
  contradicciones: number
}

export type NexoAnimeCard = GamePersonaje & {
  groupId: string
}

export type NexoAnimeGroup = {
  id: string
  anime: string
  items: [GamePersonaje, GamePersonaje]
}

export type NexoAnimeRound = {
  fecha: string
  groups: NexoAnimeGroup[]
  cards: NexoAnimeCard[]
}

type GameShareInput = {
  game: string
  date?: string
  result: string
  detail?: string
  grid?: string
  extra?: string
}

type SafeStorage = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
}

export const ELO_DUEL_BEST_KEY = 'animeshowdown.higherOrLower.best'
export const ELO_DUEL_LEGACY_BEST_KEY = 'animeshowdown.higher-or-lower.best'
export const ORACULO_STORAGE_KEY = 'animeshowdown.oraculo.v1'
export const NEXO_ANIME_STORAGE_KEY = 'animeshowdown.nexo-anime.v1'

const ORACULO_TAG_QUESTIONS = [
  {
    tag: 'protagonist',
    label: 'Protagonista',
    texto: '¿Es protagonista o cara principal de su historia?',
  },
  {
    tag: 'villain',
    label: 'Villanía',
    texto: '¿Funciona como villano o amenaza principal?',
  },
  {
    tag: 'mentor',
    label: 'Mentor',
    texto: '¿Tiene rol de mentor, maestro o figura guía?',
  },
  {
    tag: 'rival',
    label: 'Rival',
    texto: '¿Es rival directo de otro personaje central?',
  },
  {
    tag: 'waifu',
    label: 'Waifu',
    texto: '¿Suele entrar en debates de waifu?',
  },
  {
    tag: 'husbando',
    label: 'Husbando',
    texto: '¿Suele entrar en debates de husbando?',
  },
  {
    tag: 'shounen',
    label: 'Shounen',
    texto: '¿Viene de una obra con energía shounen marcada?',
  },
  {
    tag: 'isekai',
    label: 'Isekai',
    texto: '¿Pertenece a un isekai?',
  },
  {
    tag: 'mecha',
    label: 'Mecha',
    texto: '¿Su universo está ligado a mechas?',
  },
  {
    tag: 'sports-anime',
    label: 'Deportivo',
    texto: '¿Su anime gira alrededor de un deporte?',
  },
] as const

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
function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return h >>> 0 // unsigned
}

function isGamePersonaje(personaje: unknown): personaje is GamePersonaje {
  if (!personaje || typeof personaje !== 'object') return false
  const p = personaje as Partial<GamePersonaje>
  return Boolean(p.slug && p.nombre && p.anime)
}

function readGameCatalog(catalogo: unknown): GamePersonaje[] {
  return Array.isArray(catalogo)
    ? catalogo.filter(isGamePersonaje)
    : []
}

function shuffleDeterministic<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function stableId(value: string): string {
  return normalizar(value).replace(/\s+/g, '-')
}

function defaultTagProvider(): string[] {
  return []
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local del cliente).
 * Sin {@code toISOString()} porque eso da UTC y un usuario en JST vería
 * el daily de "ayer" durante 9h. Usamos hora local para que el reset
 * de medianoche coincida con la percepción del usuario.
 */
export function fechaDelDia(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dateFromDayKey(dayKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!match) return new Date()

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0)
}

export function getDailyResetCountdown(date = new Date()): DailyResetCountdown {
  const nextReset = new Date(date)
  nextReset.setDate(date.getDate() + 1)
  nextReset.setHours(0, 0, 0, 0)
  const ms = Math.max(0, nextReset.getTime() - date.getTime())
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return {
    h,
    m,
    ms,
    label: `${h}h ${m}m`,
  }
}

/**
 * Personaje "del día" determinístico — todos los usuarios ven el mismo
 * en la misma fecha local. Sirve para los Daily de Guess Character /
 * Guess Anime / Anidel. La key {@code prefix} permite que cada juego
 * tenga su propio rotativo (sin que Guess Character y Anidel coincidan
 * en el mismo personaje cada día).
 */
export function personajeDelDia(
  prefix = '',
  date = new Date(),
  catalogo: unknown = readCatalogoPersonajesSnapshot(),
): GamePersonaje | null {
  const personajes = readGameCatalog(catalogo)
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
export function impostorDelDia(
  date = new Date(),
  salt = '',
  catalogo: unknown = readCatalogoPersonajesSnapshot(),
): ImpostorRound | null {
  const personajes = readGameCatalog(catalogo)
  if (personajes.length === 0) return null
  const seed = `impostor:${fechaDelDia(date)}:${salt}`
  const rand = mulberry32(djb2(seed))

  // Agrupa personajes por anime y filtra a animes con ≥4.
  const porAnime: Record<string, GamePersonaje[]> = {}
  for (const p of personajes) {
    if (!porAnime[p.anime]) porAnime[p.anime] = []
    porAnime[p.anime].push(p)
  }
  const animesGrandes = Object.entries(porAnime).filter(([, l]) => l.length >= 4)
  if (animesGrandes.length === 0) return null

  const [animeElegido, lista] = animesGrandes[Math.floor(rand() * animesGrandes.length)]

  // 4 del anime elegido. shuffleDeterministic (Fisher-Yates) en vez de
  // sort(() => rand()-0.5): este último está sesgado Y consume un número de
  // llamadas a rand() que depende del algoritmo de sort del MOTOR (V8 vs
  // SpiderMonkey difieren), así que el "diario" salía distinto en cada navegador
  // y rompía la ronda compartible. Fisher-Yates consume exactamente n-1 rand().
  const baraja = shuffleDeterministic(lista, rand).slice(0, 4)

  // 1 impostor de otro anime cualquiera (no del mismo)
  const otros = personajes.filter((p) => p.anime !== animeElegido)
  const impostor = otros[Math.floor(rand() * otros.length)]

  // Mix + shuffle determinístico (mismo motivo que arriba).
  const items = shuffleDeterministic(
      [...baraja, impostor].map((p) => ({ ...p, esImpostor: p.slug === impostor.slug })),
      rand,
  )

  return { anime: animeElegido, items }
}

export function crearBancoPreguntasOraculo(
  catalogo: unknown = readCatalogoPersonajesSnapshot(),
  tagProvider: OraculoTagProvider = defaultTagProvider,
): OraculoQuestion[] {
  const personajes = readGameCatalog(catalogo)
  if (personajes.length === 0) return []

  const porAnime = new Map<string, number>()
  for (const personaje of personajes) {
    porAnime.set(personaje.anime, (porAnime.get(personaje.anime) ?? 0) + 1)
  }

  const animeQuestions = [...porAnime.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, 18)
    .map(([anime]) => ({
      id: `anime:${stableId(anime)}`,
      label: anime,
      texto: `¿Pertenece a ${anime}?`,
      kind: 'anime' as const,
      value: anime,
      weight: 1.4,
    }))

  const tagQuestions = ORACULO_TAG_QUESTIONS
    .map((question) => {
      const count = personajes.filter((p) => tagProvider(p).includes(question.tag)).length
      return { ...question, count }
    })
    .filter((question) => question.count >= 2)
    .map((question) => ({
      id: `tag:${question.tag}`,
      label: question.label,
      texto: question.texto,
      kind: 'tag' as const,
      value: question.tag,
      weight: 1.1,
    }))

  const eloQuestions = personajes.length >= 8
    ? [
        {
          id: 'elo:alto',
          label: 'ELO base alto',
          texto: '¿Lo imaginas en zona alta del catálogo por ELO base?',
          kind: 'elo' as const,
          value: 'alto',
          weight: 0.85,
        },
        {
          id: 'elo:underdog',
          label: 'Underdog',
          texto: '¿Es más bien un underdog del catálogo?',
          kind: 'elo' as const,
          value: 'underdog',
          weight: 0.75,
        },
      ]
    : []

  return [...animeQuestions, ...tagQuestions, ...eloQuestions]
}

export function cumplePreguntaOraculo(
  pregunta: OraculoQuestion,
  personaje: GamePersonaje,
  tagProvider: OraculoTagProvider = defaultTagProvider,
): boolean {
  if (pregunta.kind === 'anime') return personaje.anime === pregunta.value
  if (pregunta.kind === 'tag') return tagProvider(personaje).includes(pregunta.value)
  const elo = getStatsPersonajeEstimado(personaje.slug).elo
  if (pregunta.value === 'alto') return elo >= 1875
  if (pregunta.value === 'underdog') return elo <= 1735
  return false
}

export function rankOraculoCandidates(
  catalogo: unknown = readCatalogoPersonajesSnapshot(),
  respuestas: OraculoAnswerRecord = {},
  tagProvider: OraculoTagProvider = defaultTagProvider,
): OraculoCandidate[] {
  const personajes = readGameCatalog(catalogo)
  const preguntas = new Map(
    crearBancoPreguntasOraculo(personajes, tagProvider).map((pregunta) => [
      pregunta.id,
      pregunta,
    ]),
  )
  const entradas = Object.entries(respuestas).filter(([, respuesta]) => respuesta !== 'nose')
  const maxScore = Math.max(
    1,
    entradas.reduce((acc, [id]) => acc + (preguntas.get(id)?.weight ?? 1), 0),
  )

  return personajes
    .map((personaje) => {
      let score = getStatsPersonajeEstimado(personaje.slug).elo / 10_000
      let matches = 0
      let contradicciones = 0

      for (const [id, respuesta] of entradas) {
        const pregunta = preguntas.get(id)
        if (!pregunta) continue
        const cumple = cumplePreguntaOraculo(pregunta, personaje, tagProvider)
        const coincide =
          (respuesta === 'si' && cumple) ||
          (respuesta === 'no' && !cumple)
        if (coincide) {
          matches += 1
          score += pregunta.weight
        } else {
          contradicciones += 1
          score -= pregunta.weight * 1.35
        }
      }

      const rawConfidence = entradas.length === 0
        ? 0
        : ((score + maxScore) / (maxScore * 2)) * 82 +
          Math.min(12, entradas.length * 2) -
          contradicciones * 9
      const confianza = Math.max(0, Math.min(99, Math.round(rawConfidence)))

      return {
        ...personaje,
        score,
        confianza,
        matches,
        contradicciones,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return getStatsPersonajeEstimado(b.slug).elo - getStatsPersonajeEstimado(a.slug).elo
    })
}

export function seleccionarPreguntaOraculo(
  catalogo: unknown = readCatalogoPersonajesSnapshot(),
  respuestas: OraculoAnswerRecord = {},
  tagProvider: OraculoTagProvider = defaultTagProvider,
): OraculoQuestion | null {
  const preguntas = crearBancoPreguntasOraculo(catalogo, tagProvider)
  const yaRespondidas = new Set(Object.keys(respuestas))
  const candidates = rankOraculoCandidates(catalogo, respuestas, tagProvider)
    .filter((candidate) => candidate.contradicciones <= 1)
    .slice(0, 28)
  const universo = candidates.length >= 4 ? candidates : rankOraculoCandidates(catalogo, {}, tagProvider).slice(0, 40)

  let mejor: { pregunta: OraculoQuestion; score: number } | null = null
  for (const pregunta of preguntas) {
    if (yaRespondidas.has(pregunta.id)) continue
    let si = 0
    let no = 0
    for (const personaje of universo) {
      if (cumplePreguntaOraculo(pregunta, personaje, tagProvider)) si += 1
      else no += 1
    }
    const total = si + no
    if (total < 4 || si === 0 || no === 0) continue
    const balance = Math.min(si, no) / total
    const score = balance * 100 + pregunta.weight * 4
    if (!mejor || score > mejor.score) mejor = { pregunta, score }
  }

  return mejor?.pregunta ?? null
}

export function nexoAnimeDelDia(
  date = new Date(),
  salt = '',
  catalogo: unknown = readCatalogoPersonajesSnapshot(),
): NexoAnimeRound | null {
  const personajes = readGameCatalog(catalogo)
  if (personajes.length === 0) return null
  const seed = `nexo-anime:${fechaDelDia(date)}:${salt}`
  const rand = mulberry32(djb2(seed))

  const porAnime: Record<string, GamePersonaje[]> = {}
  for (const personaje of personajes) {
    if (!porAnime[personaje.anime]) porAnime[personaje.anime] = []
    porAnime[personaje.anime].push(personaje)
  }

  const elegibles = Object.entries(porAnime).filter(([, lista]) => lista.length >= 2)
  if (elegibles.length < 4) return null

  const groups = shuffleDeterministic(elegibles, rand)
    .slice(0, 4)
    .map(([anime, lista]) => {
      const seleccion = shuffleDeterministic(lista, rand).slice(0, 2)
      return {
        id: `anime:${stableId(anime)}`,
        anime,
        items: [seleccion[0], seleccion[1]] as [GamePersonaje, GamePersonaje],
      }
    })

  const cards = shuffleDeterministic(
    groups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupId: group.id,
      })),
    ),
    rand,
  )

  return {
    fecha: fechaDelDia(date),
    groups,
    cards,
  }
}

/** PRNG determinístico simple inicializado por seed entero. */
function mulberry32(seed: number): () => number {
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
export function normalizar(s: unknown): string {
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
export function buildShareSquares(
  intentos: Array<boolean | null | undefined>,
  totalMax: number,
): string {
  let line = ''
  for (let i = 0; i < totalMax; i++) {
    const intento = intentos[i]
    if (intento == null) line += '⬛'
    else if (intento) line += '🟩'
    else line += '🟥'
  }
  return line
}

export function buildGameShareText({
  game,
  date = fechaDelDia(),
  result,
  detail,
  grid,
  extra,
}: GameShareInput): string {
  const heading = date
    ? `${game} #${date}: ${result}`
    : `${game}: ${result}`
  return [heading, detail, grid, extra].filter(Boolean).join('\n')
}

/**
 * Wrapper de localStorage que no truena si el navegador deniega acceso
 * (modo privado iOS, cookies bloqueadas). Devuelve null en lectura
 * fallida, no-op en escritura.
 */
export const safeStorage: SafeStorage = {
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
