import { describe, expect, it } from 'vitest'
import { organizationSchema, webSiteSchema } from './schema'

const SITIO = 'https://animeshowdown.dev'

describe('organizationSchema', () => {
  it('describe la entidad de marca con name, url, logo absoluto e @id estable', () => {
    const schema = organizationSchema()

    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Organization')
    expect(schema['@id']).toBe(`${SITIO}/#organization`)
    expect(schema.name).toBe('AnimeShowdown')
    expect(schema.url).toBe(SITIO)
    // El logo debe ser una URL absoluta para que Google lo resuelva en el SERP.
    expect(schema.logo).toBe(`${SITIO}/logo.webp`)
    expect(schema.description).toMatch(/anime/i)
  })

  it('no emite un sameAs vacío (ensuciaría la validación de rich results)', () => {
    expect('sameAs' in organizationSchema()).toBe(false)
  })
})

describe('webSiteSchema', () => {
  it('mantiene el SearchAction (sitelinks search box) intacto', () => {
    const schema = webSiteSchema()
    expect(schema['@type']).toBe('WebSite')
    expect(schema.potentialAction['@type']).toBe('SearchAction')
    expect(schema.potentialAction.target).toContain('/personajes?q={search_term_string}')
  })
})
