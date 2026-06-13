import { describe, expect, it } from 'vitest'
import {
  estadoDe,
  formatAriaSpan,
  formatCuentaAtras,
} from './festival-board-data'

const SEG = 1_000
const MIN = 60_000
const HORA = 3_600_000
const DIA = 86_400_000

describe('formatCuentaAtras — los tres regímenes del marcador', () => {
  it('agotado o negativo clava el cero', () => {
    expect(formatCuentaAtras(0)).toBe('00 m 00 s')
    expect(formatCuentaAtras(-5_000)).toBe('00 m 00 s')
  })

  it('bajo la hora habla en minutos y segundos con padding', () => {
    expect(formatCuentaAtras(41 * MIN + 32 * SEG)).toBe('41 m 32 s')
    expect(formatCuentaAtras(5 * SEG)).toBe('00 m 05 s')
  })

  it('entre 1 y 48 horas habla en horas y minutos', () => {
    expect(formatCuentaAtras(HORA)).toBe('01 h 00 m')
    expect(formatCuentaAtras(7 * HORA + 23 * MIN)).toBe('07 h 23 m')
    expect(formatCuentaAtras(47 * HORA + 59 * MIN)).toBe('47 h 59 m')
  })

  it('desde 48h redondea los días HACIA ARRIBA (nunca promete de menos)', () => {
    expect(formatCuentaAtras(48 * HORA)).toBe('2 d')
    expect(formatCuentaAtras(49 * HORA)).toBe('3 d')
    expect(formatCuentaAtras(12 * DIA)).toBe('12 d')
  })
})

describe('formatAriaSpan — la cuenta atrás que narra el lector', () => {
  it('un solo minuto se narra en singular (también el suelo de <1 min)', () => {
    expect(formatAriaSpan(MIN)).toBe('1 minuto')
    expect(formatAriaSpan(30 * SEG)).toBe('1 minuto')
  })

  it('varios minutos en plural', () => {
    expect(formatAriaSpan(45 * MIN)).toBe('45 minutos')
  })

  it('horas con singular/plural y resto de minutos solo si existe', () => {
    expect(formatAriaSpan(HORA)).toBe('1 hora')
    expect(formatAriaSpan(2 * HORA)).toBe('2 horas')
    expect(formatAriaSpan(2 * HORA + 30 * MIN)).toBe('2 horas y 30 minutos')
  })

  it('desde 2 días redondea al día más cercano', () => {
    expect(formatAriaSpan(2 * DIA)).toBe('2 días')
    expect(formatAriaSpan(2 * DIA + 15 * HORA)).toBe('3 días')
  })
})

describe('estadoDe — las fronteras del cruce (la base del ticker)', () => {
  const evento = {
    inicio: new Date('2026-07-01T10:00:00Z'),
    fin: new Date('2026-07-03T10:00:00Z'),
  }
  const t = (iso: string) => new Date(iso).getTime()

  it('antes del inicio es futuro; el instante exacto del inicio ya es activo', () => {
    expect(estadoDe(evento, t('2026-07-01T09:59:59Z'))).toBe('futuro')
    expect(estadoDe(evento, t('2026-07-01T10:00:00Z'))).toBe('activo')
  })

  it('dentro de la ventana es activo; el instante exacto del fin ya es pasado', () => {
    expect(estadoDe(evento, t('2026-07-02T00:00:00Z'))).toBe('activo')
    expect(estadoDe(evento, t('2026-07-03T10:00:00Z'))).toBe('pasado')
    expect(estadoDe(evento, t('2026-07-04T00:00:00Z'))).toBe('pasado')
  })
})
