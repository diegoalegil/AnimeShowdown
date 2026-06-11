import { describe, expect, it } from 'vitest'

import {
  computeFlipMoves,
  computeRankShifts,
  snapshotOffsets,
} from './live-flip'

type FakeRow = { dataset: { flipKey?: string }; offsetTop: number }

function fila(flipKey: string | undefined, offsetTop: number): FakeRow {
  return { dataset: flipKey ? { flipKey } : {}, offsetTop }
}

function lista(...rows: FakeRow[]) {
  return { children: rows } as unknown as HTMLElement
}

describe('snapshotOffsets', () => {
  it('mapea offsetTop por data-flip-key e ignora hijos sin clave', () => {
    const offsets = snapshotOffsets(
      lista(fila('luffy', 0), fila('zoro', 72), fila(undefined, 144)),
    )
    expect(offsets.get('luffy')).toBe(0)
    expect(offsets.get('zoro')).toBe(72)
    expect(offsets.size).toBe(2)
  })

  it('tolera lista nula (antes del mount)', () => {
    expect(snapshotOffsets(null).size).toBe(0)
  })
})

describe('computeFlipMoves', () => {
  it('calcula deltaY = oldY − newY solo para filas que cambiaron', () => {
    // zoro adelanta a luffy: luffy baja 72px, zoro sube 72px.
    const antes = new Map([
      ['luffy', 0],
      ['zoro', 72],
      ['nami', 144],
    ])
    const despues = new Map([
      ['zoro', 0],
      ['luffy', 72],
      ['nami', 144],
    ])
    const moves = computeFlipMoves(antes, despues)
    expect(moves).toContainEqual({ key: 'zoro', deltaY: 72 })
    expect(moves).toContainEqual({ key: 'luffy', deltaY: -72 })
    expect(moves.find((m) => m.key === 'nami')).toBeUndefined()
  })

  it('omite filas que entran o salen de la lista', () => {
    const antes = new Map([['luffy', 0]])
    const despues = new Map([
      ['luffy', 72],
      ['nuevo', 0],
    ])
    const moves = computeFlipMoves(antes, despues)
    expect(moves).toEqual([{ key: 'luffy', deltaY: -72 }])
  })

  it('descarta movimientos cuyo viaje completo queda fuera del viewport', () => {
    const antes = new Map([
      ['cerca', 100],
      ['lejos', 5000],
    ])
    const despues = new Map([
      ['cerca', 172],
      ['lejos', 5072],
    ])
    const moves = computeFlipMoves(antes, despues, {
      viewportMin: 0,
      viewportMax: 900,
    })
    expect(moves).toEqual([{ key: 'cerca', deltaY: -72 }])
  })

  it('anima si al menos un extremo del viaje toca el viewport', () => {
    // Sube desde fuera del viewport hasta dentro: sí se anima.
    const antes = new Map([['cohete', 2000]])
    const despues = new Map([['cohete', 400]])
    const moves = computeFlipMoves(antes, despues, {
      viewportMin: 0,
      viewportMax: 900,
    })
    expect(moves).toEqual([{ key: 'cohete', deltaY: 1600 }])
  })
})

describe('computeRankShifts', () => {
  it('marca up/down según el cambio de índice y omite filas estables o nuevas', () => {
    const shifts = computeRankShifts(
      ['luffy', 'zoro', 'nami', 'usopp'],
      ['zoro', 'luffy', 'nami', 'chopper'],
    )
    expect(shifts.get('zoro')).toBe('up')
    expect(shifts.get('luffy')).toBe('down')
    expect(shifts.has('nami')).toBe(false)
    expect(shifts.has('chopper')).toBe(false)
    expect(shifts.size).toBe(2)
  })

  it('sin reorden no hay shifts', () => {
    expect(computeRankShifts(['a', 'b'], ['a', 'b']).size).toBe(0)
  })
})
