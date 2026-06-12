import { describe, expect, it } from 'vitest'
import { computarGeometria, W, H, PAD_X, PAD_TOP, PAD_BOT } from './elo-history-geometry'

type Punto = { fecha: string; votosAcumulados: number }

function serie(votos: number[]): Punto[] {
  return votos.map((v, i) => ({
    fecha: `2026-05-${String(i + 1).padStart(2, '0')}`,
    votosAcumulados: v,
  }))
}

describe('computarGeometria — proyección del histórico de votos', () => {
  it('devuelve null sin serie dibujable: vacía, un punto o plana', () => {
    expect(computarGeometria(undefined)).toBeNull()
    expect(computarGeometria([])).toBeNull()
    expect(computarGeometria(serie([100]))).toBeNull()
    expect(computarGeometria(serie([50, 50, 50]))).toBeNull()
  })

  it('proyecta x al ancho útil e y invertida al alto útil del viewBox', () => {
    const geo = computarGeometria(serie([10, 40, 25]))!
    expect(geo).not.toBeNull()
    expect(geo.pts[0].x).toBe(PAD_X)
    expect(geo.pts[2].x).toBe(W - PAD_X)
    // El mínimo (10) toca el suelo del chart; el máximo (40) toca el techo.
    expect(geo.pts[0].y).toBeCloseTo(H - PAD_BOT)
    expect(geo.pts[1].y).toBeCloseTo(PAD_TOP)
  })

  it('linea y area son paths válidos: la línea arranca en M, el área cierra en Z', () => {
    const geo = computarGeometria(serie([10, 40, 25]))!
    expect(geo.linea.startsWith('M ')).toBe(true)
    expect(geo.linea.split('L').length).toBe(3)
    expect(geo.area.startsWith(`M ${PAD_X.toFixed(1)} ${H - PAD_BOT}`)).toBe(true)
    expect(geo.area.endsWith('Z')).toBe(true)
  })

  it('peak es el índice del PRIMER máximo (empate no lo mueve)', () => {
    expect(computarGeometria(serie([10, 40, 20, 40, 15]))!.peak).toBe(1)
  })

  it('subeAlFinal compara el último punto con el de hace 5 días', () => {
    // Sube al final: el tramo final remonta aunque el global baje.
    expect(computarGeometria(serie([90, 80, 20, 22, 25, 30, 35]))!.subeAlFinal).toBe(true)
    // Baja al final: el tramo final cae aunque el global suba.
    expect(computarGeometria(serie([10, 20, 80, 75, 70, 65, 60]))!.subeAlFinal).toBe(false)
    // Series cortas (<5): compara contra el primer punto sin salirse del array.
    expect(computarGeometria(serie([10, 30]))!.subeAlFinal).toBe(true)
    expect(computarGeometria(serie([30, 10]))!.subeAlFinal).toBe(false)
  })

  it('expone inicial/actual/delta del periodo', () => {
    const geo = computarGeometria(serie([100, 180, 140]))!
    expect(geo.inicial).toBe(100)
    expect(geo.actual).toBe(140)
    expect(geo.delta).toBe(40)
  })
})
