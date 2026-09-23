import { describe, expect, it } from 'vitest'
import { diaCorto } from './fechas.js'

describe('diaCorto', () => {
  it('escribe el día y el mes abreviado, con el año solo si no es el actual', () => {
    expect(diaCorto('2026-09-12', '2026-09-23')).toBe('12 sep')
    expect(diaCorto('2026-01-05', '2026-09-23')).toBe('5 ene')
    expect(diaCorto('2025-12-31', '2026-09-23')).toBe('31 dic 2025')
  })

  it('ignora fechas mal formadas', () => {
    expect(diaCorto(undefined, '2026-09-23')).toBe('')
    expect(diaCorto('2026-13-01', '2026-09-23')).toBe('')
    expect(diaCorto('ayer', '2026-09-23')).toBe('')
  })
})
