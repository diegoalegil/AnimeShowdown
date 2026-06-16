import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import ByobuGallery from './ByobuGallery'
import { SoundProvider } from '../contexts/SoundContext'

// ByobuGallery importa playWhoosh/playClack directamente de lib/sounds; se
// mockean para no tocar la Web Audio API en jsdom/happy-dom.
const soundsMock = vi.hoisted(() => ({
  playWhoosh: vi.fn(),
  playClack: vi.fn(),
}))
vi.mock('../lib/sounds', () => soundsMock)

const imgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://cdn.test/lamina-${i + 1}.jpg` }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ByobuGallery', () => {
  it('no pinta nada sin láminas (status ready, lista vacía)', () => {
    const { container } = render(<ByobuGallery images={[]} title="Luffy" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta la tira esqueleto mientras carga', () => {
    render(<ByobuGallery images={[]} title="Luffy" status="loading" />)
    expect(screen.getByText('cargando láminas…')).toBeInTheDocument()
  })

  it('en estado invitado muestra el copy de invitado', () => {
    render(
      <ByobuGallery
        images={[]}
        title="Luffy"
        status="guest"
        guestLabel="Inicia sesión para ver la galería."
      />,
    )
    expect(screen.getByText('Inicia sesión para ver la galería.')).toBeInTheDocument()
  })

  it('pinta una miniatura por lámina con su etiqueta accesible', () => {
    render(<ByobuGallery images={imgs(3)} title="Luffy" />)
    const thumbs = screen.getAllByRole('button', { name: /Abrir lámina/ })
    expect(thumbs).toHaveLength(3)
    expect(thumbs[0]).toHaveAttribute('aria-haspopup', 'dialog')
    expect(
      screen.getByRole('button', { name: 'Abrir lámina 2 de 3' }),
    ).toBeInTheDocument()
  })

  it('abre el visor al pulsar una miniatura (dialog + whoosh + contador)', () => {
    // Dentro de un SoundProvider real (no muteado) para que play('playWhoosh')
    // del gate resuelva sfx.playWhoosh (el spy mockeado) al abrir el visor.
    render(
      <SoundProvider>
        <ByobuGallery images={imgs(3)} title="Luffy" />
      </SoundProvider>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir lámina 1 de 3' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(soundsMock.playWhoosh).toHaveBeenCalledTimes(1)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })
})
