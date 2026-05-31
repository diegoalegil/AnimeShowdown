import { describe, expect, it } from 'vitest'
import { bypassCatalogGateForPath, shouldGateCatalogRoute } from './catalog-route-policy'

describe('catalog-route-policy', () => {
  it('deja pasar rutas críticas sin esperar al catálogo global', () => {
    expect(bypassCatalogGateForPath('/votar')).toBe(true)
    expect(bypassCatalogGateForPath('/ranking')).toBe(true)
    expect(bypassCatalogGateForPath('/torneos')).toBe(true)
    expect(bypassCatalogGateForPath('/torneos/shonen-showdown')).toBe(true)
    expect(bypassCatalogGateForPath('/duel-live')).toBe(true)
  })

  it('mantiene gate en rutas que sí necesitan catálogo completo antes de pintar', () => {
    expect(shouldGateCatalogRoute('/personajes')).toBe(true)
    expect(shouldGateCatalogRoute('/personajes/luffy')).toBe(true)
    expect(shouldGateCatalogRoute('/animes/one-piece')).toBe(true)
    expect(shouldGateCatalogRoute('/torneos/crear')).toBe(true)
    expect(shouldGateCatalogRoute('/games/elo-duel')).toBe(true)
  })
})
