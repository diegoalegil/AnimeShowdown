import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ResponsivePicture from './ResponsivePicture'

const visualConSrcset = {
  image: '/assets/anime-banners/naruto-v2.webp',
  imageAvifSrcset:
    '/assets/anime-banners/naruto-v2-480.avif 480w, /assets/anime-banners/naruto-v2-768.avif 768w',
  imageWebpSrcset:
    '/assets/anime-banners/naruto-v2-480.webp 480w, /assets/anime-banners/naruto-v2-768.webp 768w',
  objectPosition: 'center top',
}

describe('ResponsivePicture', () => {
  it('sirve AVIF y WebP en <source> + <img> original como fallback', () => {
    const { container } = render(<ResponsivePicture visual={visualConSrcset} />)
    const sources = container.querySelectorAll('source')
    expect(sources).toHaveLength(2)
    expect(sources[0].getAttribute('type')).toBe('image/avif')
    expect(sources[0].getAttribute('srcset')).toContain('-480.avif 480w')
    expect(sources[1].getAttribute('type')).toBe('image/webp')
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/assets/anime-banners/naruto-v2.webp')
    expect(img.style.objectPosition).toBe('center top')
  })

  it('sin srcset cae a un <img> simple sin <source>', () => {
    const { container } = render(
      <ResponsivePicture src="/assets/brand/backgrounds/empty.webp" />,
    )
    expect(container.querySelectorAll('source')).toHaveLength(0)
    expect(container.querySelector('img')!.getAttribute('src')).toBe(
      '/assets/brand/backgrounds/empty.webp',
    )
  })

  it('propaga loading/fetchPriority para el LCP', () => {
    const { container } = render(
      <ResponsivePicture visual={visualConSrcset} loading="eager" fetchPriority="high" />,
    )
    const img = container.querySelector('img')!
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })

  it('no renderiza nada si no hay imagen', () => {
    const { container } = render(<ResponsivePicture visual={{}} />)
    expect(container.querySelector('picture')).toBeNull()
  })
})
