import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { TasteMirrorScene } from './TasteMirror'

// Espiamos brandImage para verificar CON QUÉ NOMBRE se pide la escena: el bug
// confirmado pedía el slug de PERSONAJE (universoTop.slug); ahora debe pedir el
// slug del ANIME derivado de universoTop.anime vía slugifyAnime.
const brandImage = vi.fn((name: string) => ({
  src: `https://cdn/${name}.webp`,
  srcSet: `https://cdn/${name}-1280.webp 1280w`,
  widths: [1280],
}))
vi.mock('../../lib/brand-assets', () => ({
  brandImage: (name: string) => brandImage(name),
}))

afterEach(() => {
  cleanup()
  brandImage.mockClear()
})

describe('TasteMirrorScene · resolución del arte de marca', () => {
  it('pide la escena con el slug del ANIME, no el del personaje', () => {
    render(<TasteMirrorScene universoTop={{ anime: 'One Piece', slug: 'monkey-d-luffy', pct: 70 }} />)
    expect(brandImage).toHaveBeenCalledWith('one-piece-scene-01')
    expect(brandImage).not.toHaveBeenCalledWith('monkey-d-luffy-scene-01')
  })

  it('renderiza la imagen de marca resuelta cuando el anime existe', () => {
    const { container } = render(
      <TasteMirrorScene universoTop={{ anime: 'Dragon Ball', slug: 'goku', pct: 50 }} />,
    )
    expect(brandImage).toHaveBeenCalledWith('dragon-ball-scene-01')
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://cdn/dragon-ball-scene-01.webp')
  })

  it('cae al gradiente de respaldo (sin img) cuando no hay anime', () => {
    const { container } = render(<TasteMirrorScene universoTop={{ anime: '', slug: 'x', pct: 0 }} />)
    expect(brandImage).not.toHaveBeenCalled()
    expect(container.querySelector('img')).toBeNull()
  })
})
