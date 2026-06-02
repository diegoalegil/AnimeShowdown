import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CartaTile from './CartaTile'
import Top5Slot from '../features/miTop5/Top5Slot'

vi.mock('../features/cartas/CartaFace', () => ({
  default: () => <div data-testid="carta-face" />,
}))

vi.mock('./PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

describe('targets tactiles', () => {
  afterEach(cleanup)

  it('mantiene 44px para quitar un personaje del top', () => {
    render(
      <Top5Slot
        slug="luffy"
        personaje={{ nombre: 'Luffy', anime: 'One Piece', imagen: '/img/luffy.webp' }}
        index={0}
        onQuitar={() => {}}
      />,
    )

    const quitar = screen.getByRole('button', { name: /Quitar Luffy/i })
    expect(quitar).toHaveClass('h-11')
    expect(quitar).toHaveClass('w-11')
  })

  it('mantiene 44px para descargar cartas poseidas', () => {
    render(
      <CartaTile
        carta={{
          poseida: true,
          personajeNombre: 'Asuka',
          personajeSlug: 'asuka',
          rareza: 'SSR',
          anime: 'Evangelion',
        }}
        onDownload={() => {}}
      />,
    )

    const descargar = screen.getByRole('button', { name: /Descargar carta de Asuka/i })
    expect(descargar).toHaveClass('h-11')
    expect(descargar).toHaveClass('w-11')
  })
})
