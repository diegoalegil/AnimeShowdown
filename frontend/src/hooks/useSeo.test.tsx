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
  window.history.pushState(null, '', '/')
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

// La misma página se monta en /comparar y /en/comparar. La gemela pasa copy ES;
// en /en useSeo NO debe revertir las señales que el prerender dejó en inglés.
function EnMoneyProbe() {
  useSeo({
    title: 'Comparar personajes anime',
    description: 'Compara dos personajes anime en AnimeShowdown.',
    canonical: 'https://animeshowdown.dev/comparar',
  })
  return null
}

describe('useSeo EN-first money pages', () => {
  it('mantiene canonical self-referente, og:locale en_US y title EN en /en (no revierte a ES)', async () => {
    window.history.pushState(null, '', '/en/comparar')
    render(<EnMoneyProbe />)

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://animeshowdown.dev/en/comparar',
      )
    })
    expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US')
    expect(document.querySelector('meta[property="og:locale:alternate"]')).toHaveAttribute('content', 'es_ES')
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Compare anime characters · AnimeShowdown',
    )
    expect(document.title).toContain('Compare anime characters')
  })

  it('en la ruta ES gemela conserva el copy ES y og:locale es_ES', async () => {
    window.history.pushState(null, '', '/comparar')
    render(<EnMoneyProbe />)

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://animeshowdown.dev/comparar',
      )
    })
    expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute('content', 'es_ES')
  })
})
