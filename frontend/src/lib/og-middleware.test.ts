import { describe, it, expect } from 'vitest'
// El middleware OG corre en CADA request en el edge de Cloudflare. Aquí
// testeamos solo la función pura de routing (sin HTMLRewriter ni red).
import { ogParaRuta, esHostDePreview } from '../../functions/_middleware.js'

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

  it('mapea perfil de usuario /u/{username} a la OG de usuario', () => {
    const r = og('/u/diego')
    expect(r?.image).toBe(`${API}/api/og/usuario/diego.png`)
    expect(r?.title).toBe('diego · AnimeShowdown')
    expect(r?.description).toMatch(/síguele/i)
  })

  it('mapea /u/{username}/logros a la misma OG de usuario', () => {
    const r = og('/u/diego/logros')
    expect(r?.image).toBe(`${API}/api/og/usuario/diego.png`)
    expect(r?.title).toBe('diego · AnimeShowdown')
  })

  it('no hijackea subrutas desconocidas de /u/{username}', () => {
    expect(og('/u/diego/otra-cosa')).toBeNull()
  })

  it('mapea tier list pública a la OG de tier list', () => {
    const r = og('/tier-lists/best-naruto')
    expect(r?.image).toBe(`${API}/api/og/tier-list/best-naruto.png`)
    expect(r?.title).toBe('Best Naruto · AnimeShowdown')
  })

  it('devuelve null para rutas no mapeadas', () => {
    expect(og('/apoya')).toBeNull()
    expect(og('/')).toBeNull()
  })
})

describe('esHostDePreview (CSP edge)', () => {
  it('los hosts de producción NO son preview', () => {
    expect(esHostDePreview('animeshowdown.dev')).toBe(false)
    expect(esHostDePreview('www.animeshowdown.dev')).toBe(false)
  })

  it('el FQDN con punto final del host de prod NO cuela como preview', () => {
    // Regresión: animeshowdown.dev. (punto final) burlaba el match de prod y
    // metía el origen Railway de preview en la CSP de producción.
    expect(esHostDePreview('animeshowdown.dev.')).toBe(false)
    expect(esHostDePreview('ANIMESHOWDOWN.DEV')).toBe(false)
  })

  it('solo los previews de Cloudflare Pages (*.pages.dev) y localhost amplían la CSP', () => {
    expect(esHostDePreview('abc123.animeshowdown.pages.dev')).toBe(true)
    expect(esHostDePreview('localhost')).toBe(true)
  })

  it('un host desconocido/falsificado NO amplía la CSP (fail-closed)', () => {
    expect(esHostDePreview('evil.example.com')).toBe(false)
    expect(esHostDePreview('animeshowdown.dev.evil.com')).toBe(false)
  })
})
