import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Bracket from './Bracket'

// ── Mocks de dependencias pesadas: el test asserta el CONTRATO del bracket
//    de cuerdas (lee DTOs, no inventa ganadores, reveal en vivo por ref),
//    no la imagen/kanji/odómetro ni la red.

vi.mock('./PersonajeCutImg', () => ({
  default: ({ alt }: { alt?: string }) => (
    <span role="img" aria-label={alt} data-testid="cut-img" />
  ),
}))

vi.mock('./KanjiStroke', () => ({
  default: ({ kanji }: { kanji: string }) => <span data-testid="kanji">{kanji}</span>,
}))

vi.mock('../features/ranking/components/LiveNumber', () => ({
  default: ({ value }: { value: number }) => <span data-testid="live">{value}</span>,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../hooks/usePredicciones', () => ({
  useMisPredicciones: () => ({ data: [] }),
  useAplicarPrediccion: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../lib/torneosQueries', () => ({
  useVotarEnfrentamiento: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useReducedMotionPref', () => ({
  useReducedMotionPref: () => true, // reduced: estado final directo, sin teatro
}))

const p = (id: number, slug: string, nombre: string) => ({ id, slug, nombre, anime: `${nombre} Anime` })

const NARUTO = p(1, 'naruto', 'Naruto')
const SASUKE = p(2, 'sasuke', 'Sasuke')
const LUFFY = p(3, 'luffy', 'Luffy')
const ZORO = p(4, 'zoro', 'Zoro')

/** Bracket de 2 rondas (4 participantes): 2 semifinales + 1 final. */
function brackets({ semi1Ganador = null as null | number, finalReady = false, finalGanador = null as null | number }) {
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
    id: 20, ronda: 2,
    personaje1: finalReady ? NARUTO : null,
    personaje2: finalReady ? LUFFY : null,
    ganador: finalGanador ? (finalGanador === 1 ? NARUTO : LUFFY) : null,
    totalVotos: finalReady ? 7 : 0,
  }
  return [semi1, semi2, final]
}

function renderBracket(props: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <Bracket
        enfrentamientos={brackets({})}
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

describe('Bracket (árbol de cuerdas) — contrato de DTOs', () => {
  afterEach(cleanup)

  it('pinta las etiquetas de ronda correctas (kanji incluido)', () => {
    renderBracket({})
    // 2 rondas → Semifinal / Final + columna Campeón.
    expect(screen.getByRole('heading', { name: 'Semifinal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Final' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Campeón' })).toBeInTheDocument()
    const kanjis = screen.getAllByTestId('kanji').map((el) => el.textContent)
    expect(kanjis).toContain('準決勝') // semifinal
    expect(kanjis).toContain('決勝') // final
    expect(kanjis).toContain('王者') // campeón
  })

  it('NO inventa ganadores: un match futuro sin personajes no marca ganador', () => {
    renderBracket({})
    // La final aún no tiene participantes → placa "Por decidir", sin 勝.
    const placas = document.querySelectorAll('[data-rope-match]')
    expect(placas.length).toBe(3) // 2 semis + 1 final
    // Nadie tiene la marca de victoria 勝 todavía (CSS ::after via clase).
    expect(document.querySelector('.rb-nombre--gana')).toBeNull()
    // El campeón sigue "Por decidir" (sin ganadorSlug, sin final resuelta) —
    // aparece en la placa final (ambos lados) y en el hueco del campeón.
    expect(screen.getAllByText('Por decidir').length).toBeGreaterThan(0)
    expect(screen.queryByRole('group', { name: /Campeón del torneo/ })).toBeNull()
  })

  it('marca al ganador SOLO cuando el DTO trae ganador', () => {
    renderBracket({ enfrentamientos: brackets({ semi1Ganador: 1 }) })
    // Naruto ganó la semi1 → su nombre lleva la clase de victoria.
    const ganadores = [...document.querySelectorAll('.rb-nombre--gana')]
    expect(ganadores.length).toBe(1)
    expect(ganadores[0].textContent).toBe('Naruto')
    // Sasuke (perdedor) lleva la clase de derrota.
    expect(document.querySelector('.rb-nombre--pierde')?.textContent).toBe('Sasuke')
  })

  it('el campeón sale con ganadorSlug aunque la final no traiga ganador inline', () => {
    renderBracket({
      enfrentamientos: brackets({ semi1Ganador: 1, finalReady: true }),
      ganadorSlug: 'naruto',
      estado: 'FINISHED',
    })
    const champ = screen.getByRole('group', { name: 'Campeón del torneo: Naruto' })
    expect(champ).toBeInTheDocument()
    expect(within(champ).getByText('Naruto')).toBeInTheDocument()
  })

  it('reveal en vivo: un re-render sin-ganador→con-ganador marca SOLO el nuevo, no el histórico', () => {
    vi.useFakeTimers()
    try {
      // Estado inicial: semi1 YA resuelta al montar (histórico).
      const { rerender } = render(
        <MemoryRouter>
          <Bracket
            enfrentamientos={brackets({ semi1Ganador: 1 })}
            ganadorSlug={null}
            totalRondas={2}
            torneoId={99}
            torneoSlug="copa-test"
            estado="IN_PROGRESS"
          />
        </MemoryRouter>,
      )
      // Flush de la medición de geometría (rAF + backstop 80ms) para que la
      // capa de cuerdas pinte sus <g>. Al montar, ningún match está "vivo"
      // (no hay diff sin-ganador→con-ganador): cero cuerdas reveladas.
      act(() => { vi.advanceTimersByTime(120) })
      expect(document.querySelectorAll('.rb-edge').length).toBeGreaterThan(0)
      expect(document.querySelector('.rb-edge--viva')).toBeNull()

      // Ahora llega por STOMP la resolución de la semi2 (id 11). El histórico
      // (semi1, id 10) NO debe re-coreografiar; solo la 11.
      const next = brackets({ semi1Ganador: 1 })
      next[1] = { ...next[1], ganador: LUFFY }
      rerender(
        <MemoryRouter>
          <Bracket
            enfrentamientos={next}
            ganadorSlug={null}
            totalRondas={2}
            torneoId={99}
            torneoSlug="copa-test"
            estado="IN_PROGRESS"
          />
        </MemoryRouter>,
      )
      act(() => { vi.advanceTimersByTime(120) })

      // Exactamente UNA cuerda viva (la 1:1 → final), el histórico no revive.
      const vivas = document.querySelectorAll('.rb-edge--viva')
      expect(vivas.length).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
