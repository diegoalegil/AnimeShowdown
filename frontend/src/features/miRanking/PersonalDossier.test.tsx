import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — componente .jsx sin tipos
import PersonalDossier from './PersonalDossier'

const play = vi.fn()
vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

type Snapshot = { ranks: Record<string, number>; savedAt: number } | null

function makeStorage(snapshot: Snapshot = null, globalPref: boolean | null = null) {
  return {
    loadSnapshot: vi.fn(() => snapshot),
    saveSnapshot: vi.fn(),
    loadGlobalPref: vi.fn(() => globalPref),
    saveGlobalPref: vi.fn(),
  }
}

const ENTRIES = [
  { slug: 'luffy', name: 'Luffy', anime: 'One Piece', yourRank: 1, globalRank: 3 },
  { slug: 'zoro', name: 'Zoro', anime: 'One Piece', yourRank: 2, globalRank: null },
  { slug: 'nami', name: 'Nami', anime: 'One Piece', yourRank: 2, globalRank: 9 },
]

function renderDossier(props = {}, storage = makeStorage()) {
  const utils = render(
    <MemoryRouter>
      <PersonalDossier
        username="yuki"
        entries={ENTRIES}
        storage={storage}
        skipEntrance
        {...props}
      />
    </MemoryRouter>,
  )
  return { ...utils, storage }
}

// El mount lee storage dentro de un rAF: en jsdom lo volcamos a mano.
function flushRaf() {
  act(() => {
    vi.runOnlyPendingTimers()
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  play.mockClear()
})

describe('PersonalDossier', () => {
  it('pinta el expediente: h1 con el usuario, placas con puesto propio y global', () => {
    renderDossier()
    flushRaf()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El archivo de yuki')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Luffy')
    expect(items[0]).toHaveTextContent('global: 3º')
    expect(items[1]).toHaveTextContent('global: —')
  })

  it('empates 1224: marca "=" y muestra la regla al pie', () => {
    renderDossier()
    flushRaf()
    expect(screen.getAllByText('=').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(/comparten puesto y el siguiente número se omite/),
    ).toBeInTheDocument()
  })

  it('primera visita (snapshot null): bienvenida 印 y sin columna de deltas', () => {
    const { container } = renderDossier()
    flushRaf()
    expect(screen.getByText(/Tu archivo queda abierto/)).toBeInTheDocument()
    expect(container.querySelector('.pd-delta')).toBeNull()
  })

  it('con snapshot real calcula deltas: subida, bajada y nuevo', () => {
    const storage = makeStorage({ ranks: { luffy: 3, zoro: 1 }, savedAt: 1 })
    const { container } = renderDossier({}, storage)
    flushRaf()
    // luffy 3→1 sube; zoro 1→2 baja; nami no estaba → nuevo
    expect(container.querySelector('.pd-delta--up')).toHaveTextContent('▲2')
    expect(container.querySelector('.pd-delta--down')).toHaveTextContent('▼1')
    expect(container.querySelector('.pd-delta--new')).toHaveTextContent('nuevo')
  })

  it('el toggle global persiste la preferencia y oculta la columna', () => {
    const storage = makeStorage(null, true)
    const { container } = renderDossier({}, storage)
    flushRaf()
    expect(container.querySelector('.pd-global')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /la posición global/ }))
    expect(storage.saveGlobalPref).toHaveBeenCalledWith(false)
    expect(container.querySelector('.pd-global')).toBeNull()
    expect(play).toHaveBeenCalledWith('playClick')
  })

  it('al desmontar guarda el snapshot de ESTA sesión', () => {
    const { unmount, storage } = renderDossier()
    flushRaf()
    unmount()
    expect(storage.saveSnapshot).toHaveBeenCalledTimes(1)
    const snap = storage.saveSnapshot.mock.calls[0][0]
    expect(snap.ranks).toEqual({ luffy: 1, zoro: 2, nami: 2 })
    expect(typeof snap.savedAt).toBe('number')
  })

  it('vacío: 空, copy del banzuke y CTA a votar', () => {
    renderDossier({ entries: [] })
    flushRaf()
    expect(screen.getByText('Tu archivo está vacío')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Votar mi primer duelo' })).toHaveAttribute(
      'href',
      '/votar',
    )
  })

  it('el sello suena al aterrizar salvo skipEntrance', () => {
    renderDossier({ skipEntrance: false })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(play).toHaveBeenCalledWith('playVerdictStamp')
  })

  it('el voto reciente late UNA vez tras la entrada', () => {
    const { container } = renderDossier({ recentVoteSlug: 'luffy' })
    flushRaf()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(container.querySelector('.pd-plate--pulse [data-slug]')).toBeNull()
    expect(container.querySelector('.pd-plate--pulse')).toHaveAttribute('data-slug', 'luffy')
  })
})
