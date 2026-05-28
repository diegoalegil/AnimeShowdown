import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LOCAL_VOTE_RANKING_EVENT,
  readLocalVotes,
  recordLocalVote,
  clearLocalVotes,
  listenLocalVotes,
  filterLocalVotesByPeriod,
  getLocalVoteStats,
} from './localVoteRanking'
import type { LocalVote } from './types'

// ─── Mock helpers ───────────────────────────────────────────────────────────────

function makeStorage(data: Record<string, string> = {}): Storage {
  const store = { ...data }
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => { delete store[k] }) }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() { return Object.keys(store).length },
  } as unknown as Storage
}

// ─── LOCAL_VOTE_RANKING_EVENT constant ──────────────────────────────────────────

describe('LOCAL_VOTE_RANKING_EVENT', () => {
  it('exports the expected event name', () => {
    expect(LOCAL_VOTE_RANKING_EVENT).toBe('animeshowdown:local-vote-ranking')
  })
})

// ─── readLocalVotes ─────────────────────────────────────────────────────────────

describe('readLocalVotes', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns empty array when storage is empty', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    expect(readLocalVotes()).toEqual([])
  })

  it('returns empty array on JSON parse error (corrupt storage)', () => {
    vi.stubGlobal('localStorage', makeStorage({ 'animeshowdown.local-votes.v1': '{not-valid-json' }))
    expect(readLocalVotes()).toEqual([])
  })

  it('returns empty array when stored value is not an array', () => {
    vi.stubGlobal('localStorage', makeStorage({ 'animeshowdown.local-votes.v1': '"just-a-string"' }))
    expect(readLocalVotes()).toEqual([])
  })

  it('normalizes valid vote entries, drops malformed ones', () => {
    vi.stubGlobal('localStorage', makeStorage({
      'animeshowdown.local-votes.v1': JSON.stringify([
        { winnerSlug: 'naruto', winnerNombre: 'Naruto' } as unknown as LocalVote, // missing fields
        { at: '2026-05-28T00:00:00.000Z', date: '2026-05-28', ganadorSlug: 'luffy', ganadorNombre: 'Luffy', source: 'votar' } as unknown as LocalVote,
        null,
        { at: '2026-05-28T01:00:00.000Z', winnerSlug: 'goku', winnerNombre: 'Goku' } as unknown as LocalVote, // no ganadorSlug
      ]),
    }))
    const result = readLocalVotes()
    // Only luffy entry has both required fields
    expect(result.length).toBe(1)
    expect(result[0].ganadorSlug).toBe('luffy')
  })

  it('respects MAX_LOCAL_VOTES (500) limit — returns last 500', () => {
    const votes = Array.from({ length: 520 }, (_, i) => ({
      id: `vote-${i}`,
      at: new Date(i * 1000).toISOString(),
      date: '2026-05-28',
      ganadorSlug: 'naruto',
      ganadorNombre: 'Naruto',
      ganadorAnime: 'Naruto',
      source: 'votar',
    })) as unknown as LocalVote[]
    vi.stubGlobal('localStorage', makeStorage({ 'animeshowdown.local-votes.v1': JSON.stringify(votes) }))
    expect(readLocalVotes().length).toBeLessThanOrEqual(500)
  })

  it('reverses order (newest first)', () => {
    const votes = [
      { id: 'v1', at: '2026-05-28T00:00:00.000Z', date: '2026-05-28', ganadorSlug: 'a', ganadorNombre: 'A', source: 'votar' },
      { id: 'v2', at: '2026-05-28T01:00:00.000Z', date: '2026-05-28', ganadorSlug: 'b', ganadorNombre: 'B', source: 'votar' },
    ] as unknown as LocalVote[]
    vi.stubGlobal('localStorage', makeStorage({ 'animeshowdown.local-votes.v1': JSON.stringify(votes) }))
    const result = readLocalVotes()
    expect(result[0].ganadorSlug).toBe('b')
    expect(result[1].ganadorSlug).toBe('a')
  })

  it('defaults missing optional fields (perdedorSlug, source, etc.)', () => {
    vi.stubGlobal('localStorage', makeStorage({
      'animeshowdown.local-votes.v1': JSON.stringify([{
        id: 'v1',
        at: '2026-05-28T00:00:00.000Z',
        date: '2026-05-28',
        ganadorSlug: 'luffy',
        ganadorNombre: 'Luffy',
      }]),
    }))
    const result = readLocalVotes()
    expect(result[0].perdedorSlug).toBe('')
    expect(result[0].source).toBe('votar')
    expect(result[0].ganadorAnime).toBe('')
  })

  it('generates id from at+ganadorSlug when id missing', () => {
    vi.stubGlobal('localStorage', makeStorage({
      'animeshowdown.local-votes.v1': JSON.stringify([{
        at: '2026-05-28T00:00:00.000Z',
        date: '2026-05-28',
        ganadorSlug: 'luffy',
        ganadorNombre: 'Luffy',
      }]),
    }))
    const result = readLocalVotes()
    expect(result[0].id).toBe('2026-05-28T00:00:00.000Z:luffy')
  })
})

