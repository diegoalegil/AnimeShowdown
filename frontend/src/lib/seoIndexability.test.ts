import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), '..')

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('SEO indexable', () => {
  it('ejecuta prerender SEO despues del build de Vite', () => {
    const pkg = JSON.parse(read('frontend/package.json'))

    expect(pkg.scripts.build).toContain('node ../scripts/prerender-seo.mjs')
    expect(pkg.scripts['build:no-images']).toContain('node ../scripts/prerender-seo.mjs')
  })

  it('publica versus canonicos y no mete paginas locales en sitemap', () => {
    const sitemap = read('scripts/generate-sitemap.mjs')
    const app = read('frontend/src/App.jsx')
    const redirects = read('frontend/public/_redirects')

    expect(sitemap).toContain('/versus/${a.slug}-vs-${b.slug}')
    expect(sitemap).not.toContain("{ path: '/mi-ranking'")
    expect(sitemap).not.toContain("{ path: '/mi-top5'")
    expect(app).toContain('<Route path="/versus/:par"')
    expect(redirects).toContain('/versus/:par')
  })

  it('materializa HTML con canonical y JSON-LD en rutas prerenderizadas', () => {
    const prerender = read('scripts/prerender-seo.mjs')

    expect(prerender).toContain('seo-prerender-jsonld')
    expect(prerender).toContain("setLinkRel(html, 'canonical'")
    expect(prerender).toContain('/animes/${slug}/ranking')
    expect(prerender).toContain('/versus/${a.slug}-vs-${b.slug}')
  })
})
