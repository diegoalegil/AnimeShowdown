import assert from 'node:assert/strict'

import { animeSeriesSchema, breadcrumbsSchema, personajeSchema } from '../src/lib/schema.js'

const personaje = {
  slug: 'frieren',
  nombre: 'Frieren',
  anime: 'Sousou no Frieren',
  descripcion: 'Maga elfa incluida en el ranking competitivo de AnimeShowdown.',
  imagen: '/img/Sousou_no_Frieren/frieren.webp',
  sameAs: ['https://example.com/frieren'],
}

const schema = personajeSchema(
  personaje,
  { elo: 1842, wins: 19, losses: 7 },
  { rankGlobal: 12, rankAnime: 1, totalAnime: 8, totalCatalogo: 1086 },
)

assert.equal(schema['@context'], 'https://schema.org')
assert.equal(schema['@type'], 'Person')
assert.equal(schema['@id'], 'https://animeshowdown.dev/personajes/frieren#personaje')
assert.equal(schema.identifier, 'frieren')
assert.equal(schema.additionalType, 'https://schema.org/FictionalCharacter')
assert.equal(schema.mainEntityOfPage['@type'], 'WebPage')
assert.equal(schema.mainEntityOfPage.isPartOf.name, 'AnimeShowdown')
assert.equal(schema.affiliation['@type'], 'CreativeWorkSeries')
assert.equal(schema.affiliation.url, 'https://animeshowdown.dev/animes/sousou-no-frieren')
assert.equal(schema.potentialAction['@type'], 'VoteAction')
assert.equal(schema.potentialAction.target, 'https://animeshowdown.dev/votar?personaje=frieren')
assert.deepEqual(schema.sameAs, ['https://example.com/frieren'])

const propertyNames = schema.additionalProperty.map((property) => property.name)
assert.deepEqual(propertyNames, [
  'ELO base',
  'Votos registrados',
  'Ranking global ELO base',
  'Ranking en Sousou no Frieren',
])
assert.equal(schema.additionalProperty[1].value, 26)
assert.equal(schema.additionalProperty[2].unitText, '1086 personajes')
assert.equal(schema.additionalProperty[3].unitText, '8 personajes del anime')

const breadcrumb = breadcrumbsSchema([
  { label: 'Inicio', path: '/' },
  { label: 'Personajes', path: '/personajes' },
  { label: 'Frieren', path: '/personajes/frieren' },
])

assert.equal(breadcrumb['@type'], 'BreadcrumbList')
assert.equal(breadcrumb.itemListElement.length, 3)
assert.equal(
  breadcrumb.itemListElement[2].item,
  'https://animeshowdown.dev/personajes/frieren',
)

const anime = animeSeriesSchema({
  anime: 'Sousou no Frieren',
  slug: 'sousou-no-frieren',
  image: '/assets/anime-banners/sousou-no-frieren.webp',
  personajes: [personaje],
  total: 1,
  topElo: { nombre: 'Frieren', elo: 1842 },
  eloPromedio: 1842,
  aliases: ['frieren', 'sousou no frieren'],
})

assert.equal(anime['@type'], 'TVSeries')
assert.equal(anime['@id'], 'https://animeshowdown.dev/animes/sousou-no-frieren#anime')
assert.equal(anime.additionalType, 'https://schema.org/CreativeWorkSeries')
assert.equal(anime.identifier, 'sousou-no-frieren')
assert.equal(anime.mainEntityOfPage['@type'], 'WebPage')
assert.equal(anime.mainEntityOfPage.inLanguage, 'es-ES')
assert.equal(anime.alternateName.length, 2)
assert.equal(anime.character[0]['@id'], 'https://animeshowdown.dev/personajes/frieren#personaje')
assert.equal(anime.character[0].additionalType, 'https://schema.org/FictionalCharacter')
assert.equal(anime.additionalProperty[0].name, 'Personajes en AnimeShowdown')
assert.equal(anime.additionalProperty[1].name, 'ELO promedio base')
assert.equal(anime.additionalProperty[2].description, 'Frieren lidera el ELO base de Sousou no Frieren.')

const serialized = JSON.stringify([schema, breadcrumb, anime])
assert(!serialized.includes('undefined'))
assert(!serialized.includes('null'))