// ─── recordLocalVote ───────────────────────────────────────────────────────────

describe('recordLocalVote', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns empty array when ganador is null', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    const result = recordLocalVote(null, null)
    expect(result).toEqual([])
  })

  it('returns empty array when ganador.slug is missing', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    const result = recordLocalVote({ slug: '', nombre: 'Luffy' }, null)
    expect(result).toEqual([])
  })

  it('saves vote to localStorage on success', () => {
    const storage = makeStorage({})
    vi.stubGlobal('localStorage', storage)

    recordLocalVote(
      { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' },
      { slug: 'goku', nombre: 'Goku', anime: 'DBZ' },
    )

    expect(storage.setItem).toHaveBeenCalled()
    const saved = JSON.parse(storage.getItem('animeshowdown.local-votes.v1')!)
    expect(saved.length).toBe(1)
    expect(saved[0].ganadorSlug).toBe('luffy')
    expect(saved[0].ganadorAnime).toBe('One Piece')
  })

  it('respects source parameter', () => {
    const storage = makeStorage({})
    vi.stubGlobal('localStorage', storage)

    recordLocalVote(
      { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' },
      null,
      { source: 'bracket' },
    )

    const saved = JSON.parse(storage.getItem('animeshowdown.local-votes.v1')!)
    expect(saved[0].source).toBe('bracket')
  })

  it('returns reversed list (newest first)', () => {
    const storage = makeStorage({})
    vi.stubGlobal('localStorage', storage)

    const result = recordLocalVote(
      { slug: 'naruto', nombre: 'Naruto', anime: 'Naruto' },
      null,
    )

    expect(result[0].ganadorSlug).toBe('naruto')
    expect(result.length).toBe(1)
  })

  it('keeps only last 500 votes', () => {
    vi.unstubAllGlobals()
    // Build the existing votes as a mutable array
    const existingData: Array<Record<string, string>> = Array.from({ length: 505 }, (_, i) => ({
      id: `existing-${i}`,
      at: new Date(i * 1000).toISOString(),
      date: '2026-05-28',
      ganadorSlug: `char-${i}`,
      ganadorNombre: `Char ${i}`,
      source: 'votar',
    }))
    // Use a plain object that setItem can mutate (mimics real localStorage behavior)
    const localData: Record<string, string> = {}
    localData['animeshowdown.local-votes.v1'] = JSON.stringify(existingData)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localData[key] ?? null,
      setItem: (key: string, value: string) => { localData[key] = value },
    } as unknown as Storage)

    recordLocalVote(
      { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' },
      null,
    )

    const saved = JSON.parse(localData['animeshowdown.local-votes.v1']!)
    expect(saved.length).toBeLessThanOrEqual(500)
    vi.unstubAllGlobals()
  })
})

// ─── clearLocalVotes ────────────────────────────────────────────────────────────

