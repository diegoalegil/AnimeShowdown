import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PressSheet from './PressSheet'

// El SoundContext sólo aporta play() (respeta el mute global). En tests no nos
// interesa el audio: lo mockeamos a un no-op para no arrastrar AudioContext.
vi.mock('../contexts/SoundContext', () => ({
  useSoundOptional: () => ({ play: vi.fn(), muted: true, toggleMute: vi.fn(), warm: vi.fn() }),
}))

/* happy-dom no trae matchMedia: lo stubeamos. Forzamos reduced-motion para que
   el revelado salte el cover animado y pase directo a 'ready' (determinista),
   y que el modo nativo dependa sólo de navigator.share (que stubeamos por test). */
function stubMatchMedia({ reduce = true }: { reduce?: boolean } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const CONTEXTO = {
  titulo: 'Mi Top 5 anime',
  texto: 'Mi Top 5 anime en AnimeShowdown',
  url: '/mi-top5?add=luffy',
  alt: 'Tu top 5: 1. Luffy',
  fileName: 'animeshowdown-mi-top5.png',
  dims: [1200, 630] as [number, number],
}

function painterOk() {
  return Promise.resolve(new Blob(['png-bytes'], { type: 'image/png' }))
}

function Harness({
  painter = painterOk,
  contexto = CONTEXTO,
  onShared = () => {},
}: {
  painter?: (() => Promise<Blob>) | undefined
  contexto?: typeof CONTEXTO | { titulo: string; texto: string; url: string; alt: string; fileName: string }
  onShared?: (via: string) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div id="root">
      <PressSheet
        open={open}
        onClose={() => setOpen(false)}
        painter={painter}
        contexto={contexto as never}
        onShared={onShared}
      />
    </div>
  )
}

describe('PressSheet (la hoja de impresión — shell único de compartir)', () => {
  beforeEach(() => {
    stubMatchMedia()
    vi.stubGlobal('open', vi.fn())
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-1')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    // clipboard.writeText resoluble
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    // sin navigator.share por defecto (modo grid 2×2)
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('abre → pinta (painter→Blob) → muestra la preview con el alt del contexto', async () => {
    render(<Harness />)
    const img = await screen.findByAltText('Tu top 5: 1. Luffy')
    expect(img).toHaveAttribute('src', 'blob:preview-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('NADA sale sin click: ni window.open ni clipboard se llaman al abrir', async () => {
    render(<Harness />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('copiar escribe el enlace ABSOLUTO al portapapeles e instrumenta via=copy', async () => {
    const onShared = vi.fn()
    render(<Harness onShared={onShared} />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    fireEvent.click(screen.getByRole('button', { name: /Copiar el enlace al portapapeles/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    const copiado = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copiado).toMatch(/\/mi-top5\?add=luffy$/)
    expect(copiado).toMatch(/^https?:\/\//)
    expect(onShared).toHaveBeenCalledWith('copy')
  })

  it('X abre el intent con texto+enlace SÓLO al click e instrumenta via=x', async () => {
    const onShared = vi.fn()
    render(<Harness onShared={onShared} />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    fireEvent.click(screen.getByRole('button', { name: /Compartir en X/i }))
    expect(window.open).toHaveBeenCalledTimes(1)
    const urlAbierta = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(urlAbierta).toContain('x.com/intent/post')
    // URLSearchParams codifica el espacio como '+': normalizamos antes de mirar.
    const textoDecodificado = decodeURIComponent(urlAbierta.replace(/\+/g, ' '))
    expect(textoDecodificado).toContain('Mi Top 5 anime en AnimeShowdown')
    expect(textoDecodificado).toContain('/mi-top5?add=luffy')
    expect(onShared).toHaveBeenCalledWith('x')
  })

  it('WhatsApp abre wa.me con texto+enlace e instrumenta via=whatsapp', async () => {
    const onShared = vi.fn()
    render(<Harness onShared={onShared} />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    fireEvent.click(screen.getByRole('button', { name: /Compartir por WhatsApp/i }))
    const urlAbierta = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(urlAbierta).toContain('wa.me')
    expect(onShared).toHaveBeenCalledWith('whatsapp')
  })

  it('descargar usa el fileName del contexto e instrumenta via=download', async () => {
    const onShared = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Harness onShared={onShared} />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    fireEvent.click(screen.getByRole('button', { name: /Descargar la imagen como PNG/i }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(onShared).toHaveBeenCalledWith('download')
    expect(screen.getByText(/animeshowdown-mi-top5\.png/)).toBeInTheDocument()
  })

  it('modo Web Share nativa: la primaria llama navigator.share e instrumenta via=native', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const onShared = vi.fn()
    render(<Harness onShared={onShared} />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    fireEvent.click(screen.getByRole('button', { name: /compartir…/i }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(onShared).toHaveBeenCalledWith('native')
  })

  it('error del painter: muestra el mensaje y reintenta bajo demanda', async () => {
    let intentos = 0
    const painter = vi.fn(() => {
      intentos += 1
      return intentos === 1
        ? Promise.reject(new Error('toBlob devolvió null'))
        : painterOk()
    })
    render(<Harness painter={painter} />)
    expect(await screen.findByText('toBlob devolvió null')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reintentar el lienzo/i }))
    expect(await screen.findByAltText('Tu top 5: 1. Luffy')).toBeInTheDocument()
    expect(painter).toHaveBeenCalledTimes(2)
  })

  it('al cerrar revoca la object URL creada (sin fugas)', async () => {
    render(<Harness />)
    await screen.findByAltText('Tu top 5: 1. Luffy')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    })
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1'))
  })

  it('flujo sin painter (sólo texto+enlace): sin preview, copiar sigue vivo', async () => {
    const onShared = vi.fn()
    render(
      <Harness
        painter={undefined}
        contexto={{
          titulo: 'Top personajes de One Piece',
          texto: 'Mi top 5 de One Piece',
          url: '/animes/one-piece',
          alt: '',
          fileName: 'animeshowdown-one-piece.png',
        }}
        onShared={onShared}
      />,
    )
    // No hay zona de imagen ni se crea object URL.
    expect(screen.queryByRole('img')).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Copiar el enlace al portapapeles/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    expect(onShared).toHaveBeenCalledWith('copy')
  })
})
