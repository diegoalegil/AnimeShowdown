import { describe, expect, it } from 'vitest'
import { imagenCarta, urlPublica, vigilarImagenes } from './images.js'

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

describe('vigilarImagenes', () => {
  it('marca las imágenes cargadas y las láminas rotas con listeners de captura', () => {
    const listeners = {}
    const raiz = {
      addEventListener: (tipo, fn, captura) => (listeners[tipo] = { fn, captura }),
      removeEventListener: (tipo) => delete listeners[tipo],
    }
    const quitar = vigilarImagenes(raiz)
    expect(listeners.load.captura).toBe(true)

    const lamina = { dataset: {} }
    const img = { tagName: 'IMG', dataset: {}, closest: () => lamina }
    listeners.load.fn({ target: img })
    expect(img.dataset.cargada).toBe('')
    listeners.error.fn({ target: img })
    expect(lamina.dataset.rota).toBe('')

    const ajena = { tagName: 'IMG', dataset: {}, closest: () => null }
    listeners.load.fn({ target: ajena })
    expect(ajena.dataset.cargada).toBeUndefined()

    quitar()
    expect(listeners).toEqual({})
  })
})