describe('clearLocalVotes', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('writes empty array to storage', () => {
    const storage = makeStorage({ 'animeshowdown.local-votes.v1': 'something' })
    vi.stubGlobal('localStorage', storage)

    clearLocalVotes()

    expect(storage.setItem).toHaveBeenCalledWith('animeshowdown.local-votes.v1', '[]')
  })
})

// ─── listenLocalVotes ──────────────────────────────────────────────────────────

describe('listenLocalVotes', () => {
  let windowListeners: Array<{ event: string; handler: EventListener }> = []
  let dispatchEventSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.unstubAllGlobals()
    windowListeners = []
    dispatchEventSpy = vi.fn()
    vi.stubGlobal('window', {
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        windowListeners.push({ event, handler })
      }),
      removeEventListener: vi.fn((event: string, handler: EventListener) => {
        windowListeners = windowListeners.filter(l => !(l.event === event && l.handler === handler))
      }),
      dispatchEvent: dispatchEventSpy,
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('registers two event listeners (custom + storage)', () => {
    const storage = makeStorage({})
    vi.stubGlobal('localStorage', storage)

    const unsub = listenLocalVotes(() => {})
    expect(window.addEventListener).toHaveBeenCalledTimes(2)
    unsub()
    expect(window.removeEventListener).toHaveBeenCalledTimes(2)
  })

  it('unsubscribe removes both listeners', () => {
    const storage = makeStorage({})
    vi.stubGlobal('localStorage', storage)

    const unsub = listenLocalVotes(() => {})
    unsub()
    expect(window.removeEventListener).toHaveBeenCalledTimes(2)
  })

  it('returns no-op function in non-browser environment', () => {
    vi.stubGlobal('window', undefined as unknown as Window)
    const unsub = listenLocalVotes(() => {})
    expect(typeof unsub).toBe('function')
  })

  it('calls callback with readLocalVotes() result when custom event fires', () => {
    const storage = makeStorage({ 'animeshowdown.local-votes.v1': JSON.stringify([
      { id: 'v1', at: '2026-05-28T00:00:00.000Z', date: '2026-05-28', ganadorSlug: 'luffy', ganadorNombre: 'Luffy', source: 'votar' }
    ]) })
    vi.stubGlobal('localStorage', storage)

    const callback = vi.fn()
    const unsub = listenLocalVotes(callback)

    const customEvent = new CustomEvent(LOCAL_VOTE_RANKING_EVENT, {
      detail: { votes: [{ id: 'v1', at: '2026-05-28T00:00:00.000Z', date: '2026-05-28', ganadorSlug: 'naruto', ganadorNombre: 'Naruto', source: 'votar' }] }
    })
    windowListeners.find(l => l.event === LOCAL_VOTE_RANKING_EVENT)?.handler(customEvent)

    expect(callback).toHaveBeenCalled()
    const calledWith = callback.mock.calls[0][0]
    expect(calledWith[0].ganadorSlug).toBe('naruto')
    unsub()
  })
})

// ─── filterLocalVotesByPeriod ──────────────────────────────────────────────────

