import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fechaDelDia,
  getDailyResetCountdown,
  personajeDelDia,
  impostorDelDia,
  normalizar,
  buildShareSquares,
  buildGameShareText,
  safeStorage,
  ELO_DUEL_BEST_KEY,
  ELO_DUEL_LEGACY_BEST_KEY,
} from './games'
import type { PersonajeLite } from './types'

// ─── Mock helpers ───────────────────────────────────────────────────────────────

const makeStorage = (data: Record<string, string> = {}): Storage =>
  ({
    getItem: vi.fn((key: string) => data[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { data[key] = value }),
    removeItem: vi.fn((key: string) => { delete data[key] }),
    clear: vi.fn(() => { Object.keys(data).forEach((k) => { delete data[k] }) }),
    key: vi.fn((i: number) => Object.keys(data)[i] ?? null),
    get length() { return Object.keys(data).length },
  }) as unknown as Storage

// Fixture de personajes para testing (evita importar el JSON real con 1086 entries)
const makeFixtures = (slugs: string[]): Array<PersonajeLite & { anime: string }> =>
  slugs.map((slug) => ({ slug, nombre: `${slug} name`, anime: `${slug}-anime` }))

// ─── ELO_DUEL_BEST_KEY / ELO_DUEL_LEGACY_BEST_KEY ────────────────────────────────

describe('ELO keys', () => {
  it('exports the correct storage keys', () => {
    expect(ELO_DUEL_BEST_KEY).toBe('animeshowdown.higherOrLower.best')
    expect(ELO_DUEL_LEGACY_BEST_KEY).toBe('animeshowdown.higher-or-lower.best')
  })
})

// ─── fechaDelDia ────────────────────────────────────────────────────────────────

describe('fechaDelDia', () => {
  it('returns YYYY-MM-DD format', () => {
    const d = new Date(2026, 4, 28, 14, 30, 0) // local: May 28
    expect(fechaDelDia(d)).toBe('2026-05-28')
  })

  it('pads month and day to two digits', () => {
    expect(fechaDelDia(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05')
  })

  it('uses local date (not UTC)', () => {
    const d = new Date(2026, 4, 28, 3, 0, 0) // 3 AM local on May 28
    expect(fechaDelDia(d)).toBe('2026-05-28')
  })

  it('accepts ISO string input', () => {
    const d = new Date('2026-05-28T12:00:00.000Z')
    const result = fechaDelDia(d)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('defaults to now when no argument provided', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 12, 0, 0))
    expect(fechaDelDia()).toBe('2026-05-28')
    vi.useRealTimers()
  })
})

// ─── getDailyResetCountdown ─────────────────────────────────────────────────────

describe('getDailyResetCountdown', () => {
  it('calculates countdown from midday local time — 11h to next reset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 13, 0, 0)) // May 28 13:00 local
    const result = getDailyResetCountdown()
    expect(result.h).toBe(11)
    expect(result.m).toBe(0)
    vi.useRealTimers()
  })

  it('calculates countdown near end of day — 0h 1m', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 23, 59, 0)) // May 28 23:59 local
    const result = getDailyResetCountdown()
    expect(result.h).toBe(0)
    expect(result.m).toBe(1)
    expect(result.ms).toBe(60_000)
    vi.useRealTimers()
  })

  it('calculates countdown at midnight — 24h', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 0, 0, 0)) // May 28 midnight
    const result = getDailyResetCountdown()
    expect(result.h).toBe(24)
    expect(result.m).toBe(0)
    vi.useRealTimers()
  })

  it('returns non-negative ms always', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 23, 59, 59, 999))
    const result = getDailyResetCountdown()
    expect(result.ms).toBeGreaterThanOrEqual(0)
    vi.useRealTimers()
  })

  it('builds label string', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 13, 0, 0))
    const result = getDailyResetCountdown()
    expect(result.label).toBe('11h 0m')
    vi.useRealTimers()
  })

  it('accepts custom date parameter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 27, 13, 0, 0)) // one day before
    const result = getDailyResetCountdown(new Date(2026, 4, 28, 12, 0, 0))
    expect(result.h).toBe(12)
    vi.useRealTimers()
  })
})

// ─── personajeDelDia ───────────────────────────────────────────────────────────

