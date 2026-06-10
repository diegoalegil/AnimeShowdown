import { describe, expect, it } from 'vitest'
import {
  animeBrandAssets,
  brandAssetUrl,
  brandImage,
  gameBrandAssets,
} from './brand-assets'

describe('brand-assets', () => {
  it('resuelve la URL del original y de una variante existente', () => {
    expect(brandAssetUrl('attack-on-titan-scene-01'))
      .toBe('https://assets.animeshowdown.dev/img/brand/attack-on-titan-scene-01.webp')
    expect(brandAssetUrl('attack-on-titan-scene-01', 768))
      .toBe('https://assets.animeshowdown.dev/img/brand/attack-on-titan-scene-01-768.webp')
  })

  it('devuelve null para assets o variantes inexistentes', () => {
    expect(brandAssetUrl('no-existe')).toBeNull()
    expect(brandImage('no-existe')).toBeNull()
    expect(animeBrandAssets('anime-inventado')).toBeNull()
  })

  it('arma el srcSet responsivo con las variantes del manifest', () => {
    const img = brandImage('naruto-scene-01')
    expect(img).not.toBeNull()
    expect(img?.srcSet).toContain('naruto-scene-01-480.webp 480w')
    expect(img?.srcSet).toContain('naruto-scene-01-1280.webp 1280w')
  })

  it('el trío de un anime canónico trae scene, prop y symbol', () => {
    const trio = animeBrandAssets('frieren-beyond-journey-s-end')
    expect(trio?.scene).not.toBeNull()
    expect(trio?.prop).not.toBeNull()
    expect(trio?.symbol).not.toBeNull()
  })

  it('los 8 juegos tienen cover, background y result-card', () => {
    for (const key of ['anigrid', 'anime-reveal', 'elo-duel', 'impostor-trial', 'nexo-anime', 'omikuji', 'oraculo', 'shadow-guess']) {
      const game = gameBrandAssets(key)
      expect(game?.cover, key).not.toBeNull()
      expect(game?.background, key).not.toBeNull()
      expect(game?.resultCard, key).not.toBeNull()
    }
  })
})
