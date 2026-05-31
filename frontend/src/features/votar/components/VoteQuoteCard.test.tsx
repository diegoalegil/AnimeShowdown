import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import VoteQuoteCard from './VoteQuoteCard'
import {
  buildVoteQuoteShareText,
  buildVoteQuoteShareUrl,
} from './voteQuoteCardUtils'
import { shareOrCopy } from '../../../lib/share'

vi.mock('../../../components/PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} data-testid="personaje-img" />,
}))

vi.mock('../../../lib/share', () => ({
  shareOrCopy: vi.fn().mockResolvedValue('clipboard'),
}))

vi.mock('../../../lib/dailyProgress', () => ({
  recordDailyShare: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const personaje = {
  id: 1,
  slug: 'luffy',
  nombre: 'Luffy',
  anime: 'One Piece',
  imagen: '/img/one-piece/luffy.webp',
}

const rival = {
  id: 2,
  slug: 'zoro',
  nombre: 'Zoro',
  anime: 'One Piece',
}

const intencion = {
  id: 'poder',
  label: 'Poder',
  emoji: '💥',
  tono: 'orange',
}

let originalDescriptors: Record<string, PropertyDescriptor | undefined>

function installCanvasMocks() {
  originalDescriptors = {
    getContext: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext'),
    toBlob: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob'),
    toDataURL: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toDataURL'),
  }
  const gradient = { addColorStop: vi.fn() }
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    measureText: vi.fn((text: string) => ({ width: text.length * 14 })),
  }
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ctx),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn((callback) => callback(new Blob(['png'], { type: 'image/png' }))),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: vi.fn(() => 'data:image/png;base64,quote'),
  })
}

function restoreCanvasMocks() {
  for (const [name, descriptor] of Object.entries(originalDescriptors)) {
    if (descriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, name, descriptor)
    } else {
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>)[name]
    }
  }
}

beforeEach(() => {
  installCanvasMocks()
  vi.stubGlobal('Image', class {
    width = 400
    height = 600
    naturalWidth = 400
    naturalHeight = 600
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0)
    }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  restoreCanvasMocks()
})

describe('VoteQuoteCard', () => {
  it('construye el texto y enlace con personaje, rival y motivo', () => {
    expect(buildVoteQuoteShareText(personaje, intencion)).toBe(
      'Voté a Luffy por: Poder. ¿Tú a quién subirías?',
    )
    expect(buildVoteQuoteShareUrl(personaje, rival)).toBe('/votar?personaje=luffy&rival=zoro')
  })

  it('genera una tarjeta 1200x630 y comparte el quote con el motivo', async () => {
    render(<VoteQuoteCard personaje={personaje} rival={rival} intencion={intencion} />)

    expect(screen.getByText('Voté a Luffy por: Poder')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /generar tarjeta/i }))

    await waitFor(() => {
      expect(screen.getByAltText('Tarjeta de voto por Luffy')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /compartir tarjeta/i }))

    await waitFor(() => {
      expect(shareOrCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Voté a Luffy por: Poder. ¿Tú a quién subirías?',
          url: '/votar?personaje=luffy&rival=zoro',
        }),
      )
    })
  })
})
