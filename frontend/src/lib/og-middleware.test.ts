import { describe, it, expect } from 'vitest'
// El middleware OG corre en CADA request en el edge de Cloudflare. Aquí
// testeamos solo la función pura de routing (sin HTMLRewriter ni red).
import { ogParaRuta } from '../../functions/_middleware.js'

const API = 'https://api.animeshowdown.dev'
const og = (path: string) => ogParaRuta(new URL(path, 'https://animeshowdown.dev'), API)

describe('ogParaRuta', () => {
  it('mapea ficha de personaje', () => {
    const r = og('/personajes/monkey-d-luffy')
    expect(r?.image).toBe(`${API}/api/og/personaje/monkey-d-luffy.png`)
    expect(r?.title).toContain('Monkey D Luffy')
  })

  it('mapea landing de duelo /duelos/A-vs-B a la OG de duelo', () => {
    const r = og('/duelos/luffy-vs-zoro')
    expect(r?.image).toBe(`${API}/api/og/duelo/luffy/vs/zoro.png`)
    expect(r?.title).toBe('Luffy vs Zoro · AnimeShowdown')
  })

  it('separa el par por el último -vs- cuando los slugs llevan guiones', () => {
    const r = og('/duelos/monkey-d-luffy-vs-roronoa-zoro')
    expect(r?.image).toBe(`${API}/api/og/duelo/monkey-d-luffy/vs/roronoa-zoro.png`)
  })

  it('reto directo /votar?personaje=A&rival=B usa la OG de duelo con copy de reto', () => {
    const r = og('/votar?personaje=luffy&rival=zoro')
    expect(r?.image).toBe(`${API}/api/og/duelo/luffy/vs/zoro.png`)
    expect(r?.description).toMatch(/te reto/i)
  })

  it('reto de un solo personaje /votar?personaje=A usa la OG de personaje', () => {
    const r = og('/votar?personaje=luffy')
    expect(r?.image).toBe(`${API}/api/og/personaje/luffy.png`)
    expect(r?.title).toMatch(/reto a luffy/i)
  })

  it('reto por anime /votar?anime=X usa la OG de anime', () => {
    const r = og('/votar?anime=One%20Piece')
    expect(r?.image).toBe(`${API}/api/og/anime/One%20Piece.png`)
  })

  it('no mapea /votar sin params (OG genérico)', () => {
    expect(og('/votar')).toBeNull()
  })

  it('un rival igual al personaje cae al reto de un solo personaje', () => {
    const r = og('/votar?personaje=luffy&rival=luffy')
    expect(r?.image).toBe(`${API}/api/og/personaje/luffy.png`)
  })

  it('no mapea /duelos/A-vs-A contra uno mismo', () => {
    expect(og('/duelos/luffy-vs-luffy')).toBeNull()
  })

  it('mapea ranking global y mi-ranking a la OG de ranking', () => {
    expect(og('/ranking')?.image).toBe(`${API}/api/og/ranking.png`)
    expect(og('/mi-ranking')?.image).toBe(`${API}/api/og/ranking.png`)
  })

  it('mapea /ranking con barra final igual que las rutas hermanas', () => {
    expect(og('/ranking/')?.image).toBe(`${API}/api/og/ranking.png`)
  })

  it('devuelve null para rutas no mapeadas', () => {
    expect(og('/apoya')).toBeNull()
    expect(og('/')).toBeNull()
  })
})
