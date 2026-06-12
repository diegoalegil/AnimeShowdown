import { describe, expect, it } from 'vitest'
import { ENSO_PATH, ENSO_VIEWBOX } from './ensoPath'

// El trazado con dash (pathLength="1" + stroke-dashoffset) y el doble trazo
// rotado del hito 50 dependen de que el ensō siga siendo UN solo subpath
// abierto con la boca arriba. Estos tests protegen ese contrato geométrico,
// no los números concretos del dibujo.

const CENTRO = { x: 60, y: 60 }

function anclas(path: string) {
  const ordenes = path.trim().split(/(?=[A-Za-z])/)
  const puntos: Array<{ x: number; y: number }> = []
  for (const orden of ordenes) {
    const nums = (orden.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    // M aporta su punto; cada C aporta su punto final (los controles no
    // están sobre el trazo y quedan fuera del contrato de radio).
    puntos.push({ x: nums[nums.length - 2], y: nums[nums.length - 1] })
  }
  return { ordenes, puntos }
}

describe('ensoPath — contrato geométrico del ensō', () => {
  it('es UN solo subpath abierto: una M, solo cúbicas, sin cierre Z', () => {
    const { ordenes } = anclas(ENSO_PATH)
    expect(ordenes[0].startsWith('M')).toBe(true)
    expect(ordenes.slice(1).every((o) => o.startsWith('C'))).toBe(true)
    expect(ENSO_PATH).not.toMatch(/[Zz]/)
    expect(ENSO_PATH.match(/M/g)).toHaveLength(1)
  })

  it('el radio de pincel ondula dentro de la banda 46–49 alrededor de (60,60)', () => {
    const { puntos } = anclas(ENSO_PATH)
    for (const p of puntos) {
      const radio = Math.hypot(p.x - CENTRO.x, p.y - CENTRO.y)
      expect(radio).toBeGreaterThanOrEqual(46)
      expect(radio).toBeLessThanOrEqual(49)
    }
  })

  it('la boca queda abierta y arriba (el dash nunca traza un círculo cerrado)', () => {
    const { puntos } = anclas(ENSO_PATH)
    const inicio = puntos[0]
    const fin = puntos[puntos.length - 1]
    expect(Math.hypot(fin.x - inicio.x, fin.y - inicio.y)).toBeGreaterThan(10)
    expect(inicio.y).toBeLessThan(CENTRO.y)
    expect(fin.y).toBeLessThan(CENTRO.y)
  })

  it('todo el trazo vive dentro del viewBox declarado', () => {
    expect(ENSO_VIEWBOX).toBe('0 0 120 120')
    const nums = (ENSO_PATH.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(120)
    }
  })
})
