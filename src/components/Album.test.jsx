import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { frenada, valorContado } from '../lib/useContar.js'
import { Hoja } from './Album.jsx'

const carta = (id, n, extra = {}) => ({ id, n, nombre: id, anime: 'Chainsaw Man', animeId: 'csm', img: `img/csm/${id}`, ...extra })
const HOJA = {
  id: 'csm',
  titulo: 'Chainsaw Man',
  nativo: 'チェンソーマン',
  orden: 7,
  especiales: false,
  cartas: [carta('denji', 12, { nativo: 'デンジ' }), carta('makima', 13), carta('power', 14)],
}

describe('Hoja del álbum', () => {
  it('cada carta tiene su hueco numerado; las que se tienen lo ocupan y enlazan a su ficha', () => {
    const html = renderToStaticMarkup(<Hoja hoja={HOJA} tengo={{ makima: 2 }} />)
    expect(html.match(/class="bolsillo"/g)).toHaveLength(3)
    expect(html.match(/data-lleno=""/g)).toHaveLength(1)
    expect(html).toContain('href="/carta/makima"')
    expect(html).not.toContain('href="/carta/denji"')
    // Los huecos vacíos muestran su número y el nombre original en vertical, sin siluetas.
    expect(html).toContain('>0012<')
    expect(html).toContain('>デンジ<')
    expect(html).toContain('aún no la tienes')
    expect(html).not.toMatch(/blur/)
    // Cuenta de la serie y número de hoja.
    expect(html).toMatch(/hoja-cuenta-n">1<.*\/3/)
    expect(html).toContain('>07<')
    expect(html).toContain('--p:0.3333')
  })

  it('la serie completa lleva el sello 完 y la línea en bermellón', () => {
    const html = renderToStaticMarkup(<Hoja hoja={HOJA} tengo={{ denji: 1, makima: 1, power: 1 }} />)
    expect(html).toContain('data-completa="true"')
    expect(html).toContain('>完<')
    expect(html).toContain('aria-label="Serie completa"')
  })

  it('reserva su altura por filas mientras no se pinta', () => {
    const html = renderToStaticMarkup(<Hoja hoja={HOJA} tengo={{}} />)
    expect(html).toContain('data-diferido=""')
    expect(html).toContain('--filas-3:1;--filas-5:1;--filas-6:1')
  })
})

describe('cuenta ascendente', () => {
  it('empieza en 0, frena al final y termina exactamente en el valor', () => {
    expect(valorContado(0, 405, 1000)).toBe(0)
    expect(valorContado(500, 405, 1000)).toBe(Math.round(frenada(0.5) * 405))
    expect(valorContado(500, 405, 1000)).toBeGreaterThan(405 / 2)
    expect(valorContado(1000, 405, 1000)).toBe(405)
    expect(valorContado(5000, 405, 1000)).toBe(405)
  })
})
