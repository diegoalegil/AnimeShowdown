import { describe, expect, it } from 'vitest'
import {
  ANIMES_KANJI,
  ANIMES_KANJI_ENTRIES,
  kanjiDeAnime,
  significadoKanjiDeAnime,
} from './animes-kanji'

describe('animes-kanji · significado curado', () => {
  it('cada entrada lleva glifo (1 carácter visible) y significado real en es', () => {
    for (const [anime, entry] of Object.entries(ANIMES_KANJI_ENTRIES)) {
      expect(entry.glifo, anime).toBeTruthy()
      // un único glifo de universo (no japonés de relleno multi-carácter)
      expect([...entry.glifo].length, anime).toBe(1)
      expect(entry.significado, anime).toBeTruthy()
      expect(entry.significado.length, anime).toBeGreaterThan(2)
    }
  })

  it('ANIMES_KANJI sigue siendo el mapa retro-compatible nombre → glifo (string)', () => {
    expect(ANIMES_KANJI['One Piece']).toBe('海')
    expect(typeof ANIMES_KANJI['Naruto']).toBe('string')
    expect(kanjiDeAnime('Dragon Ball')).toBe('龍')
    expect(kanjiDeAnime('Inexistente')).toBeUndefined()
  })

  it('significadoKanjiDeAnime devuelve el significado curado o undefined', () => {
    expect(significadoKanjiDeAnime('One Piece')).toMatch(/Grand Line/i)
    expect(significadoKanjiDeAnime('Inexistente')).toBeUndefined()
  })
})
