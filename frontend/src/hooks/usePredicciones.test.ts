import { describe, expect, it } from 'vitest'

import { mergePrediccionEnLista } from './usePredicciones'

describe('mergePrediccionEnLista', () => {
  it('crea lista cuando la cache aun no tiene predicciones', () => {
    const prediccion = {
      id: 1,
      torneoId: 7,
      tipo: 'CAMPEON',
      personajePredichoId: 42,
    }

    expect(mergePrediccionEnLista(undefined, prediccion)).toEqual([prediccion])
  })

  it('actualiza la prediccion de campeon del mismo torneo sin duplicarla', () => {
    const current = [
      {
        id: 1,
        torneoId: 7,
        tipo: 'CAMPEON',
        personajePredichoId: 42,
        personajePredichoNombre: 'Luffy',
      },
    ]

    const next = mergePrediccionEnLista(current, {
      torneoId: 7,
      tipo: 'CAMPEON',
      personajePredichoId: 99,
      personajePredichoNombre: 'Zoro',
    })

    expect(next).toEqual([
      {
        id: 1,
        torneoId: 7,
        tipo: 'CAMPEON',
        personajePredichoId: 99,
        personajePredichoNombre: 'Zoro',
      },
    ])
  })

  it('actualiza predicciones de enfrentamiento por scope de match', () => {
    const current = [
      { id: 1, enfrentamientoId: 10, personajePredichoId: 101 },
      { id: 2, enfrentamientoId: 11, personajePredichoId: 201 },
    ]

    const next = mergePrediccionEnLista(current, {
      enfrentamientoId: 10,
      personajePredichoId: 102,
    })

    expect(next).toEqual([
      { id: 1, enfrentamientoId: 10, personajePredichoId: 102 },
      { id: 2, enfrentamientoId: 11, personajePredichoId: 201 },
    ])
  })

  it('agrega una prediccion nueva cuando no comparte scope con las existentes', () => {
    const current = [{ id: 1, enfrentamientoId: 10, personajePredichoId: 101 }]
    const prediccion = { id: 2, enfrentamientoId: 11, personajePredichoId: 201 }

    expect(mergePrediccionEnLista(current, prediccion)).toEqual([
      current[0],
      prediccion,
    ])
  })
})
