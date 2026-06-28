import { describe, expect, it } from 'vitest'
import {
  bypassCatalogGateForPath,
  shouldGateCatalogRoute,
  shouldPrimeCatalog,
} from './catalog-route-policy'

describe('catalog-route-policy', () => {
  it('deja pasar rutas críticas sin esperar al catálogo global', () => {
    expect(bypassCatalogGateForPath('/votar')).toBe(true)
    expect(bypassCatalogGateForPath('/ranking')).toBe(true)
    expect(bypassCatalogGateForPath('/torneos')).toBe(true)
    expect(bypassCatalogGateForPath('/torneos/shonen-showdown')).toBe(true)
    expect(bypassCatalogGateForPath('/duel-live')).toBe(true)
    // ELO Duel es server-driven (no lee el catálogo) → no debe gatearse.
    expect(bypassCatalogGateForPath('/games/elo-duel')).toBe(true)
  })

  it('mantiene gate en rutas que sí necesitan catálogo completo antes de pintar', () => {
    expect(shouldGateCatalogRoute('/personajes')).toBe(true)
    expect(shouldGateCatalogRoute('/personajes/luffy')).toBe(true)
    expect(shouldGateCatalogRoute('/animes/one-piece')).toBe(true)
    expect(shouldGateCatalogRoute('/torneos/crear')).toBe(true)
  })

  it('NO ceba el catálogo en rutas sin personajes (auth/legal)', () => {
    expect(shouldPrimeCatalog('/login')).toBe(false)
    expect(shouldPrimeCatalog('/register')).toBe(false)
    expect(shouldPrimeCatalog('/forgot-password')).toBe(false)
    expect(shouldPrimeCatalog('/terminos')).toBe(false)
    expect(shouldPrimeCatalog('/faq/')).toBe(false) // normaliza trailing slash
    expect(shouldPrimeCatalog('/cartas')).toBe(false) // colección desde DTOs, no usa el catálogo
  })

  it('SÍ ceba el catálogo en rutas de contenido', () => {
    expect(shouldPrimeCatalog('/')).toBe(true)
    expect(shouldPrimeCatalog('/votar')).toBe(true)
    expect(shouldPrimeCatalog('/personajes')).toBe(true)
    expect(shouldPrimeCatalog('/animes/one-piece')).toBe(true)
  })
})
