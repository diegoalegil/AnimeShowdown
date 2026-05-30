import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ProfileBanner from './ProfileBanner'

// REGLA #7 — el banner es identidad pura: nunca queda genérico. Si el usuario
// no subió banner, debe pintar el arte de su personaje favorito. Este test es
// determinista (sin red): si alguien rompe el orden del fallback, falla.

describe('ProfileBanner — fallback de identidad', () => {
  it('usa bannerUrl cuando existe', () => {
    const { container } = render(
      <ProfileBanner
        bannerUrl="https://cdn.test/banner.png"
        fallbackImagenUrl="https://cdn.test/favorito.webp"
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://cdn.test/banner.png')
  })

  it('cae al arte del favorito cuando no hay banner', () => {
    const { container } = render(
      <ProfileBanner
        bannerUrl={null}
        fallbackImagenUrl="https://cdn.test/favorito.webp"
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://cdn.test/favorito.webp')
  })

  it('sin banner ni favorito pinta el placeholder de marca (sin img rota)', () => {
    const { container } = render(
      <ProfileBanner bannerUrl={null} fallbackImagenUrl={null} />,
    )
    expect(container.querySelector('img')).toBeNull()
    // Hay un degradado de marca como fondo (no queda vacío/blanco).
    expect(container.querySelector('.bg-gradient-to-br')).not.toBeNull()
  })
})
