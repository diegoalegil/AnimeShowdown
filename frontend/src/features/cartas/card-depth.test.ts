import { describe, expect, it } from 'vitest'
import { buildDepthCardProps } from './card-depth'

// 'ai_hoshino' está en data/cut-slugs.js (tiene recorte real).
const especialConRecorte = {
  rareza: 'ESPECIAL',
  personajeSlug: 'ai_hoshino',
  personajeNombre: 'Ai Hoshino',
  anime: 'Oshi no Ko',
  arteUrl: '/art/ai.webp',
}

describe('buildDepthCardProps', () => {
  it('null si la carta no es ESPECIAL', () => {
    expect(buildDepthCardProps({ ...especialConRecorte, rareza: 'RARA' })).toBeNull()
  })

  it('null si el personaje no tiene recorte', () => {
    expect(
      buildDepthCardProps({ rareza: 'ESPECIAL', personajeSlug: '__no_existe__', anime: 'X' }),
    ).toBeNull()
  })

  it('null para carta vacía', () => {
    expect(buildDepthCardProps(null)).toBeNull()
    expect(buildDepthCardProps(undefined)).toBeNull()
  })

  it('especial con recorte → props de DepthCard (cutout + bg + nombre + kanji)', () => {
    const p = buildDepthCardProps(especialConRecorte)
    expect(p).not.toBeNull()
    expect(p!.cutoutSrc).toContain('ai_hoshino')
    expect(p!.bgSrc).toBe('/art/ai.webp')
    expect(p!.name).toBe('Ai Hoshino')
    expect(p!.anime).toBe('Oshi no Ko')
    expect(typeof p!.kanji).toBe('string')
    expect(p!.kanji.length).toBeGreaterThan(0)
  })

  it('sin arteUrl cae a una imagen de fondo del catálogo', () => {
    const p = buildDepthCardProps({ ...especialConRecorte, arteUrl: undefined })
    expect(p!.bgSrc).toBeTruthy()
  })
})
