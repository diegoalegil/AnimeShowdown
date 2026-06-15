import { describe, expect, it } from 'vitest'
import {
  deriveHitosEvento,
  descomponerMs,
  fechaCortaHito,
  framesCrisantemo,
  fraseCountdown,
  HANABI_CRISANTEMOS_LAYOUT,
  HANABI_PARTICULAS,
  NUMERALES,
  pad2,
} from './festival-core'

/**
 * festival-core es el modulo puro del matsuri. Lo critico a cubrir:
 *  - deriveHitosEvento: las 4 fases de fecha (Apertura/Ecuador/Recta final/
 *    Cierre) caen en los instantes correctos y `alcanzado` respeta el `now`
 *    para evento pasado/activo/futuro (modelo real, cero fabricacion).
 *  - El formato del countdown AT-safe y los frames deterministas de hanabi.
 */

// Evento de 8 dias (shape REAL: inicioISO/finISO). 0%/50%/75%/100%:
//   Apertura  = 01 jun 00:00Z
//   Ecuador   = 05 jun 00:00Z   (inicio + 4 dias)
//   Recta f.  = 07 jun 00:00Z   (inicio + 6 dias)
//   Cierre    = 09 jun 00:00Z
const EVENTO = {
  inicioISO: '2026-06-01T00:00:00Z',
  finISO: '2026-06-09T00:00:00Z',
}
const INICIO = +new Date(EVENTO.inicioISO)
const FIN = +new Date(EVENTO.finISO)
const SPAN = FIN - INICIO

describe('deriveHitosEvento — modelo de hitos por fecha-fase', () => {
  it('deriva exactamente 4 fases con los timestamps 0/50/75/100%', () => {
    const hitos = deriveHitosEvento(EVENTO, new Date('2026-06-15T00:00:00Z'))
    expect(hitos.map((h) => h.id)).toEqual([
      'apertura',
      'ecuador',
      'recta-final',
      'cierre',
    ])
    expect(hitos[0].fechaMs).toBe(INICIO)
    expect(hitos[1].fechaMs).toBe(INICIO + SPAN * 0.5)
    expect(hitos[2].fechaMs).toBe(INICIO + SPAN * 0.75)
    expect(hitos[3].fechaMs).toBe(FIN)
  })

  it('etiqueta humana = "Nombre · fecha corta"', () => {
    const hitos = deriveHitosEvento(EVENTO, new Date('2026-06-15T00:00:00Z'))
    expect(hitos[0].etiqueta).toBe(`Apertura · ${fechaCortaHito(INICIO)}`)
    expect(hitos[3].etiqueta).toBe(`Cierre · ${fechaCortaHito(FIN)}`)
    expect(hitos[0].etiqueta).toMatch(/^Apertura · /)
  })

  it('evento FUTURO (now < inicio): ninguna fase alcanzada', () => {
    const hitos = deriveHitosEvento(EVENTO, new Date('2026-05-20T00:00:00Z'))
    expect(hitos.every((h) => h.alcanzado === false)).toBe(true)
  })

  it('evento ACTIVO (now en mitad): Apertura+Ecuador alcanzados, resto no', () => {
    // 06 jun: ya paso Apertura (01) y Ecuador (05); aun no Recta final (07).
    const hitos = deriveHitosEvento(EVENTO, new Date('2026-06-06T00:00:00Z'))
    expect(hitos.map((h) => h.alcanzado)).toEqual([true, true, false, false])
    // El "ultimo alcanzado" es Ecuador (indice 1).
    const lastReached = hitos.reduce((acc, h, i) => (h.alcanzado ? i : acc), -1)
    expect(lastReached).toBe(1)
  })

  it('evento PASADO (now > fin): las 4 fases alcanzadas', () => {
    const hitos = deriveHitosEvento(EVENTO, new Date('2026-07-01T00:00:00Z'))
    expect(hitos.every((h) => h.alcanzado === true)).toBe(true)
  })

  it('acepta now como number (epoch ms) ademas de Date', () => {
    const conNumero = deriveHitosEvento(EVENTO, +new Date('2026-06-06T00:00:00Z'))
    const conDate = deriveHitosEvento(EVENTO, new Date('2026-06-06T00:00:00Z'))
    expect(conNumero.map((h) => h.alcanzado)).toEqual(conDate.map((h) => h.alcanzado))
  })

  it('robusto ante shape invalido: sin fechas o rango invertido -> []', () => {
    expect(deriveHitosEvento(null as never, Date.now())).toEqual([])
    expect(deriveHitosEvento({} as never, Date.now())).toEqual([])
    expect(
      deriveHitosEvento({ inicioISO: EVENTO.finISO, finISO: EVENTO.inicioISO }, Date.now()),
    ).toEqual([])
  })
})

