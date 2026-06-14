import { describe, expect, it } from 'vitest'

import {
  claveVoto,
  colorGota,
  coalescerGuardia,
  construirMareaHoraria,
  construirTerritorios,
  fechaRelativa,
  votosNuevos,
} from './command-core'

const voto = (slug: string, anime: string, fecha: string, username: string | null = null) => ({
  ganador: { slug, nombre: slug, anime },
  rival: { nombre: 'rival' },
  username,
  fecha,
})

const catalogo = [
  { anime: 'One Piece', slug: 'one-piece', personajes: [1, 2, 3, 4] },
  { anime: 'Naruto', slug: 'naruto', personajes: [1, 2, 3] },
  { anime: 'Bleach', slug: 'bleach', personajes: [1, 2] },
]

describe('command-core', () => {
  it('claveVoto es estable y distingue por fecha/slug/username', () => {
    expect(claveVoto(voto('luffy', 'One Piece', '2026-06-14T10:00:00Z', 'ana'))).toBe(
      '2026-06-14T10:00:00Z|luffy|ana',
    )
    expect(claveVoto(voto('luffy', 'One Piece', '2026-06-14T10:00:00Z'))).toContain('∅')
  })

  it('colorGota: oro solo si el ganador está en topSlugs', () => {
    expect(colorGota(voto('luffy', 'One Piece', 'x'), ['luffy'])).toBe('oro')
    expect(colorGota(voto('luffy', 'One Piece', 'x'), new Set(['zoro']))).toBe('carmesi')
    expect(colorGota(voto('luffy', 'One Piece', 'x'), [])).toBe('carmesi')
  })

  it('construirTerritorios agrupa por presencia y manda el resto al confín', () => {
    const votos = [
      voto('luffy', 'One Piece', 'x'),
      voto('luffy', 'One Piece', 'y'),
      voto('naruto', 'Naruto', 'z'),
      voto('ichigo', 'Bleach', 'w'),
    ]
    const { territorios, confin } = construirTerritorios(votos, catalogo, {
      maxTerritorios: 2,
      topSlugs: ['luffy'],
    })
    expect(territorios.map((t) => t.anime)).toEqual(['One Piece', 'Naruto'])
    expect(territorios[0].total).toBe(2)
    expect(territorios[0].casa).toBe('oro') // luffy (top) ganó ahí
    expect(territorios[1].casa).toBe('carmesi')
    expect(confin.total).toBe(1) // Bleach quedó fuera del top-2
    expect(confin.animes).toEqual(['Bleach'])
  })

  it('votosNuevos devuelve solo lo no visto, ordenado de viejo a nuevo', () => {
    const prev = [voto('a', 'One Piece', '2026-06-14T10:00:00Z')]
    const next = [
      voto('b', 'Naruto', '2026-06-14T10:02:00Z'),
      voto('a', 'One Piece', '2026-06-14T10:00:00Z'),
      voto('c', 'Bleach', '2026-06-14T10:01:00Z'),
    ]
    const nuevos = votosNuevos(prev, next)
    expect(nuevos.map((v) => v.ganador.slug)).toEqual(['c', 'b'])
  })

  it('coalescerGuardia colapsa ráfagas en un asiento agregado', () => {
    const t0 = Date.parse('2026-06-14T10:00:00Z')
    const burst = Array.from({ length: 5 }, (_, i) =>
      voto(`g${i}`, 'One Piece', new Date(t0 + i * 200).toISOString()),
    )
    const entries = coalescerGuardia(burst, { minBurst: 4, burstWindowMs: 2000 })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ tipo: 'agregado', n: 5 })
  })

  it('fechaRelativa da etiquetas sobrias con el now inyectado', () => {
    const now = Date.parse('2026-06-14T12:00:00Z')
    expect(fechaRelativa('2026-06-14T11:59:40Z', now)).toBe('hace un instante')
    expect(fechaRelativa('2026-06-14T11:30:00Z', now)).toBe('hace 30 min')
    expect(fechaRelativa('2026-06-14T09:00:00Z', now)).toBe('hace 3 h')
  })

  it('construirMareaHoraria sin actividad declara la ventana vacía', () => {
    const out = construirMareaHoraria([], { now: Date.parse('2026-06-14T12:00:00Z') })
    expect(out.empty).toBe(true)
    expect(out.buckets).toHaveLength(0)
  })

  it('construirMareaHoraria con now=0 y feed real NO lanza (remount con caché)', () => {
    // Regresión: en el primer render tras un remount con caché, el reloj aún es
    // 0 mientras react-query entrega votos. Antes petaba en buckets[0].start.
    const votos = [
      voto('a', 'One Piece', '2026-06-14T10:00:00Z'),
      voto('b', 'Naruto', '2026-06-14T10:05:00Z'),
    ]
    expect(() => construirMareaHoraria(votos, { now: 0 })).not.toThrow()
    const out = construirMareaHoraria(votos, { now: 0 })
    expect(out.empty).toBe(false)
    expect(out.buckets.length).toBeGreaterThan(0)
  })

  it('construirTerritorios NO cuenta un empate como victoria de personaje1', () => {
    const votos = [
      voto('luffy', 'One Piece', 'x'),
      { ...voto('zoro', 'One Piece', 'y'), empate: true }, // empate: no suma
    ]
    const { territorios } = construirTerritorios(votos, catalogo, { maxTerritorios: 3 })
    const onePiece = territorios.find((t) => t.anime === 'One Piece')
    expect(onePiece?.total).toBe(1) // solo el voto decidido
  })

  it('construirTerritorios ignora items sin ganador (ruido legacy)', () => {
    const votos = [
      voto('luffy', 'One Piece', 'x'),
      { ganador: null, rival: { nombre: 'r' }, username: null, fecha: 'z' },
    ]
    expect(() => construirTerritorios(votos, catalogo, {})).not.toThrow()
    const { territorios } = construirTerritorios(votos, catalogo, {})
    expect(territorios.find((t) => t.anime === 'One Piece')?.total).toBe(1)
  })
})
