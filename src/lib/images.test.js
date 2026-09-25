import { describe, expect, it } from 'vitest'
import { cartaEntera, imagenCarta, marcarSiCargada, imagenIntermedia, urlPublica, vigilarImagenes } from './images.js'

describe('urlPublica', () => {
  it('une la base con la ruta sin barras dobles', () => {
    expect(urlPublica('img/a.webp', '/')).toBe('/img/a.webp')
    expect(urlPublica('/img/a.webp', '/AnimeShowdown/')).toBe('/AnimeShowdown/img/a.webp')
    expect(urlPublica('img/a.webp', '/AnimeShowdown')).toBe('/AnimeShowdown/img/a.webp')
  })
})

describe('imagenCarta', () => {
  it('construye el srcset de cuatro tamaños para los personajes', () => {
    const img = imagenCarta({ img: 'img/Frieren/frieren' }, '/base/')
    expect(img.src).toBe('/base/img/Frieren/frieren-600.webp')
    expect(img.srcSet).toBe(
      '/base/img/Frieren/frieren-300.webp 300w, /base/img/Frieren/frieren-450.webp 450w, /base/img/Frieren/frieren-600.webp 600w, /base/img/Frieren/frieren.webp 1024w',
    )
    expect(img.width / img.height).toBeCloseTo(2 / 3)
  })

  it('da a la imagen la proporción real de la ilustración', () => {
    expect(imagenCarta({ img: 'img/Naruto/gaara', ar: 0.882 }, '/')).toMatchObject({ width: 600, height: 680 })
  })

  it('trata igual a las especiales', () => {
    const img = imagenCarta({ img: 'img/especiales/luffy__gear5' }, '/')
    expect(img.src).toBe('/img/especiales/luffy__gear5-600.webp')
    expect(img.srcSet).toContain('/img/especiales/luffy__gear5-300.webp 300w')
  })
})

describe('cartaEntera', () => {
  it('recorta las ilustraciones 2:3 y las un poco más anchas o más altas', () => {
    expect(cartaEntera({})).toBe(false)
    expect(cartaEntera({ ar: 0.711 })).toBe(false)
    expect(cartaEntera({ ar: 0.79 })).toBe(false)
    expect(cartaEntera({ ar: 0.62 })).toBe(false)
  })

  it('muestra enteras las muy anchas y las muy altas', () => {
    expect(cartaEntera({ ar: 0.8 })).toBe(true)
    expect(cartaEntera({ ar: 0.917 })).toBe(true)
    expect(cartaEntera({ ar: 0.563 })).toBe(true)
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

describe('marcarSiCargada e imagenIntermedia', () => {
  it('marca solo las imágenes que ya están completas', () => {
    const lista = { complete: true, naturalWidth: 300, dataset: {} }
    const pendiente = { complete: false, naturalWidth: 0, dataset: {} }
    const rota = { complete: true, naturalWidth: 0, dataset: {} }
    for (const img of [lista, pendiente, rota]) marcarSiCargada(img)
    expect(lista.dataset.cargada).toBe('')
    expect(pendiente.dataset.cargada).toBeUndefined()
    expect(rota.dataset.cargada).toBeUndefined()
    expect(() => marcarSiCargada(null)).not.toThrow()
  })

  it('apunta a la versión de 600 px', () => {
    expect(imagenIntermedia({ img: 'img/Frieren/frieren' }, '/base/')).toBe('/base/img/Frieren/frieren-600.webp')
  })
})
