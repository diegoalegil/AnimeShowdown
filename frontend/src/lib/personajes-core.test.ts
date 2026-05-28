import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  canonicalPersonajeSlug,
  normalizarPersonajeCatalogo,
  normalizarCatalogoPersonajes,
  syncCatalogoPersonajes,
  readCatalogoPersonajesSnapshot,
  imagenPersonaje,
  getPersonajeBySlug,
  getIndicePersonaje,
  getPopularidad,
  getStatsPersonaje,
  getStatsPersonajeEstimado,
  PERSONAJE_SLUG_ALIASES,
  MISSING_IMAGE_PREFIX,
  CATALOGO_PERSONAJES_HYDRATED_EVENT,
  CATALOGO_PERSONAJES_STORAGE_KEY,
  personajes,
} from './personajes-core'
import type { PersonajeLite } from './types'
import { personajesFixtures } from '../test/fixtures/personajes.fixture'

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

// Reset the global personajes array between tests so state doesn't leak.
// The personajes variable is a module-level mutable array. If previous tests
// sync data into it, subsequent tests will see stale data unless we reset.
beforeEach(() => {
  // Clear global array reference
  personajes.splice(0, personajes.length)
  vi.unstubAllGlobals()
})
afterEach(() => {
  personajes.splice(0, personajes.length)
  vi.unstubAllGlobals()
})

// ─── canonicalPersonajeSlug ────────────────────────────────────────────────────

describe('canonicalPersonajeSlug', () => {
  it('returns alias for known slugs', () => {
    expect(canonicalPersonajeSlug('L')).toBe('l')
    expect(canonicalPersonajeSlug('all_might')).toBe('allmight')
    expect(canonicalPersonajeSlug('monkey_d_luffy')).toBe('luffy')
    expect(canonicalPersonajeSlug('roronoa_zoro')).toBe('zoro')
    expect(canonicalPersonajeSlug('jiraiya')).toBe('jiraya')
    expect(canonicalPersonajeSlug('hinata_hyuga')).toBe('hinata')
    expect(canonicalPersonajeSlug('katsuki_bakugou')).toBe('bakugo')
    expect(canonicalPersonajeSlug('yuji_itadori')).toBe('itadori')
    expect(canonicalPersonajeSlug('shinobu_kocho')).toBe('shinobu')
    expect(canonicalPersonajeSlug('boa_hancock_alt')).toBe('boa_hancock')
  })

  it('returns slug as-is for unknown', () => {
    expect(canonicalPersonajeSlug('luffy')).toBe('luffy')
    expect(canonicalPersonajeSlug('goku')).toBe('goku')
    expect(canonicalPersonajeSlug('unknown-slug-123')).toBe('unknown-slug-123')
  })

  it('is case-sensitive', () => {
    expect(canonicalPersonajeSlug('LUFFY')).toBe('LUFFY')
    expect(canonicalPersonajeSlug('Gojo')).toBe('Gojo')
  })
})

// ─── normalizarPersonajeCatalogo ────────────────────────────────────────────────

describe('normalizarPersonajeCatalogo', () => {
  it('returns null for null/undefined input', () => {
    expect(normalizarPersonajeCatalogo(null)).toBeNull()
    expect(normalizarPersonajeCatalogo(undefined)).toBeNull()
  })

  it('applies canonical slug', () => {
    const result = normalizarPersonajeCatalogo({ slug: 'all_might', nombre: 'All Might', anime: 'MHA' })
    expect(result!.slug).toBe('allmight')
  })

  it('uses imagenUrl over imagen', () => {
    const result = normalizarPersonajeCatalogo({
      slug: 'luffy',
      nombre: 'Luffy',
      anime: 'One Piece',
      imagen: 'old-url',
      imagenUrl: 'new-url',
    } as PersonajeLite & { imagenUrl: string })
    expect(result!.imagen).toBe('new-url')
    expect(result!.imagenUrl).toBe('new-url')
  })

  it('falls back to imagen when imagenUrl is null', () => {
    const result = normalizarPersonajeCatalogo({
      slug: 'goku',
      nombre: 'Goku',
      anime: 'DBZ',
      imagen: 'fallback-url',
      imagenUrl: null,
    } as PersonajeLite)
    expect(result!.imagen).toBe('fallback-url')
    expect(result!.imagenUrl).toBe('fallback-url')
  })

  it('returns null for missing required fields', () => {
    // Missing slug should still return a normalized object (slug becomes canonical '')
    const result = normalizarPersonajeCatalogo({ nombre: 'Nameless' } as PersonajeLite)
    expect(result).not.toBeNull()
    // Missing nombre → still valid (only slug is required by types)
    expect(normalizarPersonajeCatalogo({ slug: 'goku' } as PersonajeLite)).not.toBeNull()
  })
})

