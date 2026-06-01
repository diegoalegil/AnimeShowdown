import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSeo } from './useSeo'

function SeoProbe(props: Parameters<typeof useSeo>[0]) {
  useSeo(props)
  return <div>seo probe</div>
}

function alternateLinks() {
  return Array.from(document.head.querySelectorAll('link[rel="alternate"]'))
    .map((link) => ({
      hreflang: link.getAttribute('hreflang'),
      href: link.getAttribute('href'),
    }))
    .sort((a, b) => String(a.hreflang).localeCompare(String(b.hreflang)))
}

afterEach(() => {
  document.head.querySelectorAll('link[rel="alternate"]').forEach((link) => link.remove())
})

describe('useSeo hreflang', () => {
  it('no emite alternates por defecto para rutas con traducción parcial', () => {
    render(
      <SeoProbe
        title="Votar"
        canonical="https://animeshowdown.dev/votar"
      />,
    )

    expect(alternateLinks()).toEqual([])
  })

  it('emite alternates solo cuando la ruta se declara localizada', () => {
    const { unmount } = render(
      <SeoProbe
        title="Torneos"
        canonical="https://animeshowdown.dev/torneos"
        hreflang
      />,
    )

    expect(alternateLinks()).toEqual([
      { hreflang: 'en', href: 'https://animeshowdown.dev/torneos?lang=en' },
      { hreflang: 'es', href: 'https://animeshowdown.dev/torneos?lang=es' },
      { hreflang: 'ja', href: 'https://animeshowdown.dev/torneos?lang=ja' },
      { hreflang: 'x-default', href: 'https://animeshowdown.dev/torneos?lang=es' },
    ])

    unmount()
    expect(alternateLinks()).toEqual([])
  })

  it('no emite alternates en noindex aunque se pidan', () => {
    render(
      <SeoProbe
        title="Mi perfil"
        canonical="https://animeshowdown.dev/perfil"
        hreflang
        noindex
      />,
    )

    expect(alternateLinks()).toEqual([])
  })
})
