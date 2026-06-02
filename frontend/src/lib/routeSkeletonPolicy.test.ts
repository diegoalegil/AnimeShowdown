import { describe, expect, it } from 'vitest'
import { getRouteSkeletonReserve } from './routeSkeletonPolicy'

describe('getRouteSkeletonReserve', () => {
  it('reserva altura especifica para anime detail y ranking', () => {
    expect(getRouteSkeletonReserve('/animes/one-piece')).toBe('min-h-[2200px]')
    expect(getRouteSkeletonReserve('/animes/one-piece/ranking')).toBe('min-h-[3200px]')
  })

  it('mantiene rutas sin reserva explicita como cadena vacia', () => {
    expect(getRouteSkeletonReserve('/faq')).toBe('')
  })
})
