#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'frontend/dist')
const BASE_URL = 'https://animeshowdown.dev'
// Las imágenes OG dinámicas las sirve el API (no el front): /api/og vive en
// api.animeshowdown.dev. Mismo criterio que useSeo.absolutizar en el cliente.
const API_BASE_URL = 'https://api.animeshowdown.dev'
const BRAND_TITLE = 'AnimeShowdown'

const INDEX_PATH = join(DIST, 'index.html')
const seedPath = join(ROOT, 'backend/src/main/resources/personajes-seed.json')

if (!existsSync(INDEX_PATH)) {
  throw new Error(`No existe ${INDEX_PATH}. Ejecuta vite build antes de prerender-seo.mjs.`)
}

const baseHtml = readFileSync(INDEX_PATH, 'utf8')
const personajes = JSON.parse(readFileSync(seedPath, 'utf8'))
  .map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    anime: p.anime,
    imagen: p.imagenUrl ?? p.imagen,
  }))
const personajesPorSlug = new Map(personajes.map((p) => [p.slug, p]))
const animes = [...new Set(personajes.map((p) => p.anime))].sort()

const versusCurados = [
  ['luffy', 'naruto'],
  ['goku', 'saitama'],
  ['light_yagami', 'l'],
  ['zoro', 'itachi'],
  ['kaneki', 'eren_yeager'],
]
  .map(([a, b]) => [personajesPorSlug.get(a), personajesPorSlug.get(b)])
  .filter(([a, b]) => a && b)

const POPULARIDAD_DESTACADA = {
  luffy: 100,
  goku: 100,
  naruto: 91,
  zoro: 95,
  light_yagami: 93,
  l: 98,
  saitama: 95,
  itachi: 88,
  kaneki: 82,
  sukuna: 65,
}

const staticRoutes = [
  {
    path: '/',
    title: 'AnimeShowdown — Torneos de personajes de anime',
    description:
      'Más de 1000 personajes anime, ranking ELO en directo y brackets visuales. Vota a tus favoritos y mueve el meta cada semana.',
    // OG dinámico de la portada (tarjeta rica con top 5 personajes) en vez del
    // logo plano → más CTR al compartir animeshowdown.dev.
    image: `${API_BASE_URL}/api/og/home.png`,
    jsonLd: [
      webSiteSchema(),
      webPageSchema('/', 'AnimeShowdown', 'Plataforma de duelos, rankings ELO y torneos anime.'),
    ],
  },
  {
    path: '/ranking',
    title: 'Ranking anime ELO · AnimeShowdown',
    description:
      'Top de personajes anime ordenado por senales competitivas, votos y ELO base en AnimeShowdown.',
    jsonLd: [itemListSchema('/ranking', 'Top personajes anime', topGlobal(10))],
  },
  {
    path: '/personajes',
    title: 'Personajes anime · AnimeShowdown',
    description:
      'Catalogo indexable de personajes anime con ficha, imagen, universo y ranking ELO de AnimeShowdown.',
    jsonLd: [collectionSchema('/personajes', 'Catalogo de personajes anime')],
  },
  {
    path: '/animes',
    title: 'Animes y universos · AnimeShowdown',
    description:
      'Universos anime con roster, top 10 ELO y duelos destacados dentro de AnimeShowdown.',
    jsonLd: [collectionSchema('/animes', 'Universos anime en AnimeShowdown')],
  },
  {
    path: '/comparar',
    title: 'Comparar personajes anime · AnimeShowdown',
    description:
      'Crea un versus entre dos personajes anime y compara ELO, popularidad y senales de la comunidad.',
    jsonLd: [webPageSchema('/comparar', 'Comparar personajes anime', 'Comparador de personajes anime por ELO y votos.')],
  },
  {
    path: '/votar',
    title: 'Votar duelos anime · AnimeShowdown',
    description:
      'Arena de duelos anime: elige ganadores, mueve el ranking ELO y descubre nuevos enfrentamientos.',
    jsonLd: [webPageSchema('/votar', 'Votar duelos anime', 'Arena publica para votar duelos de personajes anime.')],
  },
  {
    path: '/games',
    title: 'Juegos anime · AnimeShowdown',
    description:
      'Juegos diarios de AnimeShowdown: Shadow Guess, Anime Reveal, AniGrid, Impostor Trial y ELO Duel.',
    jsonLd: [collectionSchema('/games', 'Juegos anime online')],
  },
  {
    path: '/juegos/anime',
    title: 'Juegos anime online · AnimeShowdown',
    description:
      'Juegos anime online con retos diarios, ranking, ELO Duel y pruebas de conocimiento otaku.',
    jsonLd: [collectionSchema('/juegos/anime', 'Juegos anime online')],
  },
]

