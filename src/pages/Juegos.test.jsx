import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { JUEGOS } from '../juegos/registro.js'
import { SobresDeHoy } from './Sobres.jsx'
import Juegos from './Juegos.jsx'

describe('Juegos (hub)', () => {
  const html = renderToStaticMarkup(<Juegos />)

  it('enlaza a los diez juegos con su kanji, nombre y descripción, sin «próximamente»', () => {
    expect(html).toMatch(/<h1[^>]*>Juegos<\/h1>/)
    for (const juego of JUEGOS) {
      expect(html).toContain(`href="/juegos/${juego.slug}"`)
      expect(html).toContain(`>${juego.nombre}</span>`)
      expect(html).toContain(juego.descripcion)
      expect(html).toContain(`data-acento="${juego.acento}"`)
    }
    expect(html.match(/class="tarjeta-juego"/g)).toHaveLength(10)
    expect(html.match(/Un sobre por ronda ganada/g)).toHaveLength(7)
    expect(html.match(/Por gusto, sin sobre/g)).toHaveLength(3)
    expect(html).not.toContain('Próximamente')
    // Sin partidas no hay racha que mostrar ni balance de sobres.
    expect(html).not.toContain('Racha')
    expect(html).not.toContain('juegos-balance')
  })
})

describe('SobresDeHoy', () => {
  const pintar = (props) => renderToStaticMarkup(<SobresDeHoy {...props} />)

  it('sin extras dice lo de siempre', () => {
    expect(pintar({ delDia: 3 })).toMatch(/Te quedan <strong class="cifra">3<\/strong> de 5 sobres hoy\./)
    expect(pintar({ delDia: 0 })).toContain('Has abierto los 5 sobres de hoy.')
    expect(pintar({ delDia: 0 })).not.toContain('hoy-extra')
  })

  it('con extras añade la pastilla y «ganados en los juegos»', () => {
    const conDia = pintar({ delDia: 3, extras: 2 })
    expect(conDia).toContain('>+2<')
    expect(conDia).toMatch(/de 5 sobres hoy y <strong class="cifra">2<\/strong> ganados en los juegos\./)
    const sinDia = pintar({ delDia: 0, extras: 1 })
    expect(sinDia).toMatch(/Has abierto los 5 sobres de hoy\. Te queda <strong class="cifra">1<\/strong> ganado en los juegos\./)
  })
})
