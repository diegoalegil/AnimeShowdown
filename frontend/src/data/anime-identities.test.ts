import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { GAMES } from '../features/games/hub/games-hub-config'
import { slugifyAnime } from '../lib/animes'
import { getAnimeVisual } from './anime-visual'
import {
  ANIME_IDENTITY_DEFINITIONS,
  getAnimeIdentity,
  getAnimeIdentityCoverage,
  hasCuratedAnimeIdentity,
} from './anime-identities'

type SeedCharacter = {
  anime: string
}

function seedAnimes() {
  const seed = JSON.parse(
    readFileSync(
      resolve(process.cwd(), '../backend/src/main/resources/personajes-seed.json'),
      'utf8',
    ),
  ) as SeedCharacter[]

  return [...new Set(seed.map((personaje) => personaje.anime))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((anime) => ({ anime, slug: slugifyAnime(anime) }))
}

describe('anime identity-pack', () => {
  it('cubre todos los universos del seed sin caer al fallback generico', () => {
    const animes = seedAnimes()
    const coverage = getAnimeIdentityCoverage(animes.map(({ slug }) => slug))

    expect(animes).toHaveLength(105)
    expect(ANIME_IDENTITY_DEFINITIONS).toHaveLength(105)
    expect(coverage).toEqual({ total: 105, covered: 105, missing: [] })

    for (const { anime, slug } of animes) {
      const identity = getAnimeIdentity(slug, anime)

      expect(hasCuratedAnimeIdentity(slug), anime).toBe(true)
      expect(identity.isFallback, anime).toBe(false)
      expect(identity.kanji, anime).toBeTruthy()
      expect(identity.kanji, anime).not.toBe('界')
      expect(identity.emblem, anime).toMatch(/\S/)
      expect(identity.copy, anime).toMatch(/\S/)
      expect(identity.pattern, anime).toMatch(/\S/)
      expect(identity.audioCue, anime).toMatch(/\S/)
      expect(identity.imageSlot, anime).toMatch(/^\/assets\/anime-banners\/.+\.(webp|png|jpg|jpeg|svg)$/)
      expect(identity.motifs.length, anime).toBeGreaterThanOrEqual(2)
    }
  })

  it('inyecta identidad propia en todos los visuales de anime del seed', () => {
    for (const { anime, slug } of seedAnimes()) {
      const visual = getAnimeVisual(slug, anime)

      expect(visual.identityFallback, anime).toBe(false)
      expect(visual.identity?.title, anime).toBe(anime)
      expect(visual.kanji, anime).not.toBe('界')
      expect(visual.identitySlot, anime).toMatch(/^\/assets\/anime-banners\//)
      expect(visual.expectedPath, anime).toMatch(/^\/assets\/anime-banners\//)
    }
  })

  it('mantiene el fallback generico marcado como bloqueante para slugs desconocidos', () => {
    const visual = getAnimeVisual('universo-sin-curar', 'Universo sin curar')

    expect(visual.identityFallback).toBe(true)
    expect(visual.identity?.isFallback).toBe(true)
    expect(visual.kanji).toBe('界')
  })

  it('exige contrato de identidad por modo en el hub de juegos', () => {
    for (const game of GAMES) {
      expect(game.identity?.kanji, game.titulo).toBe(game.kanji)
      expect(game.identity?.emblem, game.titulo).toMatch(/\S/)
      expect(game.identity?.copy, game.titulo).toMatch(/\S/)
      expect(game.identity?.pattern, game.titulo).toMatch(/\S/)
      expect(game.identity?.audioCue, game.titulo).toMatch(/\S/)
      expect(game.identity?.motifs.length, game.titulo).toBeGreaterThanOrEqual(2)
      expect(game.identity?.copy, game.titulo).not.toBe(game.desc)
    }
  })
})