const animeRoutes = animes.flatMap((anime) => {
  const slug = slugifyAnime(anime)
  const top10 = topAnime(anime, 10)
  return [
    {
      path: `/animes/${slug}`,
      title: `${anime} · personajes y top 10 · AnimeShowdown`,
      description: `${anime} en AnimeShowdown: roster, personajes destacados, top 10 ELO y duelos internos del universo.`,
      image: top10[0]?.imagen,
      jsonLd: [
        webPageSchema(`/animes/${slug}`, `${anime} en AnimeShowdown`, `Roster y top 10 de ${anime}.`),
        itemListSchema(`/animes/${slug}`, `Top 10 ${anime}`, top10),
      ],
    },
    {
      path: `/animes/${slug}/ranking`,
      title: `Ranking ${anime} · Top 10 ELO · AnimeShowdown`,
      description: `Top 10 de ${anime} en AnimeShowdown con personajes destacados y senales ELO indexables.`,
      image: top10[0]?.imagen,
      jsonLd: [itemListSchema(`/animes/${slug}/ranking`, `Ranking ${anime}`, top10)],
    },
  ]
})

const versusRoutes = versusCurados.map(([a, b]) => ({
  path: `/versus/${a.slug}-vs-${b.slug}`,
  title: `${a.nombre} vs ${b.nombre} · AnimeShowdown`,
  description: `Comparativa indexable entre ${a.nombre} (${a.anime}) y ${b.nombre} (${b.anime}) con ELO, popularidad y duelo abierto.`,
  image: a.imagen,
  jsonLd: [versusSchema(a, b)],
}))

const routes = [...staticRoutes, ...animeRoutes, ...versusRoutes]

for (const route of routes) {
  writeRoute(route, renderRoute(route))
}

console.log(`✅ SEO prerender generado: ${routes.length} rutas HTML iniciales`)
console.log(`   - ${staticRoutes.length} rutas base`)
console.log(`   - ${animeRoutes.length} rutas de anime/top 10`)
console.log(`   - ${versusRoutes.length} versus curados`)

function writeRoute(route, html) {
  if (route.path === '/') {
    writeFileSync(INDEX_PATH, html)
    return
  }
  const dir = join(DIST, route.path.replace(/^\/+/, ''))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
}

function renderRoute(route) {
  const canonical = `${BASE_URL}${route.path === '/' ? '/' : route.path}`
  const title = route.title
  const description = route.description
  const image = absolutizar(route.image ?? '/logo.webp')
  const graph = Array.isArray(route.jsonLd) ? route.jsonLd : [route.jsonLd]

  let html = baseHtml
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(title)}</title>`)
  html = setMetaName(html, 'description', description)
  html = setMetaProperty(html, 'og:title', title)
  html = setMetaProperty(html, 'og:description', description)
  html = setMetaProperty(html, 'og:type', 'website')
  html = setMetaProperty(html, 'og:image', image)
  html = setMetaProperty(html, 'og:url', canonical)
  html = setMetaName(html, 'twitter:title', title)
  html = setMetaName(html, 'twitter:description', description)
  html = setMetaName(html, 'twitter:image', image)
  html = setLinkRel(html, 'canonical', canonical)
  html = stripHreflang(html)
  html = setJsonLd(html, {
    '@context': 'https://schema.org',
    '@graph': graph.filter(Boolean),
  })
  return html
}

function topGlobal(limit) {
  return [...personajes]
    .sort((a, b) => estimatedElo(b.slug) - estimatedElo(a.slug) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limit)
}

function topAnime(anime, limit) {
  return personajes
    .filter((p) => p.anime === anime)
    .sort((a, b) => estimatedElo(b.slug) - estimatedElo(a.slug) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limit)
}

function estimatedElo(slug) {
  const popularidad = POPULARIDAD_DESTACADA[slug] ?? 30
  return 1500 + popularidad * 7 + (hashSlug(slug) % 16 - 8)
}

function hashSlug(slug) {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (h << 5) - h + slug.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function slugifyAnime(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function webSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: BRAND_TITLE,
    url: `${BASE_URL}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/personajes?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

