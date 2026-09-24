import { describe, expect, it } from 'vitest'
import animes from '../data/animes.json'
import { archivosAnime, archivosComunes, escenaAnime, fondoAnime, LOGO, pieza, simboloAnime } from './marca.js'

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

  it('todos los animes del catálogo tienen marca propia', () => {
    const marcas = animes.map((a) => a.marca)
    expect(marcas.every(Boolean)).toBe(true)
    expect(new Set(marcas).size).toBe(animes.length)
  })
})

describe('piezas y logo', () => {
  it('construye el srcset de una pieza', () => {
    const hero = pieza('personajes-archive', '/')
    expect(hero.src).toBe('/img/marca/personajes-archive-1672.webp')
    expect(hero.srcSet.split(', ')).toHaveLength(3)
  })

  it('rechaza piezas desconocidas', () => {
    expect(() => pieza('nada', '/')).toThrow(/desconocida/)
  })

  it('incluye el logo entre los archivos comunes', () => {
    expect(archivosComunes()).toEqual(expect.arrayContaining([LOGO.webp, LOGO.svg]))
  })
})
