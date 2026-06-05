import { describe, expect, it } from 'vitest'
import { canWarmupRoutes, idleWarmupRoutesFor } from './route-warmup-policy'

describe('route warmup policy', () => {
  it('bloquea warmup automático en redes lentas o con ahorro de datos', () => {
    expect(canWarmupRoutes({ connection: { effectiveType: '3g' } })).toBe(false)
    expect(canWarmupRoutes({ connection: { effectiveType: '2g' } })).toBe(false)
    expect(canWarmupRoutes({ connection: { saveData: true } })).toBe(false)
    expect(canWarmupRoutes({ connection: { downlink: 1.5 } })).toBe(false)
  })

  it('bloquea warmup automático si la pestaña o el dispositivo no tienen margen', () => {
    expect(canWarmupRoutes({ visibilityState: 'hidden' })).toBe(false)
    expect(canWarmupRoutes({ deviceMemory: 2 })).toBe(false)
    expect(canWarmupRoutes({ hardwareConcurrency: 2 })).toBe(false)
  })

  it('bloquea warmup en dispositivos táctiles (puntero grueso / móvil)', () => {
    expect(
      canWarmupRoutes({
        coarsePointer: true,
        connection: { effectiveType: '4g', downlink: 10 },
        deviceMemory: 8,
        hardwareConcurrency: 8,
        visibilityState: 'visible',
      }),
    ).toBe(false)
  })

  it('permite warmup con condiciones holgadas', () => {
    expect(
      canWarmupRoutes({
        coarsePointer: false,
        connection: { effectiveType: '4g', downlink: 10 },
        deviceMemory: 8,
        hardwareConcurrency: 8,
        visibilityState: 'visible',
      }),
    ).toBe(true)
  })

  it('limita el warmup idle a rutas vecinas de alto valor', () => {
    expect(idleWarmupRoutesFor('/')).toEqual(['/votar', '/ranking', '/torneos'])
    expect(idleWarmupRoutesFor('/games')).toEqual([
      '/games/shadow-guess',
      '/games/anime-reveal',
    ])
    expect(idleWarmupRoutesFor('/personajes/luffy')).toEqual([])
  })
})
