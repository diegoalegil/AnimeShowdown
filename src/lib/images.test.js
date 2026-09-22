import { describe, expect, it } from 'vitest'
import { imagenCarta, urlPublica } from './images.js'

describe('urlPublica', () => {
  it('une la base con la ruta sin barras dobles', () => {
    expect(urlPublica('img/a.webp', '/')).toBe('/img/a.webp')
    expect(urlPublica('/img/a.webp', '/AnimeShowdown/')).toBe('/AnimeShowdown/img/a.webp')
    expect(urlPublica('img/a.webp', '/AnimeShowdown')).toBe('/AnimeShowdown/img/a.webp')
  })
})

describe('imagenCarta', () => {
  it('construye el srcset de tres tamaños para los personajes', () => {
    const img = imagenCarta({ img: 'img/Frieren/frieren' }, '/base/')
    expect(img.src).toBe('/base/img/Frieren/frieren-600.webp')
    expect(img.srcSet).toBe(
      '/base/img/Frieren/frieren-300.webp 300w, /base/img/Frieren/frieren-600.webp 600w, /base/img/Frieren/frieren.webp 1024w',
    )
    expect(img.width / img.height).toBeCloseTo(2 / 3)
  })

  it('usa el archivo único de las especiales', () => {
    const img = imagenCarta({ img: 'img/especiales/luffy__gear5.webp' }, '/')
    expect(img).toEqual({ src: '/img/especiales/luffy__gear5.webp', srcSet: undefined, width: 1024, height: 1536 })
  })
})
