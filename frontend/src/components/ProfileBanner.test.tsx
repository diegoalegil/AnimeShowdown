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

  it('compone el arte sobre un fondo desenfocado de sí mismo (tratamiento cinematográfico)', () => {
    // Dos capas con la misma imagen: un fondo decorativo desenfocado (que
    // rellena cualquier proporción) y el arte focal visible con alt. Así una
    // carta vertical deja de recortarse a saco.
    const { container } = render(
      <ProfileBanner bannerUrl="https://cdn.test/carta.png" fallbackImagenUrl={null} />,
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(2)

    const fondo = container.querySelector('img[aria-hidden="true"]')
    expect(fondo?.className).toContain('blur')
    expect(fondo?.getAttribute('src')).toBe('https://cdn.test/carta.png')

    const focal = container.querySelector('img[alt="Banner de perfil"]')
    expect(focal).not.toBeNull()
    expect(focal?.getAttribute('src')).toBe('https://cdn.test/carta.png')
  })
})
