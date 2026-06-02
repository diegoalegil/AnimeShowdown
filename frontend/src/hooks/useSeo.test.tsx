import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

import { useSeo } from './useSeo'

function SeoProbe({ hreflang = false }: { hreflang?: boolean | string[] }) {
  useSeo({
    title: 'Ruta SEO',
    description: 'Descripcion SEO de prueba',
    canonical: 'https://animeshowdown.dev/ruta-seo',
    hreflang,
  })
  return null
}

afterEach(() => {
  cleanup()
  document.head.querySelectorAll('link[rel="alternate"]').forEach((el) => el.remove())
  document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove())
})

describe('useSeo hreflang honesto', () => {
  it('no emite alternates por defecto en rutas con copy no traducido', async () => {
    render(<SeoProbe />)

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://animeshowdown.dev/ruta-seo',
      )
    })
    expect(document.head.querySelector('link[rel="alternate"]')).toBeNull()
  })

  it('permite alternates solo cuando la ruta lo pide explicitamente', async () => {
    render(<SeoProbe hreflang={['es', 'en']} />)

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="alternate"][hreflang="es"]')).toHaveAttribute(
        'href',
        'https://animeshowdown.dev/ruta-seo?lang=es',
      )
    })
    expect(document.head.querySelector('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      'https://animeshowdown.dev/ruta-seo?lang=en',
    )
    expect(document.head.querySelector('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      'https://animeshowdown.dev/ruta-seo?lang=es',
    )
  })
})
