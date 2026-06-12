import { describe, expect, it } from 'vitest'

import { FASES, adaptTorneoParaPoster, deriveFaseActual } from './torneo-poster-fases'

describe('deriveFaseActual', () => {
  it('SCHEDULED siempre está en inscripción', () => {
    expect(deriveFaseActual({ estado: 'SCHEDULED', rondaActual: 3, totalRondas: 3 })).toBe(0)
  })

  it('FINISHED ya recorrió todo el camino', () => {
    expect(deriveFaseActual({ estado: 'FINISHED' })).toBe(FASES.length)
  })

  it('en juego deriva la fase de la ronda: última=final, penúltima=eliminatorias, resto=grupos', () => {
    expect(deriveFaseActual({ estado: 'IN_PROGRESS', rondaActual: 1, totalRondas: 3 })).toBe(1)
    expect(deriveFaseActual({ estado: 'IN_PROGRESS', rondaActual: 2, totalRondas: 3 })).toBe(2)
    expect(deriveFaseActual({ estado: 'IN_PROGRESS', rondaActual: 3, totalRondas: 3 })).toBe(3)
  })

  it('en juego sin datos de ronda cae a grupos, no a inscripción', () => {
    expect(deriveFaseActual({ estado: 'IN_PROGRESS' })).toBe(1)
  })
})

describe('adaptTorneoParaPoster', () => {
  it('resuelve visual del banco, campeón desde avataresPrincipales y arranque como hito', () => {
    const adaptado = adaptTorneoParaPoster({
      slug: 'shonen-cup',
      nombre: 'Shōnen Cup',
      estado: 'SCHEDULED',
      fechaInicio: '2026-07-01T18:00:00Z',
      ganadorSlug: null,
      avataresPrincipales: [{ slug: 'goku', nombre: 'Goku' }],
    })

    expect(adaptado.visual).toBeTruthy()
    expect(adaptado.visual.accentRgb).toBeTruthy()
    expect(adaptado.proximoHito).toEqual({ label: 'Arranca en', fecha: '2026-07-01T18:00:00Z' })
    expect(adaptado.ganadorNombre).toBeNull()
  })

  it('en un FINISHED el campeón sale del avatar resuelto y no hay hito', () => {
    const adaptado = adaptTorneoParaPoster({
      slug: 'random-showdown-3',
      nombre: 'Random Showdown #3',
      estado: 'FINISHED',
      fechaInicio: '2026-05-01T18:00:00Z',
      ganadorSlug: 'levi',
      avataresPrincipales: [
        { slug: 'goku', nombre: 'Goku' },
        { slug: 'levi', nombre: 'Levi Ackerman' },
      ],
    })

    expect(adaptado.ganadorNombre).toBe('Levi Ackerman')
    expect(adaptado.proximoHito).toBeNull()
  })

  it('un ganador sin avatar resuelto degrada a null en vez de romper la fila', () => {
    const adaptado = adaptTorneoParaPoster({
      slug: 'cup',
      nombre: 'Cup',
      estado: 'FINISHED',
      ganadorSlug: 'fantasma',
      avataresPrincipales: [],
    })

    expect(adaptado.ganadorNombre).toBeNull()
  })
})