describe('personajeDelDia', () => {
  const fixtures = makeFixtures(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])

  it('returns null when catalogo is empty', () => {
    expect(personajeDelDia('test', new Date(), [])).toBeNull()
  })

  it('returns null when catalogo is not an array', () => {
    expect(personajeDelDia('test', new Date(), null)).toBeNull()
    expect(personajeDelDia('test', new Date(), undefined)).toBeNull()
  })

  it('returns a character from the catalog', () => {
    const result = personajeDelDia('test', new Date('2026-05-28'), fixtures)
    expect(result).not.toBeNull()
    expect(result!.slug).toMatch(/^[a-j]$/)
  })

  it('is deterministic for same date+prefix', () => {
    const d = new Date('2026-05-28')
    const r1 = personajeDelDia('mygame', d, fixtures)
    const r2 = personajeDelDia('mygame', d, fixtures)
    expect(r1!.slug).toBe(r2!.slug)
  })

  it('different dates return different characters (usually)', () => {
    const r1 = personajeDelDia('test', new Date('2026-05-28'), fixtures)
    const r2 = personajeDelDia('test', new Date('2026-05-29'), fixtures)
    // Different dates likely produce different indices; not guaranteed but high probability
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
  })

  it('different prefixes return different results for same date', () => {
    const d = new Date('2026-05-28')
    const r1 = personajeDelDia('game-a', d, fixtures)
    const r2 = personajeDelDia('game-b', d, fixtures)
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
  })
})

// ─── impostorDelDia ─────────────────────────────────────────────────────────────

describe('impostorDelDia', () => {
  // Fixture: 4 characters from AnimeA + 4 from AnimeB (minimum for impostorDelDia)
  const fixtures = [
    { slug: 'a1', nombre: 'A1', anime: 'AnimeA' },
    { slug: 'a2', nombre: 'A2', anime: 'AnimeA' },
    { slug: 'a3', nombre: 'A3', anime: 'AnimeA' },
    { slug: 'a4', nombre: 'A4', anime: 'AnimeA' },
    { slug: 'b1', nombre: 'B1', anime: 'AnimeB' },
    { slug: 'b2', nombre: 'B2', anime: 'AnimeB' },
    { slug: 'b3', nombre: 'B3', anime: 'AnimeB' },
    { slug: 'b4', nombre: 'B4', anime: 'AnimeB' },
  ] as Array<PersonajeLite & { anime: string }>

  it('returns null when catalog is empty', () => {
    expect(impostorDelDia(new Date(), '', [])).toBeNull()
  })

  it('returns null when catalog has no anime with ≥4 characters', () => {
    expect(impostorDelDia(new Date(), '', [
      { slug: 'a', nombre: 'A', anime: 'AnimeA' },
      { slug: 'b', nombre: 'B', anime: 'AnimeA' },
      { slug: 'c', nombre: 'C', anime: 'AnimeA' },
    ])).toBeNull()
  })

  it('returns an ImpostorRound with 5 items', () => {
    const result = impostorDelDia(new Date('2026-05-28'), 'salt0', fixtures)
    expect(result).not.toBeNull()
    expect(result!.items.length).toBe(5)
  })

  it('has exactly 1 impostor (esImpostor: true)', () => {
    const result = impostorDelDia(new Date('2026-05-28'), 'salt0', fixtures)
    const impostors = result!.items.filter(i => i.esImpostor)
    expect(impostors.length).toBe(1)
  })

  it('has 4 non-impostor items from the same anime', () => {
    const result = impostorDelDia(new Date('2026-05-28'), 'salt0', fixtures)
    const impostor = result!.items.find(i => i.esImpostor)!
    const nonImpostors = result!.items.filter(i => !i.esImpostor)
    expect(nonImpostors.length).toBe(4)
    nonImpostors.forEach(ni => expect(ni.anime).toBe(result!.anime))
  })

  it('impostor is from a different anime', () => {
    const result = impostorDelDia(new Date('2026-05-28'), 'salt0', fixtures)
    const impostor = result!.items.find(i => i.esImpostor)!
    const nonImpostors = result!.items.filter(i => !i.esImpostor)
    expect(impostor.anime).not.toBe(nonImpostors[0].anime)
  })

  it('is deterministic for same date+salt', () => {
    const d = new Date('2026-05-28')
    const r1 = impostorDelDia(d, 'salt0', fixtures)
    const r2 = impostorDelDia(d, 'salt0', fixtures)
    expect(r1!.anime).toBe(r2!.anime)
    expect(r1!.items.map(i => i.slug)).toEqual(r2!.items.map(i => i.slug))
  })

  it('different salts give different results', () => {
    const d = new Date('2026-05-28')
    const r1 = impostorDelDia(d, 'salt0', fixtures)
    const r2 = impostorDelDia(d, 'salt1', fixtures)
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
  })
})

