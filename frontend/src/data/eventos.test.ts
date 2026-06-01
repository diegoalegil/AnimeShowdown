import { describe, expect, it } from 'vitest'

import {
  getEventoHeadline,
  getEventoPorSlug,
  getEventosActivos,
  getPersonajesEvento,
} from './eventos'

const runtimeEventos = [
  {
    slug: 'runtime-cup',
    titulo: 'Runtime Cup',
    descripcionCorta: 'Evento cargado desde backend',
    tipo: { kind: 'slugs', valor: ['luffy', 'naruto', 'goku'] },
    inicioISO: '2026-05-01T00:00:00Z',
    finISO: '2026-06-30T23:59:59Z',
    color: 'cyan',
    emoji: '✨',
  },
]

describe('eventos runtime', () => {
  it('usa el catalogo recibido en vez de depender solo del fallback estatico', () => {
    const now = new Date('2026-06-01T12:00:00Z')

    expect(getEventosActivos(now, runtimeEventos).map((e) => e.slug)).toEqual(['runtime-cup'])
    expect(getEventoHeadline(now, runtimeEventos)?.slug).toBe('runtime-cup')
    expect(getEventoPorSlug('runtime-cup', runtimeEventos)?.titulo).toBe('Runtime Cup')
  })

  it('resuelve participantes de eventos por slugs runtime', () => {
    const catalogo = [
      { slug: 'naruto', nombre: 'Naruto Uzumaki' },
      { slug: 'goku', nombre: 'Son Goku' },
      { slug: 'luffy', nombre: 'Monkey D. Luffy' },
      { slug: 'zoro', nombre: 'Roronoa Zoro' },
    ]
    const participantes = getPersonajesEvento(runtimeEventos[0], catalogo)

    expect(participantes.map((p) => p.slug)).toEqual(['luffy', 'naruto', 'goku'])
  })
})
