import { describe, expect, it } from 'vitest'
import { descripcionCarta, nombreCarta, tituloDePagina } from './titulos.js'

describe('titulos', () => {
  it('compone el título con la marca', () => {
    expect(tituloDePagina()).toBe('AnimeShowdown')
    expect(tituloDePagina('Sobres')).toBe('Sobres · AnimeShowdown')
  })

  it('nombra las variantes y describe la carta', () => {
    const luffy = { id: 'e-luffy__gear5', nombre: 'Monkey D. Luffy', variante: 'Gear 5', anime: 'One Piece' }
    expect(nombreCarta(luffy)).toBe('Monkey D. Luffy (Gear 5)')
    expect(descripcionCarta(luffy)).toMatch(/^Carta especial de Monkey D\. Luffy \(Gear 5\), de One Piece\. /)
    const akame = { id: 'akame', nombre: 'Akame', anime: 'Akame ga Kill!', desc: 'Asesina de Night Raid.' }
    expect(descripcionCarta(akame)).toBe('Carta de Akame, de Akame ga Kill!. Asesina de Night Raid.')
  })
})
