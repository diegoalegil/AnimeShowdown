import { describe, expect, it } from 'vitest'
import { archivosAnime, archivosComunes, escenaAnime, fondoAnime, LOGO, PIEZAS, pieza, simboloAnime } from './marca.js'

const frieren = { id: 'frieren', marca: 'frieren-beyond-journey-s-end' }

describe('arte de marca por anime', () => {
  it('construye el srcset del escenario con su proporción', () => {
    const escena = escenaAnime(frieren, '/base/')
    expect(escena.src).toBe('/base/img/marca/frieren-beyond-journey-s-end-escena-1280.webp')
    expect(escena.srcSet).toBe(
      '/base/img/marca/frieren-beyond-journey-s-end-escena-768.webp 768w, /base/img/marca/frieren-beyond-journey-s-end-escena-1280.webp 1280w',
    )
    expect(escena.proporcion).toBeCloseTo(16 / 9, 1)
  })

  it('lleva el foco del escenario si el anime lo anota', () => {
    expect(escenaAnime(frieren, '/').foco).toBeUndefined()
    expect(escenaAnime({ ...frieren, foco: '50% 80%' }, '/').foco).toBe('50% 80%')
  })

  it('da el fondo difuminado y el símbolo', () => {
    expect(fondoAnime(frieren, '/')).toBe('/img/marca/frieren-beyond-journey-s-end-fondo-480.webp')
    expect(simboloAnime(frieren, '/').srcSet).toContain('/img/marca/frieren-beyond-journey-s-end-simbolo-160.webp 160w')
  })

  it('devuelve null si el anime no tiene arte', () => {
    expect(escenaAnime({ id: 'x' }, '/')).toBeNull()
    expect(fondoAnime(undefined, '/')).toBeNull()
    expect(simboloAnime({ id: 'x' }, '/')).toBeNull()
  })

  it('lista los cinco archivos de cada anime', () => {
    expect(archivosAnime('naruto')).toEqual([
      'img/marca/naruto-escena-768.webp',
      'img/marca/naruto-escena-1280.webp',
      'img/marca/naruto-fondo-480.webp',
      'img/marca/naruto-simbolo-160.webp',
      'img/marca/naruto-simbolo-320.webp',
    ])
  })
})

describe('piezas y logo', () => {
  it('construye el srcset de una pieza', () => {
    const hero = pieza('personajes-archive', '/')
    expect(hero.src).toBe('/img/marca/personajes-archive-1672.webp')
    expect(hero.srcSet.split(', ')).toHaveLength(3)
  })

  it('las piezas recortadas no se amplían y guardan la proporción del recorte', () => {
    for (const { recorte, anchos, proporcion } of Object.values(PIEZAS).filter((p) => p.recorte)) {
      expect(Math.max(...anchos)).toBeLessThanOrEqual(recorte[2])
      expect(proporcion).toBeCloseTo(recorte[2] / recorte[3], 5)
    }
    expect(pieza('sobres-arena', '/').src).toBe('/img/marca/sobres-arena-1070.webp')
  })

  it('rechaza piezas desconocidas', () => {
    expect(() => pieza('nada', '/')).toThrow(/desconocida/)
  })

  it('incluye el logo entre los archivos comunes', () => {
    expect(archivosComunes()).toEqual(expect.arrayContaining([LOGO.webp, LOGO.svg]))
  })
})
