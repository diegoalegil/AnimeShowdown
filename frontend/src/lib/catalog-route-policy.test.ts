import { describe, expect, it } from 'vitest'
import {
  bypassCatalogGateForPath,
  shouldGateCatalogRoute,
  shouldPrimeCatalogFromApp,
} from './catalog-route-policy'

describe('catalog-route-policy', () => {
  it('deja pasar rutas críticas sin esperar al catálogo global', () => {
    expect(bypassCatalogGateForPath('/votar')).toBe(true)
    expect(bypassCatalogGateForPath('/ranking')).toBe(true)
    expect(bypassCatalogGateForPath('/torneos')).toBe(true)
    expect(bypassCatalogGateForPath('/cartas')).toBe(true)
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

  it('no primea catálogo desde App en rutas independientes', () => {
    expect(shouldPrimeCatalogFromApp('/login')).toBe(false)
    expect(shouldPrimeCatalogFromApp('/status')).toBe(false)
    expect(shouldPrimeCatalogFromApp('/terminos')).toBe(false)
    expect(shouldPrimeCatalogFromApp('/cartas')).toBe(false)
  })

  it('primea catálogo desde App solo cuando el gate global lo necesita', () => {
    expect(shouldPrimeCatalogFromApp('/')).toBe(true)
    expect(shouldPrimeCatalogFromApp('/personajes')).toBe(true)
    expect(shouldPrimeCatalogFromApp('/games/elo-duel')).toBe(true)
  })
})