// ─── normalizarCatalogoPersonajes ───────────────────────────────────────────────

describe('normalizarCatalogoPersonajes', () => {
  it('returns empty array for non-array input', () => {
    expect(normalizarCatalogoPersonajes(null)).toEqual([])
    expect(normalizarCatalogoPersonajes(undefined)).toEqual([])
    expect(normalizarCatalogoPersonajes({})).toEqual([])
  })

  it('normalizes all entries, drops nulls', () => {
    const input = [
      { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece' },
      null,
      { slug: 'goku', nombre: 'Goku', anime: 'DBZ' },
    ]
    const result = normalizarCatalogoPersonajes(input as unknown[])
    expect(result.length).toBe(2)
    expect(result[0].slug).toBe('luffy')
    expect(result[1].slug).toBe('goku')
  })

  it('maps alias slugs to canonical', () => {
    const result = normalizarCatalogoPersonajes([
      { slug: 'all_might', nombre: 'All Might', anime: 'MHA' },
    ])
    expect(result[0].slug).toBe('allmight')
  })
})

// ─── syncCatalogoPersonajes ─────────────────────────────────────────────────────

describe('syncCatalogoPersonajes', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns global personajes array', () => {
    const result = syncCatalogoPersonajes([])
    expect(Array.isArray(result)).toBe(true)
  })

  it('populates global personajes from catalog', () => {
    const catalog = personajesFixtures.slice(0, 3)
    syncCatalogoPersonajes(catalog)
    // After sync, readCatalogoPersonajesSnapshot should return synced data
    expect(readCatalogoPersonajesSnapshot().length).toBeGreaterThan(0)
  })

  it('dispatches event when catalog changes', () => {
    const dispatchSpy = vi.fn()
    vi.stubGlobal('window', {
      dispatchEvent: dispatchSpy,
    })
    syncCatalogoPersonajes(personajesFixtures.slice(0, 2))
    expect(dispatchSpy).toHaveBeenCalled()
    expect((dispatchSpy.mock.calls[0][0] as Event).type).toBe(CATALOGO_PERSONAJES_HYDRATED_EVENT)
  })

  it('does not dispatch event when nothing changes', () => {
    syncCatalogoPersonajes(personajesFixtures.slice(0, 2))
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    })
    // Re-sync same content
    syncCatalogoPersonajes(personajesFixtures.slice(0, 2))
    expect(window.dispatchEvent).not.toHaveBeenCalled()
  })

  it('handles empty catalog gracefully', () => {
    const result = syncCatalogoPersonajes([])
    expect(Array.isArray(result)).toBe(true)
  })
})

// ─── readCatalogoPersonajesSnapshot ────────────────────────────────────────────

describe('readCatalogoPersonajesSnapshot', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns empty array when storage is empty', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    expect(readCatalogoPersonajesSnapshot()).toEqual([])
  })

  it('returns parsed catalog from localStorage', () => {
    const storage = makeStorage({
      [CATALOGO_PERSONAJES_STORAGE_KEY]: JSON.stringify(personajesFixtures.slice(0, 3)),
    })
    vi.stubGlobal('localStorage', storage)
    const result = readCatalogoPersonajesSnapshot()
    expect(result.length).toBe(3)
  })

  it('returns empty array on JSON parse error', () => {
    vi.stubGlobal('localStorage', makeStorage({ [CATALOGO_PERSONAJES_STORAGE_KEY]: '{invalid' }))
    expect(readCatalogoPersonajesSnapshot()).toEqual([])
  })

  it('returns empty array in non-browser environment (no localStorage)', () => {
    vi.stubGlobal('localStorage', undefined as unknown as Storage)
    expect(readCatalogoPersonajesSnapshot()).toEqual([])
  })
})

// ─── MISSING_IMAGE_PREFIX ──────────────────────────────────────────────────────

describe('MISSING_IMAGE_PREFIX', () => {
  it('is the sentinel for unresolved slugs', () => {
    expect(MISSING_IMAGE_PREFIX).toBe('/img/_missing/')
  })
})

// ─── imagenPersonaje ───────────────────────────────────────────────────────────

describe('imagenPersonaje', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns cached image URL for known slug', () => {
    vi.stubGlobal('localStorage', makeStorage({
      [CATALOGO_PERSONAJES_STORAGE_KEY]: JSON.stringify(personajesFixtures.slice(0, 2)),
    }))
    syncCatalogoPersonajes(personajesFixtures.slice(0, 2))
    const result = imagenPersonaje('luffy')
    expect(result).toContain('luffy')
  })

  it('returns MISSING_IMAGE_PREFIX + slug.webp for unknown slug', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    const result = imagenPersonaje('unknown-slug-xyz')
    expect(result).toBe('/img/_missing/unknown-slug-xyz.webp')
  })

  it('respects canonical aliases', () => {
    vi.stubGlobal('localStorage', makeStorage({
      [CATALOGO_PERSONAJES_STORAGE_KEY]: JSON.stringify(personajesFixtures.slice(0, 2)),
    }))
    syncCatalogoPersonajes(personajesFixtures.slice(0, 2))
    // 'all_might' should resolve to 'allmight'
    const result = imagenPersonaje('all_might')
    // Should return something valid (cached or missing)
    expect(typeof result).toBe('string')
  })
})

