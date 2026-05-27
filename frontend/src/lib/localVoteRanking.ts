import { fechaDelDia } from './games'
import type { LocalVote, PersonajeLite } from './types'

export const LOCAL_VOTE_RANKING_EVENT = 'animeshowdown:local-vote-ranking'

const STORAGE_KEY = 'animeshowdown.local-votes.v1'
const MAX_LOCAL_VOTES = 500

type LocalVoteSource = {
  source?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function safeGet(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function safeSet(value: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // El ranking personal es una mejora local; votar debe seguir funcionando.
  }
}

function notify(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(LOCAL_VOTE_RANKING_EVENT, {
      detail: { votes: readLocalVotes() },
    }),
  )
}

function safeDate(value: unknown): Date {
  const date =
    typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? new Date(value)
      : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function normalizeDate(value: unknown, atDate: Date): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value)
    : fechaDelDia(atDate)
}

function normalizeVote(value: unknown): LocalVote | null {
  if (!isRecord(value)) return null
  if (!value?.ganadorSlug || !value?.ganadorNombre) return null
  const atDate = safeDate(value.at)
  const at = atDate.toISOString()
  return {
    id: String(value.id || `${at}:${value.ganadorSlug}`),
    at,
    date: normalizeDate(value.date, atDate),
    ganadorSlug: String(value.ganadorSlug),
    ganadorNombre: String(value.ganadorNombre),
    ganadorAnime: String(value.ganadorAnime || ''),
    perdedorSlug: value.perdedorSlug ? String(value.perdedorSlug) : '',
    perdedorNombre: value.perdedorNombre ? String(value.perdedorNombre) : '',
    perdedorAnime: value.perdedorAnime ? String(value.perdedorAnime) : '',
    source: String(value.source || 'votar'),
  }
}

function publicPersonajeFields(personaje: PersonajeLite | null | undefined): Partial<PersonajeLite> {
  if (!personaje) return {}
  return {
    slug: personaje.slug,
    nombre: personaje.nombre,
    anime: personaje.anime,
  }
}

export function readLocalVotes(): LocalVote[] {
  const raw = safeGet()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeVote)
      .filter((vote): vote is LocalVote => Boolean(vote))
      .slice(-MAX_LOCAL_VOTES)
      .reverse()
  } catch {
    return []
  }
}

export function recordLocalVote(
  ganador: PersonajeLite | null | undefined,
  perdedor: PersonajeLite | null | undefined,
  { source = 'votar' }: LocalVoteSource = {},
): LocalVote[] {
  const g = publicPersonajeFields(ganador)
  if (!g.slug || !g.nombre) return []
  const p = publicPersonajeFields(perdedor)
  const now = new Date()
  const entry = normalizeVote({
    id: `${now.toISOString()}:${g.slug}:${p.slug || 'none'}`,
    at: now.toISOString(),
    date: fechaDelDia(now),
    ganadorSlug: g.slug,
    ganadorNombre: g.nombre,
    ganadorAnime: g.anime,
    perdedorSlug: p.slug,
    perdedorNombre: p.nombre,
    perdedorAnime: p.anime,
    source,
  })

  if (!entry) return readLocalVotes()

  const existing = readLocalVotes().reverse()
  const next = [...existing, entry].slice(-MAX_LOCAL_VOTES)
  safeSet(JSON.stringify(next))
  notify()
  return next.reverse()
}

export function clearLocalVotes(): void {
  safeSet(JSON.stringify([]))
  notify()
}

export function listenLocalVotes(callback: (votes: LocalVote[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const votes = event instanceof CustomEvent ? event.detail?.votes : null
    callback(votes || readLocalVotes())
  }
  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback(readLocalVotes())
  }
  window.addEventListener(LOCAL_VOTE_RANKING_EVENT, handler)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(LOCAL_VOTE_RANKING_EVENT, handler)
    window.removeEventListener('storage', storageHandler)
  }
}

export function filterLocalVotesByPeriod(
  votes: unknown,
  period: string | number = 'all',
): LocalVote[] {
  const list = Array.isArray(votes) ? votes as LocalVote[] : []
  if (period === 'all') return list
  const today = fechaDelDia()
  if (period === 'today') return list.filter((vote) => vote.date === today)
  const days = period === '7d' ? 7 : Number(period)
  if (!Number.isFinite(days) || days <= 0) return list
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  const minDate = fechaDelDia(start)
  return list.filter((vote) => vote.date >= minDate)
}

export function getLocalVoteStats(votes: LocalVote[] = readLocalVotes()) {
  const list = Array.isArray(votes) ? votes : []
  const bySlug = new Map()
  const byAnime = new Map()

  list.forEach((vote) => {
    const current = bySlug.get(vote.ganadorSlug) || {
      slug: vote.ganadorSlug,
      nombre: vote.ganadorNombre,
      anime: vote.ganadorAnime,
      count: 0,
      lastVoteAt: vote.at,
    }
    bySlug.set(vote.ganadorSlug, {
      ...current,
      count: current.count + 1,
      lastVoteAt: current.lastVoteAt > vote.at ? current.lastVoteAt : vote.at,
    })
    if (vote.ganadorAnime) {
      byAnime.set(vote.ganadorAnime, (byAnime.get(vote.ganadorAnime) || 0) + 1)
    }
  })

  const top = [...bySlug.values()]
    .sort((a, b) => b.count - a.count || b.lastVoteAt.localeCompare(a.lastVoteAt))
  const animes = [...byAnime.entries()]
    .map(([anime, count]) => ({ anime, count }))
    .sort((a, b) => b.count - a.count || a.anime.localeCompare(b.anime))

  return {
    total: list.length,
    uniqueCharacters: bySlug.size,
    uniqueAnimes: byAnime.size,
    top,
    animes,
    latest: list.slice(0, 12),
  }
}
