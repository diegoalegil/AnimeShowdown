import { describe, expect, it } from 'vitest'

import { buildTorneosPageModel } from './torneos-page-data'

describe('buildTorneosPageModel', () => {
  it('agrupa torneos por estado y calcula el pulso general', () => {
    const model = buildTorneosPageModel([
      { slug: 'live-a', estado: 'IN_PROGRESS', votosUltimos7Dias: 9, numParticipantes: 8 },
      { slug: 'scheduled-a', estado: 'SCHEDULED', numParticipantes: 16 },
      { slug: 'finished-a', estado: 'FINISHED', votosUltimos7Dias: 4, numParticipantes: 8 },
      null,
    ])

    expect(model.total).toBe(3)
    expect(model.enCurso).toHaveLength(1)
    expect(model.proximos).toHaveLength(1)
    expect(model.historial).toHaveLength(1)
    expect(model.votosUltimos7Dias).toBe(13)
    expect(model.participantes).toBe(32)
    expect(model.destacado?.torneo.slug).toBe('live-a')
    expect(model.destacado?.tipo).toBe('IN_PROGRESS')
  })

  it('prioriza torneos en curso por actividad reciente y ronda mas temprana', () => {
    const model = buildTorneosPageModel([
      { slug: 'round-two', estado: 'IN_PROGRESS', votosUltimos7Dias: 20, rondaActual: 2 },
      { slug: 'round-one', estado: 'IN_PROGRESS', votosUltimos7Dias: 20, rondaActual: 1 },
      { slug: 'quiet', estado: 'IN_PROGRESS', votosUltimos7Dias: 2, rondaActual: 1 },
    ])

    expect(model.enCurso.map((torneo) => torneo.slug)).toEqual([
      'round-one',
      'round-two',
      'quiet',
    ])
  })

  it('elige el proximo torneo mas cercano cuando no hay torneos en curso', () => {
    const model = buildTorneosPageModel([
      { slug: 'later', estado: 'SCHEDULED', fechaInicio: '2026-08-01T12:00:00Z' },
      { slug: 'soon', estado: 'SCHEDULED', fechaInicio: '2026-07-01T12:00:00Z' },
      { slug: 'done', estado: 'FINISHED', fechaFinalizacion: '2026-06-01T12:00:00Z' },
    ])

    expect(model.proximos.map((torneo) => torneo.slug)).toEqual(['soon', 'later'])
    expect(model.destacado?.torneo.slug).toBe('soon')
    expect(model.destacado?.tipo).toBe('SCHEDULED')
  })

  it('usa el historial mas reciente como destacado si solo hay finalizados', () => {
    const model = buildTorneosPageModel([
      { slug: 'old', estado: 'FINISHED', fechaFinalizacion: '2026-05-01T12:00:00Z' },
      { slug: 'new', estado: 'FINISHED', fechaFinalizacion: '2026-06-01T12:00:00Z' },
    ])

    expect(model.historial.map((torneo) => torneo.slug)).toEqual(['new', 'old'])
    expect(model.destacado?.torneo.slug).toBe('new')
    expect(model.destacado?.tipo).toBe('FINISHED')
  })
})