function webPageSchema(path, name, description) {
  return {
    '@type': 'WebPage',
    '@id': `${BASE_URL}${path}#webpage`,
    name,
    description,
    url: `${BASE_URL}${path}`,
    isPartOf: { '@id': `${BASE_URL}/#website` },
  }
}

function collectionSchema(path, name) {
  return {
    '@type': 'CollectionPage',
    '@id': `${BASE_URL}${path}#collection`,
    name,
    url: `${BASE_URL}${path}`,
    isPartOf: { '@id': `${BASE_URL}/#website` },
  }
}

function itemListSchema(path, name, items) {
  return {
    '@type': 'ItemList',
    '@id': `${BASE_URL}${path}#top10`,
    name,
    url: `${BASE_URL}${path}`,
    itemListElement: items.map((p, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${BASE_URL}/personajes/${p.slug}`,
      name: p.nombre,
      item: {
        '@type': 'Person',
        name: p.nombre,
        image: absolutizar(p.imagen),
        memberOf: {
          '@type': 'TVSeries',
          name: p.anime,
        },
      },
    })),
  }
}

function versusSchema(a, b) {
  return {
    '@type': 'WebPage',
    '@id': `${BASE_URL}/versus/${a.slug}-vs-${b.slug}#webpage`,
    name: `${a.nombre} vs ${b.nombre}`,
    description: `Comparativa entre ${a.nombre} y ${b.nombre} en AnimeShowdown.`,
    url: `${BASE_URL}/versus/${a.slug}-vs-${b.slug}`,
    about: [a, b].map((p) => ({
      '@type': 'Person',
      name: p.nombre,
      image: absolutizar(p.imagen),
      memberOf: {
        '@type': 'TVSeries',
        name: p.anime,
      },
    })),
    isPartOf: { '@id': `${BASE_URL}/#website` },
  }
}

function absolutizar(path) {
  if (!path) return `${BASE_URL}/logo.webp`
  if (/^https?:\/\//.test(path)) return path
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

function setMetaName(html, name, content) {
  return replaceOrInsert(
    html,
    new RegExp(`<meta\\s+[^>]*name=["']${escapeRegExp(name)}["'][^>]*>`, 'i'),
    `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}" />`,
  )
}

function setMetaProperty(html, property, content) {
  return replaceOrInsert(
    html,
    new RegExp(`<meta\\s+[^>]*property=["']${escapeRegExp(property)}["'][^>]*>`, 'i'),
    `<meta property="${escapeAttr(property)}" content="${escapeAttr(content)}" />`,
  )
}

function setLinkRel(html, rel, href) {
  return replaceOrInsert(
    html,
    new RegExp(`<link\\s+[^>]*rel=["']${escapeRegExp(rel)}["'][^>]*>`, 'i'),
    `<link rel="${escapeAttr(rel)}" href="${escapeAttr(href)}" />`,
  )
}

function setJsonLd(html, schema) {
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')
  const tag = `<script type="application/ld+json" id="seo-prerender-jsonld">${json}</script>`
  return replaceOrInsert(
    html,
    /<script\s+[^>]*id=["']seo-prerender-jsonld["'][\s\S]*?<\/script>/i,
    tag,
  )
}

function stripHreflang(html) {
  return html.replace(/\s*<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>\n?/gi, '')
}

function replaceOrInsert(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value) {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