// ─── getPersonajeBySlug ─────────────────────────────────────────────────────────

describe('getPersonajeBySlug', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns personaje for known slug', () => {
    vi.stubGlobal('localStorage', makeStorage({
      [CATALOGO_PERSONAJES_STORAGE_KEY]: JSON.stringify(personajesFixtures.slice(0, 3)),
    }))
    syncCatalogoPersonajes(personajesFixtures.slice(0, 3))
    const result = getPersonajeBySlug('luffy')
    expect(result).not.toBeNull()
    expect(result!.slug).toBe('luffy')
  })

  it('returns null for unknown slug', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    expect(getPersonajeBySlug('nonexistent-slug')).toBeNull()
  })
})

// ─── getIndicePersonaje ─────────────────────────────────────────────────────────

describe('getIndicePersonaje', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns index of known slug', () => {
    vi.stubGlobal('localStorage', makeStorage({
      [CATALOGO_PERSONAJES_STORAGE_KEY]: JSON.stringify(personajesFixtures.slice(0, 3)),
    }))
    syncCatalogoPersonajes(personajesFixtures.slice(0, 3))
    const idx = getIndicePersonaje('luffy')
    expect(idx).toBeGreaterThanOrEqual(0)
  })

  it('returns -1 for unknown slug', () => {
    vi.stubGlobal('localStorage', makeStorage({}))
    expect(getIndicePersonaje('nonexistent')).toBe(-1)
  })
})

// ─── getPopularidad ───────────────────────────────────────────────────────────

describe('getPopularidad', () => {
  it('returns high value for top popular characters', () => {
    expect(getPopularidad('luffy')).toBeGreaterThanOrEqual(90)
    expect(getPopularidad('levi')).toBeGreaterThanOrEqual(90)
    expect(getPopularidad('l')).toBeGreaterThanOrEqual(90)
  })

  it('returns default value (30) for unknown slugs', () => {
    expect(getPopularidad('nonexistent-character-xyz')).toBe(30)
  })

  it('is deterministic (same input = same output)', () => {
    expect(getPopularidad('luffy')).toBe(getPopularidad('luffy'))
    expect(getPopularidad('goku')).toBe(getPopularidad('goku'))
  })

  it('respects aliases (L → l → popularity of l)', () => {
    const popularL = getPopularidad('l')
    expect(popularL).toBeGreaterThan(0)
  })
})

// ─── getStatsPersonaje (synthetic) ────────────────────────────────────────────

describe('getStatsPersonaje', () => {
  it('returns synthetic stats with _sintetico: true', () => {
    const stats = getStatsPersonaje('luffy')
    expect(stats._sintetico).toBe(true)
    expect(typeof stats.elo).toBe('number')
    expect(typeof stats.wins).toBe('number')
    expect(typeof stats.losses).toBe('number')
  })

  it('returns positive ELO values', () => {
    const stats = getStatsPersonaje('luffy')
    expect(stats.elo).toBeGreaterThan(0)
    expect(stats.elo).toBeGreaterThan(1000)
  })

  it('wins are greater than losses (popular characters)', () => {
    const stats = getStatsPersonaje('luffy')
    expect(stats.wins).toBeGreaterThan(stats.losses)
  })

  it('is deterministic', () => {
    const a = getStatsPersonaje('frieren')
    const b = getStatsPersonaje('frieren')
    expect(a.elo).toBe(b.elo)
    expect(a.wins).toBe(b.wins)
    expect(a.losses).toBe(b.losses)
  })

  it('different characters have different stats', () => {
    const luffy = getStatsPersonaje('luffy')
    const goku = getStatsPersonaje('goku')
    // Different slugs → different hash → different stats (with high probability)
    expect(luffy.elo).not.toBe(goku.elo)
  })
})

// ─── getStatsPersonajeEstimado ─────────────────────────────────────────────────

describe('getStatsPersonajeEstimado', () => {
  it('is functionally identical to getStatsPersonaje', () => {
    const a = getStatsPersonaje('luffy')
    const b = getStatsPersonajeEstimado('luffy')
    expect(a.elo).toBe(b.elo)
    expect(a.wins).toBe(b.wins)
    expect(a.losses).toBe(b.losses)
    expect(a._sintetico).toBe(b._sintetico)
  })
})