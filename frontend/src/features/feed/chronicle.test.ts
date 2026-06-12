import { describe, expect, it } from 'vitest'

import { agrupaPorDia, claveEvento, clavesUnicas, esTintaFresca, fechaRelativa } from './chronicle'

const voto = (fecha: string, autor = 'rin', slug = 'luffy') => ({
  tipo: 'VOTO',
  fecha,
  payload: { autorUsername: autor, personajeSlug: slug, personajeNombre: 'Luffy' },
})

describe('claveEvento / clavesUnicas', () => {
  it('la clave es estable por contenido, nunca por posición', () => {
    const item = voto('2026-06-12T01:00:00Z')
    expect(claveEvento(item)).toBe(claveEvento({ ...item }))
    // Prepend de un item nuevo: la clave del viejo no cambia.
    const lista1 = clavesUnicas([item])
    const lista2 = clavesUnicas([voto('2026-06-12T02:00:00Z', 'aki'), item])
    expect(lista2[1].key).toBe(lista1[0].key)
  })

  it('las repeticiones exactas se sufijan en vez de colisionar', () => {
    const item = voto('2026-06-12T01:00:00Z')
    const [a, b] = clavesUnicas([item, { ...item }])
    expect(a.key).not.toBe(b.key)
    expect(b.key.endsWith('#1')).toBe(true)
  })
})

describe('agrupaPorDia', () => {
  it('separa hoy / ayer / días anteriores respecto al instante dado', () => {
    const ahora = new Date('2026-06-12T12:00:00')
    const entradas = clavesUnicas([
      voto('2026-06-12T08:00:00'),
      voto('2026-06-11T22:00:00'),
      voto('2026-06-09T10:00:00'),
    ])
    const { hoy, ayer, antes } = agrupaPorDia(entradas, ahora)
    expect(hoy).toHaveLength(1)
    expect(ayer).toHaveLength(1)
    expect(antes).toHaveLength(1)
  })
})

describe('esTintaFresca / fechaRelativa', () => {
  it('solo lo recién ocurrido es tinta fresca', () => {
    const ahora = Date.parse('2026-06-12T12:00:00Z')
    expect(esTintaFresca('2026-06-12T11:59:30Z', ahora)).toBe(true)
    expect(esTintaFresca('2026-06-12T11:00:00Z', ahora)).toBe(false)
    expect(esTintaFresca('fecha-mala', ahora)).toBe(false)
  })

  it('formatea distancias humanas en español', () => {
    const ahora = Date.parse('2026-06-12T12:00:00Z')
    expect(fechaRelativa('2026-06-12T11:59:40Z', ahora)).toBe('ahora')
    expect(fechaRelativa('2026-06-12T11:10:00Z', ahora)).toBe('hace 50 min')
    expect(fechaRelativa('2026-06-12T07:00:00Z', ahora)).toBe('hace 5 h')
    expect(fechaRelativa('', ahora)).toBe('')
  })
})