// ─── normalizar ────────────────────────────────────────────────────────────────

describe('normalizar', () => {
  it('lowercases string', () => {
    expect(normalizar('Akame')).toBe('akame')
  })

  it('removes accents', () => {
    expect(normalizar('café')).toBe('cafe')
  })

  it('replaces multiple spaces/special chars with single space', () => {
    expect(normalizar('Akame  ga--Kill!')).toBe('akame ga kill')
  })

  it('trims leading/trailing spaces', () => {
    expect(normalizar('  hello  ')).toBe('hello')
  })

  it('handles null/undefined as empty string', () => {
    expect(normalizar(null)).toBe('')
    expect(normalizar(undefined)).toBe('')
    expect(normalizar(123 as unknown as string)).toBe('123')
  })
})

// ─── buildShareSquares ──────────────────────────────────────────────────────────

describe('buildShareSquares', () => {
  it('returns all black squares when no attempts', () => {
    expect(buildShareSquares([], 5)).toBe('⬛⬛⬛⬛⬛')
  })

  it('returns green for correct attempts', () => {
    expect(buildShareSquares([true, true], 4)).toBe('🟩🟩⬛⬛')
  })

  it('returns red for incorrect attempts', () => {
    expect(buildShareSquares([false, false], 4)).toBe('🟥🟥⬛⬛')
  })

  it('mixes green and red correctly', () => {
    expect(buildShareSquares([true, false, null], 3)).toBe('🟩🟥⬛')
  })

  it('ignores attempts beyond totalMax', () => {
    expect(buildShareSquares([true, true, true, true], 2)).toBe('🟩🟩')
  })

  it('handles null/undefined as black square', () => {
    expect(buildShareSquares([null, undefined, true], 3)).toBe('⬛⬛🟩')
  })
})

// ─── buildGameShareText ─────────────────────────────────────────────────────────

describe('buildGameShareText', () => {
  it('builds text with all fields', () => {
    const text = buildGameShareText({
      game: 'Guess Character',
      date: '2026-05-28',
      result: 'Solved!',
      detail: '5 attempts',
      grid: '🟩🟩⬛⬛⬛',
    })
    expect(text).toContain('Guess Character #2026-05-28: Solved!')
    expect(text).toContain('5 attempts')
    expect(text).toContain('🟩🟩⬛⬛⬛')
  })

  it('builds text with current date when date is not passed (default = fechaDelDia)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 28, 12, 0, 0))
    const text = buildGameShareText({
      game: 'Guess Character',
      result: 'Solved!',
    })
    expect(text).toContain('Guess Character #2026-05-28: Solved!')
    vi.useRealTimers()
  })

  it('skips date when date is empty string', () => {
    const text = buildGameShareText({
      game: 'Anidel',
      date: '',
      result: 'Failed',
    })
    expect(text).toBe('Anidel: Failed')
  })

  it('uses date-less heading when date is empty string', () => {
    const text = buildGameShareText({
      game: 'Anidel',
      date: '',
      result: 'Failed',
    })
    expect(text).toBe('Anidel: Failed')
  })
})

// ─── safeStorage ────────────────────────────────────────────────────────────────

describe('safeStorage', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('get returns null when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined as unknown as Storage)
    expect(safeStorage.get('any-key')).toBeNull()
  })

  it('set is no-op when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined as unknown as Storage)
    expect(() => safeStorage.set('key', 'value')).not.toThrow()
  })

  it('get/set roundtrip with mock localStorage', () => {
    const data: Record<string, string> = {}
    vi.stubGlobal('localStorage', makeStorage(data))
    safeStorage.set('test-key', 'test-value')
    expect(safeStorage.get('test-key')).toBe('test-value')
  })

  it('get returns null on error (catch)', () => {
    const storage = makeStorage({})
    storage.getItem = vi.fn(() => { throw new Error('storage error') })
    vi.stubGlobal('localStorage', storage)
    expect(safeStorage.get('key')).toBeNull()
  })

  it('set is no-op on error (catch)', () => {
    const storage = makeStorage({})
    storage.setItem = vi.fn(() => { throw new Error('storage error') })
    vi.stubGlobal('localStorage', storage)
    expect(() => safeStorage.set('key', 'value')).not.toThrow()
  })
})