describe('filterLocalVotesByPeriod', () => {
  const votes = [
    { id: 'v1', at: '2026-05-27T10:00:00.000Z', date: '2026-05-27', ganadorSlug: 'a', ganadorNombre: 'A', source: 'votar' },
    { id: 'v2', at: '2026-05-28T10:00:00.000Z', date: '2026-05-28', ganadorSlug: 'b', ganadorNombre: 'B', source: 'votar' },
    { id: 'v3', at: '2026-05-28T11:00:00.000Z', date: '2026-05-28', ganadorSlug: 'c', ganadorNombre: 'C', source: 'votar' },
  ] as unknown as LocalVote[]

  it('returns all when period is "all"', () => {
    expect(filterLocalVotesByPeriod(votes, 'all').length).toBe(3)
  })

  it('returns today votes when period is "today"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 12, 0, 0))
    const result = filterLocalVotesByPeriod(votes, 'today')
    expect(result.length).toBe(2)
    expect(result[0].ganadorSlug).toBe('b')
    vi.useRealTimers()
  })

  it('returns last 7 days when period is "7d"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 12, 0, 0))
    const result = filterLocalVotesByPeriod(votes, '7d')
    expect(result.length).toBe(3) // all within last 7 days
    vi.useRealTimers()
  })

  it('returns last N days when period is a number', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 12, 0, 0))
    expect(filterLocalVotesByPeriod(votes, 1).length).toBe(2) // today only
    vi.useRealTimers()
  })

  it('returns all for invalid period (NaN or ≤0)', () => {
    expect(filterLocalVotesByPeriod(votes, 'invalid' as unknown as string).length).toBe(3)
    expect(filterLocalVotesByPeriod(votes, -5 as unknown as number).length).toBe(3)
  })

  it('handles non-array input gracefully', () => {
    expect(filterLocalVotesByPeriod(null, 'all').length).toBe(0)
    expect(filterLocalVotesByPeriod(undefined, 'all').length).toBe(0)
  })
})

// ─── getLocalVoteStats ──────────────────────────────────────────────────────────

describe('getLocalVoteStats', () => {
  const votes = [
    { id: 'v1', at: '2026-05-28T00:00:00.000Z', date: '2026-05-28', ganadorSlug: 'luffy', ganadorNombre: 'Luffy', ganadorAnime: 'One Piece', source: 'votar' },
    { id: 'v2', at: '2026-05-28T01:00:00.000Z', date: '2026-05-28', ganadorSlug: 'luffy', ganadorNombre: 'Luffy', ganadorAnime: 'One Piece', source: 'votar' },
    { id: 'v3', at: '2026-05-28T02:00:00.000Z', date: '2026-05-28', ganadorSlug: 'goku', ganadorNombre: 'Goku', ganadorAnime: 'DBZ', source: 'votar' },
  ] as unknown as LocalVote[]

  it('counts total votes', () => {
    const stats = getLocalVoteStats(votes)
    expect(stats.total).toBe(3)
  })

  it('counts unique characters', () => {
    const stats = getLocalVoteStats(votes)
    expect(stats.uniqueCharacters).toBe(2)
  })

  it('counts unique animes', () => {
    const stats = getLocalVoteStats(votes)
    expect(stats.uniqueAnimes).toBe(2)
  })

  it('ranks by count descending', () => {
    const stats = getLocalVoteStats(votes)
    expect(stats.top[0].slug).toBe('luffy')
    expect(stats.top[0].count).toBe(2)
    expect(stats.top[1].slug).toBe('goku')
    expect(stats.top[1].count).toBe(1)
  })

  it('aggregates animes by count descending', () => {
    const stats = getLocalVoteStats(votes)
    expect(stats.animes[0].anime).toBe('One Piece')
    expect(stats.animes[0].count).toBe(2)
  })

  it('returns latest 12 votes', () => {
    const stats = getLocalVoteStats(votes)
    expect(stats.latest.length).toBe(3)
    expect(stats.latest[0].ganadorSlug).toBe('luffy') // last in array = latest
  })

  it('handles empty array', () => {
    const stats = getLocalVoteStats([])
    expect(stats.total).toBe(0)
    expect(stats.uniqueCharacters).toBe(0)
    expect(stats.uniqueAnimes).toBe(0)
    expect(stats.top).toEqual([])
    expect(stats.animes).toEqual([])
    expect(stats.latest).toEqual([])
  })

  it('handles non-array input gracefully', () => {
    const stats = getLocalVoteStats(null as unknown as LocalVote[])
    expect(stats.total).toBe(0)
  })

  it('uses readLocalVotes() as default when no votes passed', () => {
    const storage = makeStorage({ 'animeshowdown.local-votes.v1': JSON.stringify(votes) })
    vi.stubGlobal('localStorage', storage)

    const stats = getLocalVoteStats()
    expect(stats.total).toBe(3)
    vi.unstubAllGlobals()
  })
})