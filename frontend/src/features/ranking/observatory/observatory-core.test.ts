import { describe, expect, it } from 'vitest'
import {
  agruparConstelaciones,
  azarSlug,
  enlazarConstelacion,
  haySerieTemporal,
  moversEntre,
  numeroDias,
  posicionesDelDia,
  proyectarCielo,
  tamanoEstrella,
  LIENZO,
} from './observatory-core'

const RANKING = [
  { slug: 'goku', nombre: 'Goku', anime: 'Dragon Ball', elo: 2900, posicion: 1 },
  { slug: 'naruto', nombre: 'Naruto', anime: 'Naruto', elo: 2800, posicion: 2 },
  { slug: 'vegeta', nombre: 'Vegeta', anime: 'Dragon Ball', elo: 2700, posicion: 3 },
  { slug: 'luffy', nombre: 'Luffy', anime: 'One Piece', elo: 2600, posicion: 4 },
  { slug: 'sasuke', nombre: 'Sasuke', anime: 'Naruto', elo: 2500, posicion: 5 },
]

// día 0 = más antiguo … día 6 = hoy
const MOVIMIENTOS = [
  { slug: 'goku', posicionesPorDia: [2, 2, 1, 1, 1, 1, 1] },
  { slug: 'vegeta', posicionesPorDia: [1, 1, 3, 3, 3, 3, 3] },
  { slug: 'naruto', posicionesPorDia: [1, 1, 2, 2, 2, 2, 2] },
  { slug: 'luffy', posicionesPorDia: [5, 5, 4, 4, 4, 4, 4] },
  { slug: 'sasuke', posicionesPorDia: [4, 4, 5, 5, 5, 5, 5] },
]

describe('hash y azar deterministas', () => {
  it('azarSlug es estable y vive en [0,1)', () => {
    const a = azarSlug('goku', 3)
    expect(a).toBe(azarSlug('goku', 3))
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
    expect(azarSlug('goku', 3)).not.toBe(azarSlug('goku', 7))
  })
})

describe('tamanoEstrella', () => {
  it('crece monótona con el ELO y respeta los límites', () => {
    expect(tamanoEstrella(2500, 2500, 2900)).toBeCloseTo(LIENZO.estrellaMin, 5)
    expect(tamanoEstrella(2900, 2500, 2900)).toBeCloseTo(LIENZO.estrellaMax, 5)
    const medio = tamanoEstrella(2700, 2500, 2900)
    expect(medio).toBeGreaterThan(LIENZO.estrellaMin)
    expect(medio).toBeLessThan(LIENZO.estrellaMax)
  })
  it('clampa fuera de rango y tolera rango degenerado', () => {
    expect(tamanoEstrella(9999, 2500, 2900)).toBeCloseTo(LIENZO.estrellaMax, 5)
    expect(tamanoEstrella(0, 2500, 2900)).toBeCloseTo(LIENZO.estrellaMin, 5)
    expect(tamanoEstrella(2700, 2700, 2700)).toBe((LIENZO.estrellaMin + LIENZO.estrellaMax) / 2)
  })
})

describe('agruparConstelaciones', () => {
  it('agrupa por anime y ordena por mejor posición (estable)', () => {
    const grupos = agruparConstelaciones(RANKING)
    expect(grupos.map((g) => g.anime)).toEqual(['Dragon Ball', 'Naruto', 'One Piece'])
    expect(grupos[0].miembros.map((m) => m.slug)).toEqual(['goku', 'vegeta'])
    expect(grupos[0].mejorPosicion).toBe(1)
  })
})

