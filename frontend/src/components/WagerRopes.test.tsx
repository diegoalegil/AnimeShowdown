import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Bracket from './Bracket'

// ── La porra (WagerRopes) es una capa ADITIVA dentro del MISMO <svg> del
//    árbol de cuerdas. Se asserta el CONTRATO: con predicciones + geometría
//    disponible se pintan cuerdas de porra para los matches predichos; sin
//    predicción NO se pinta; los resultados vienen del mock del backend (DTO
//    del match), nunca calculados en cliente.

vi.mock('./PersonajeCutImg', () => ({
  default: ({ alt }: { alt?: string }) => (
    <span role="img" aria-label={alt} data-testid="cut-img" />
  ),
}))

vi.mock('./KanjiStroke', () => ({
  default: ({ kanji }: { kanji: string }) => <span data-testid="kanji">{kanji}</span>,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, username: 'porrista' } }),
}))

// `useMisPredicciones` es la fuente real de la porra; lo mockeamos por test
// vía una variable mutable que devuelve la lista de PrediccionDto.
let misPredicciones: Array<Record<string, unknown>> = []
vi.mock('../hooks/usePredicciones', () => ({
  useMisPredicciones: () => ({ data: misPredicciones }),
  useAplicarPrediccion: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../lib/torneosQueries', () => ({
  useVotarEnfrentamiento: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useReducedMotionPref', () => ({
  useReducedMotionPref: () => true,
}))

const p = (id: number, slug: string, nombre: string) => ({ id, slug, nombre, anime: `${nombre} Anime` })

const NARUTO = p(1, 'naruto', 'Naruto')
const SASUKE = p(2, 'sasuke', 'Sasuke')
const LUFFY = p(3, 'luffy', 'Luffy')
const ZORO = p(4, 'zoro', 'Zoro')

/** Bracket de 2 rondas (4 participantes): 2 semifinales + 1 final. */
function brackets({ semi1Ganador = null as null | number } = {}) {
  const semi1 = {
    id: 10, ronda: 1, personaje1: NARUTO, personaje2: SASUKE,
    ganador: semi1Ganador ? (semi1Ganador === 1 ? NARUTO : SASUKE) : null,
    totalVotos: 5,
  }
  const semi2 = {
    id: 11, ronda: 1, personaje1: LUFFY, personaje2: ZORO,
    ganador: null, totalVotos: 3,
  }
  const final = {
    id: 20, ronda: 2, personaje1: null, personaje2: null, ganador: null, totalVotos: 0,
  }
  return [semi1, semi2, final]
}

function renderBracket(props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <Bracket
        enfrentamientos={brackets()}
        ganadorSlug={null}
        totalRondas={2}
        torneoId={99}
        torneoSlug="copa-test"
        estado="IN_PROGRESS"
        {...props}
      />
    </MemoryRouter>,
  )
}

/** Flush de la medición de geometría (rAF + backstop 80ms) → `geo` poblado. */
function flushGeo() {
  act(() => { vi.advanceTimersByTime(120) })
}

describe('WagerRopes — porra sobre el árbol de cuerdas', () => {
  beforeEach(() => { misPredicciones = []; vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('sin predicciones NO pinta capa de porra ni cuerdas propias', () => {
    misPredicciones = []
    renderBracket()
    flushGeo()
    // El árbol oficial sí pinta sus edges, pero la porra no se monta.
    expect(document.querySelectorAll('.rb-edge').length).toBeGreaterThan(0)
    expect(document.querySelector('.wr-layer')).toBeNull()
    expect(document.querySelectorAll('.wr-rope-own').length).toBe(0)
  })

  it('con predicción + geometría disponible pinta UNA cuerda de porra para el match predicho', () => {
    // Predigo a Luffy (id 3) en la semi2 (enfrentamiento 11), aún sin resolver.
    misPredicciones = [
      { id: 1, enfrentamientoId: 11, personajePredichoId: 3, personajePredichoNombre: 'Luffy', acertada: null },
    ]
    renderBracket()
    flushGeo()
    const layer = document.querySelector('.wr-layer')
    expect(layer).not.toBeNull()
    // capa decorativa → aria-hidden.
    expect(layer?.getAttribute('aria-hidden')).toBe('true')
    // exactamente una cuerda propia, pendiente (tendido).
    expect(document.querySelectorAll('.wr-rope-own').length).toBe(1)
    expect(document.querySelectorAll('.wr-rope-own--draw').length).toBe(1)
    // sin resultado todavía: ni soldadura ni deshilachado.
    expect(document.querySelector('.wr-rope-weld')).toBeNull()
    expect(document.querySelector('.wr-thread')).toBeNull()
  })

  it('match sin predicción NO recibe cuerda de porra (solo el predicho)', () => {
    // Solo predigo la semi1 (enf 10); la semi2 (enf 11) queda sin porra.
    misPredicciones = [
      { id: 1, enfrentamientoId: 10, personajePredichoId: 1, personajePredichoNombre: 'Naruto', acertada: null },
    ]
    renderBracket()
    flushGeo()
    expect(document.querySelectorAll('.wr-rope-own').length).toBe(1)
  })

  it('resultado del backend (DTO con ganador) resuelve la porra: acierto se suelda en oro', () => {
    // Predigo a Naruto (id 1) en la semi1 (enf 10), que el DTO marca ya ganada
    // por Naruto → acierto. El resultado viene del campo `ganador` del backend,
    // NO se calcula en cliente.
    misPredicciones = [
      { id: 1, enfrentamientoId: 10, personajePredichoId: 1, personajePredichoNombre: 'Naruto', acertada: true },
    ]
    renderBracket({ enfrentamientos: brackets({ semi1Ganador: 1 }) })
    flushGeo()
    // Resuelto al montar (instant): cuerda dorada directa, sin pulso de nudo.
    expect(document.querySelectorAll('.wr-rope-own--gold').length).toBe(1)
    expect(document.querySelector('.wr-rope-own--draw')).toBeNull()
    expect(document.querySelector('.wr-knot-pulse')).toBeNull()
  })

  it('resultado del backend: fallo deshilacha la cuerda (3 hilos)', () => {
    // Predigo a Sasuke (id 2) en la semi1 (enf 10), pero el DTO da ganador a
    // Naruto → fallo. Resultado del backend, no calculado.
    misPredicciones = [
      { id: 1, enfrentamientoId: 10, personajePredichoId: 2, personajePredichoNombre: 'Sasuke', acertada: false },
    ]
    renderBracket({ enfrentamientos: brackets({ semi1Ganador: 1 }) })
    flushGeo()
    // Resuelto al montar (instant): estado frayed estático + 3 hilos.
    expect(document.querySelectorAll('.wr-rope-own--frayed-static').length).toBe(1)
    expect(document.querySelectorAll('.wr-thread').length).toBe(3)
    expect(document.querySelector('.wr-rope-own--gold')).toBeNull()
  })

  it('no inventa puntos: la capa de porra no añade ningún marcador de puntuación', () => {
    misPredicciones = [
      { id: 1, enfrentamientoId: 11, personajePredichoId: 3, personajePredichoNombre: 'Luffy', acertada: null },
    ]
    renderBracket()
    flushGeo()
    // Criterio 3: sin dato de puntos del backend, no se pinta marcador alguno.
    expect(document.querySelector('.wr-points-float')).toBeNull()
    expect(document.querySelector('.wr-perfect-tag')).toBeNull()
  })
})
