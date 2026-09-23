import { describe, expect, it } from 'vitest'
import { destinoDeClic, rutaInterna } from './navegacion.js'

describe('rutaInterna', () => {
  it('quita la base y rechaza lo que queda fuera', () => {
    expect(rutaInterna('/carta/frieren', '/')).toBe('/carta/frieren')
    expect(rutaInterna('/AnimeShowdown/carta/frieren', '/AnimeShowdown/')).toBe('/carta/frieren')
    expect(rutaInterna('/AnimeShowdown/', '/AnimeShowdown/')).toBe('/')
    expect(rutaInterna('/AnimeShowdown', '/AnimeShowdown/')).toBe('/')
    expect(rutaInterna('/otro/carta', '/AnimeShowdown/')).toBeNull()
  })
})

describe('destinoDeClic', () => {
  const actual = new URL('https://ejemplo.dev/AnimeShowdown/sobres')
  const base = '/AnimeShowdown/'
  const enlace = (href, atributos = {}) => ({
    href: new URL(href, actual).href,
    target: atributos.target ?? '',
    hasAttribute: (n) => n in atributos,
    querySelector: () => null,
  })
  const clic = (a, extra = {}) => ({ button: 0, target: { closest: () => a }, ...extra })

  it('resuelve dentro de la SPA los enlaces internos', () => {
    expect(destinoDeClic(clic(enlace('/AnimeShowdown/carta/frieren')), { base, actual })?.destino).toBe('/carta/frieren')
    expect(destinoDeClic(clic(enlace('/AnimeShowdown/?q=luffy')), { base, actual })?.destino).toBe('/?q=luffy')
  })

  it('deja al navegador los clics modificados, externos, descargas y anclas', () => {
    const interno = enlace('/AnimeShowdown/coleccion')
    expect(destinoDeClic(clic(interno, { metaKey: true }), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(interno, { button: 1 }), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(interno, { defaultPrevented: true }), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(enlace('https://otro.dev/AnimeShowdown/')), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(enlace('/AnimeShowdown/x.json', { download: '' })), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(enlace('/AnimeShowdown/', { target: '_blank' })), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(enlace('#contenido')), { base, actual })).toBeNull()
    expect(destinoDeClic(clic(enlace('/fuera/')), { base, actual })).toBeNull()
    expect(destinoDeClic({ button: 0, target: { closest: () => null } }, { base, actual })).toBeNull()
  })
})