describe('fraseCountdown — AT-safe con estados REALES', () => {
  it('PROXIMO -> "Empieza en …"', () => {
    const ms = 2 * 86400000 + 4 * 3600000 // 2 dias 4 horas
    expect(fraseCountdown(ms, 'PROXIMO')).toBe('Empieza en 2 dias y 4 horas.')
  })

  it('ACTIVO -> "Termina en …"', () => {
    const ms = 1 * 86400000 + 1 * 3600000 // 1 dia 1 hora (singular)
    expect(fraseCountdown(ms, 'ACTIVO')).toBe('Termina en 1 dia y 1 hora.')
  })

  it('no incluye segundos salvo que sea lo unico que queda', () => {
    // 5 minutos: sin dias/horas, muestra minutos (no segundos).
    expect(fraseCountdown(5 * 60000, 'ACTIVO')).toBe('Termina en 5 minutos.')
    // 30 segundos: lo unico que queda.
    expect(fraseCountdown(30000, 'ACTIVO')).toBe('Termina en 30 segundos.')
  })

  it('PASADO -> mensaje de finalizado', () => {
    expect(fraseCountdown(0, 'PASADO')).toBe('El evento ha finalizado.')
  })
})

describe('descomponerMs / pad2', () => {
  it('descompone sin negativos', () => {
    const d = descomponerMs(2 * 86400000 + 3 * 3600000 + 4 * 60000 + 5000)
    expect(d).toMatchObject({ dias: 2, horas: 3, mins: 4, segs: 5 })
    expect(descomponerMs(-1000).total).toBe(0)
  })
  it('pad2 rellena a dos cifras y clampa negativos', () => {
    expect(pad2(7)).toBe('07')
    expect(pad2(42)).toBe('42')
    expect(pad2(-3)).toBe('00')
  })
})

describe('framesCrisantemo — frames deterministas por indice', () => {
  it('produce HANABI_PARTICULAS frames con dx/dy en px', () => {
    const frames = framesCrisantemo(0, 88, HANABI_PARTICULAS)
    expect(frames).toHaveLength(HANABI_PARTICULAS)
    expect(frames[0].dx).toMatch(/px$/)
    expect(frames[0].dy).toMatch(/px$/)
  })
  it('es estable entre llamadas (StrictMode no diverge)', () => {
    expect(framesCrisantemo(1, 96, HANABI_PARTICULAS)).toEqual(
      framesCrisantemo(1, 96, HANABI_PARTICULAS),
    )
  })
  it('distintos crisantemos no calcan (offset angular)', () => {
    const a = framesCrisantemo(0, 88, HANABI_PARTICULAS)
    const b = framesCrisantemo(1, 88, HANABI_PARTICULAS)
    expect(a).not.toEqual(b)
  })
})

describe('constantes de marca', () => {
  it('layout de hanabi = 3 crisantemos', () => {
    expect(HANABI_CRISANTEMOS_LAYOUT).toHaveLength(3)
  })
  it('numerales 一..十 cubren las 10 piedras', () => {
    expect(NUMERALES).toHaveLength(10)
    expect(NUMERALES[0]).toBe('一')
    expect(NUMERALES[9]).toBe('十')
  })
})
