import { describe, it, expect } from 'vitest'
import { queryClient, queryKeys } from './queryClient'

// ─── queryClient defaults ──────────────────────────────────────────────────────

describe('queryClient — default configuration', () => {
  it('staleTime is 5 minutes', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000)
  })

  it('gcTime is 10 minutes', () => {
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(10 * 60 * 1000)
  })

  it('retry is 1 for queries', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(1)
  })

  it('refetchOnWindowFocus is false', () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false)
  })

  it('retry is 0 for mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0)
  })
})

// ─── queryKeys factories ───────────────────────────────────────────────────────────

describe('queryKeys — tournament keys', () => {
  it('torneos returns flat resource key', () => {
    expect(queryKeys.torneos()).toEqual(['torneos'])
  })

  it('torneoBySlug includes slug', () => {
    expect(queryKeys.torneoBySlug('my-tournament')).toEqual(['torneos', 'slug', 'my-tournament'])
  })

  it('torneoBySlug handles undefined slug', () => {
    expect(queryKeys.torneoBySlug(undefined)).toEqual(['torneos', 'slug', undefined])
  })

  it('torneoById includes id', () => {
    expect(queryKeys.torneoById('123')).toEqual(['torneos', 'id', '123'])
  })

  it('torneoById accepts numeric id', () => {
    expect(queryKeys.torneoById(456)).toEqual(['torneos', 'id', 456])
  })
})

describe('queryKeys — favorito keys', () => {
  it('misFavoritos returns flat resource key', () => {
    expect(queryKeys.misFavoritos()).toEqual(['favoritos', 'me'])
  })

  it('favoritoSlug includes slug', () => {
    expect(queryKeys.favoritoSlug('naruto')).toEqual(['favoritos', 'slug', 'naruto'])
  })
})

describe('queryKeys — vote period keys', () => {
  it('votosPeriodoSlug includes slug and default days', () => {
    expect(queryKeys.votosPeriodoSlug('luffy')).toEqual(['votos-periodo', 'slug', 'luffy', 7])
  })

  it('votosPeriodoSlug accepts custom days', () => {
    expect(queryKeys.votosPeriodoSlug('goku', 30)).toEqual(['votos-periodo', 'slug', 'goku', 30])
  })

  it('votosPeriodoBatch sorts slugs alphabetically and comma-joins them', () => {
    const result = queryKeys.votosPeriodoBatch(['b', 'a', 'c'])
    expect(result).toEqual(['votos-periodo', 'batch', 'a,b,c', 7])
  })

  it('votosPeriodoBatch sorts independent of input order', () => {
    expect(queryKeys.votosPeriodoBatch(['z', 'm', 'a'])).toEqual(['votos-periodo', 'batch', 'a,m,z', 7])
  })

  it('votosPeriodoBatch accepts custom days', () => {
    expect(queryKeys.votosPeriodoBatch(['x', 'y'], 14)).toEqual(['votos-periodo', 'batch', 'x,y', 14])
  })

  it('votosPeriodoBatch filters out falsy values from slug array', () => {
    const result = queryKeys.votosPeriodoBatch([null, 'a', undefined, 0, 'b'])
    expect(result).toEqual(['votos-periodo', 'batch', 'a,b', 7])
  })

  it('votosPeriodoBatch handles all-falsy array', () => {
    const result = queryKeys.votosPeriodoBatch([null, undefined, 0, false])
    expect(result).toEqual(['votos-periodo', 'batch', '', 7])
  })

  it('votosPeriodoBatch defaults to empty array when called with no args', () => {
    const result = queryKeys.votosPeriodoBatch()
    expect(result).toEqual(['votos-periodo', 'batch', '', 7])
  })

  it('votosPeriodoBatch stringifies numeric slug values', () => {
    const result = queryKeys.votosPeriodoBatch([1, 2, 3])
    expect(result).toEqual(['votos-periodo', 'batch', '1,2,3', 7])
  })

  it('votosPeriodoBatch handles non-array input (normalizeSlugs falls back to empty)', () => {
    // @ts-expect-error intentional bad input to exercise normalizeSlugs fallback
    const result = queryKeys.votosPeriodoBatch('not-an-array')
    expect(result).toEqual(['votos-periodo', 'batch', '', 7])
  })
})
