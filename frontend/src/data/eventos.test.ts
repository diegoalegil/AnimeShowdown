import { describe, expect, it } from 'vitest'
import {
  EVENTOS,
  ESTADO_EVENTO,
  getEstadoEvento,
  getEventoHeadline,
  getEventoPorSlug,
  getEventosActivos,
  getEventosPasados,
  getEventosProximos,
} from './eventos'

/**
 * Cubre el contrato que hace posible la migración a runtime: los helpers
 * operan sobre la lista que se les pasa (la del backend vía useEventos) y
 * caen a EVENTOS solo por el default. El cálculo de estado/orden es idéntico
 * para cualquier origen porque comparten shape.
 */

const NOW = new Date('2026-06-05T12:00:00Z')

const LISTA = [
  {
    slug: 'activo-uno',
    titulo: 'Activo Uno',
    descripcionCorta: 'en curso',
    tipo: { kind: 'anime', valor: 'X' },
    inicioISO: '2026-06-01T00:00:00Z',
    finISO: '2026-06-10T23:59:59Z',
    color: 'amber',
    emoji: '🔥',
  },
  {
    slug: 'proximo-cercano',
    titulo: 'Próximo Cercano',
    descripcionCorta: 'pronto',
    tipo: { kind: 'anime', valor: 'Y' },
    inicioISO: '2026-06-08T00:00:00Z',
    finISO: '2026-06-15T23:59:59Z',
    color: 'cyan',
    emoji: '⏳',
  },
  {
    slug: 'proximo-lejano',
    titulo: 'Próximo Lejano',
    descripcionCorta: 'más tarde',
    tipo: { kind: 'anime', valor: 'Z' },
    inicioISO: '2026-06-20T00:00:00Z',
    finISO: '2026-06-25T23:59:59Z',
    color: 'violet',
    emoji: '🗓️',
  },
  {
    slug: 'pasado',
    titulo: 'Pasado',
    descripcionCorta: 'terminó',
    tipo: { kind: 'anime', valor: 'W' },
    inicioISO: '2026-05-01T00:00:00Z',
    finISO: '2026-05-10T23:59:59Z',
    color: 'rose',
    emoji: '✅',
  },
]

describe('helpers de eventos con lista en runtime', () => {
  it('clasifica por estado contra la lista pasada', () => {
    expect(getEstadoEvento(LISTA[0], NOW)).toBe(ESTADO_EVENTO.ACTIVO)
    expect(getEstadoEvento(LISTA[1], NOW)).toBe(ESTADO_EVENTO.PROXIMO)
    expect(getEstadoEvento(LISTA[3], NOW)).toBe(ESTADO_EVENTO.PASADO)
  })

  it('getEventosActivos devuelve solo los activos de la lista', () => {
    expect(getEventosActivos(NOW, LISTA).map((e) => e.slug)).toEqual(['activo-uno'])
  })

  it('getEventosProximos ordena por inicio ascendente', () => {
    expect(getEventosProximos(NOW, LISTA).map((e) => e.slug)).toEqual([
      'proximo-cercano',
      'proximo-lejano',
    ])
  })

  it('getEventosPasados devuelve los finalizados', () => {
    expect(getEventosPasados(NOW, LISTA).map((e) => e.slug)).toEqual(['pasado'])
  })

  it('getEventoHeadline prefiere el activo y si no, el próximo más cercano', () => {
    expect(getEventoHeadline(NOW, LISTA).slug).toBe('activo-uno')
    const sinActivos = LISTA.filter((e) => e.slug !== 'activo-uno')
    expect(getEventoHeadline(NOW, sinActivos).slug).toBe('proximo-cercano')
    expect(getEventoHeadline(NOW, [])).toBeNull()
  })

  it('getEventoPorSlug resuelve dentro de la lista pasada', () => {
    expect(getEventoPorSlug('pasado', LISTA).titulo).toBe('Pasado')
    expect(getEventoPorSlug('inexistente', LISTA)).toBeNull()
  })

  it('por defecto sigue operando sobre EVENTOS (hardcode)', () => {
    const activos = getEventosActivos(NOW)
    expect(Array.isArray(activos)).toBe(true)
    activos.forEach((e) => expect(EVENTOS).toContain(e))
  })
})