describe('proyectarCielo', () => {
  it('es 100% determinista (mismo input ⇒ mismo cielo)', () => {
    const a = proyectarCielo(RANKING)
    const b = proyectarCielo(RANKING)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('proyecta todas las entradas, sin pérdidas ni duplicados', () => {
    const { estrellas } = proyectarCielo(RANKING)
    expect(estrellas).toHaveLength(RANKING.length)
    expect(new Set(estrellas.map((e) => e.slug)).size).toBe(RANKING.length)
  })

  it('ordena las estrellas por posición de ranking (orden de foco a11y)', () => {
    const { estrellas } = proyectarCielo(RANKING)
    expect(estrellas.map((e) => e.posicion)).toEqual([1, 2, 3, 4, 5])
  })

  it('coloca el núcleo de cada constelación (rango 0) en su centro exacto', () => {
    const { estrellas } = proyectarCielo(RANKING)
    for (const e of estrellas) {
      if (e.rangoEnAnime === 0) {
        expect(e.x).toBeCloseTo(e.cx, 9)
        expect(e.y).toBeCloseTo(e.cy, 9)
      }
    }
  })

  it('da el tamaño máximo a la estrella de mayor ELO', () => {
    const { estrellas } = proyectarCielo(RANKING)
    const goku = estrellas.find((e) => e.slug === 'goku')!
    expect(goku.tam).toBeCloseTo(LIENZO.estrellaMax, 5)
  })

  it('genera segmentos = miembros − 1 por constelación', () => {
    const { constelaciones } = proyectarCielo(RANKING)
    const db = constelaciones.find((c) => c.anime === 'Dragon Ball')!
    expect(db.segmentos).toHaveLength(db.slugs.length - 1)
  })

  it('ranking vacío ⇒ cielo vacío', () => {
    expect(proyectarCielo([])).toEqual({ estrellas: [], constelaciones: [], ancho: 0, alto: LIENZO.alto })
  })
})

describe('enlazarConstelacion', () => {
  it('encadena n miembros en n−1 segmentos consecutivos', () => {
    const seg = enlazarConstelacion([
      { x: 0, y: 0, slug: 'a' },
      { x: 1, y: 1, slug: 'b' },
      { x: 2, y: 2, slug: 'c' },
    ] as never)
    expect(seg).toHaveLength(2)
    expect(seg[0]).toMatchObject({ desde: 'a', hasta: 'b' })
    expect(seg[1]).toMatchObject({ desde: 'b', hasta: 'c' })
  })
})

describe('escrutador de mareas', () => {
  it('detecta serie temporal y cuenta días', () => {
    expect(haySerieTemporal(MOVIMIENTOS)).toBe(true)
    expect(haySerieTemporal([{ slug: 'x', posicionesPorDia: [1] }])).toBe(false)
    expect(haySerieTemporal([])).toBe(false)
    expect(numeroDias(MOVIMIENTOS)).toBe(7)
  })

  it('posicionesDelDia es determinista', () => {
    const cielo = proyectarCielo(RANKING)
    const a = posicionesDelDia(cielo, MOVIMIENTOS, 0)
    const b = posicionesDelDia(cielo, MOVIMIENTOS, 0)
    expect([...a.entries()]).toEqual([...b.entries()])
  })

  it('el día más antiguo lleva al núcleo a quien era mejor entonces', () => {
    const cielo = proyectarCielo(RANKING)
    const db = cielo.constelaciones.find((c) => c.anime === 'Dragon Ball')!
    // día 0: vegeta era 1º y goku 2º ⇒ vegeta deriva al centro.
    const dia0 = posicionesDelDia(cielo, MOVIMIENTOS, 0)
    expect(dia0.get('vegeta')!.x).toBeCloseTo(db.cx, 9)
    expect(dia0.get('vegeta')!.y).toBeCloseTo(db.cy, 9)
    // hoy (día 6): goku vuelve a ser el núcleo.
    const hoy = posicionesDelDia(cielo, MOVIMIENTOS, 6)
    expect(hoy.get('goku')!.x).toBeCloseTo(db.cx, 9)
    expect(hoy.get('goku')!.y).toBeCloseTo(db.cy, 9)
  })

  it('moversEntre ordena por magnitud y calcula delta con signo', () => {
    // entre día 0 y día 6: goku 2→1 (delta +1 sube), luffy 5→4 (+1), vegeta 1→3 (−2 baja)
    const movers = moversEntre(MOVIMIENTOS, 0, 6)
    expect(movers[0].slug).toBe('vegeta')
    expect(movers[0].delta).toBe(-2)
    const goku = movers.find((m) => m.slug === 'goku')!
    expect(goku.delta).toBe(1)
    // sin cambios no aparece
    expect(moversEntre([{ slug: 'z', posicionesPorDia: [3, 3, 3] }], 0, 2)).toEqual([])
  })
})
