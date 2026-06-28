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
// CDN de imágenes del catálogo (mismo env que vite.config). En prod /img/* del
// front es solo un 302 al CDN; las og:image/JSON-LD de las fichas deben apuntar
// DIRECTO al CDN para no depender de ese redirect. Sin CDN configurado, se
// mantiene el comportamiento anterior (animeshowdown.dev/img → 302/local).
const IMG_CDN_BASE_URL = (
  process.env.ANIMESHOWDOWN_IMG_CDN_BASE_URL ||
  process.env.ANIMESHOWDOWN_IMAGE_CDN_BASE_URL ||
  ''
).trim().replace(/\/+$/, '')
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
    descripcion: p.descripcion,
  }))
const personajesPorSlug = new Map(personajes.map((p) => [p.slug, p]))
const animes = [...new Set(personajes.map((p) => p.anime))].sort()

const versusCurados = [
  ['luffy', 'naruto'],
  ['goku', 'saitama'],
  ['light_yagami', 'l'],
  ['zoro', 'itachi'],
  ['kaneki', 'eren_yeager'],
  // Matchups ICÓNICOS de alta búsqueda (curados, NO masivo: evitamos la granja
  // de contenido). Cada página tiene datos reales de comparación (ELO,
  // popularidad, señales de la comunidad) + OG propia + schema, así que es
  // contenido con sustancia, no doorway. Slugs verificados contra el seed.
  ['goku', 'naruto'],
  ['naruto', 'sasuke'],
  ['goku', 'vegeta'],
  ['satoru_gojo', 'sukuna'],
  ['luffy', 'zoro'],
  ['ichigo', 'naruto'],
  ['levi_ackerman', 'eren_yeager'],
  ['gon_freecss', 'killua_zoldyck'],
  ['madara', 'itachi'],
  ['saitama', 'sukuna'],
  ['tanjiro', 'zoro'],
  ['goku', 'luffy'],
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

// Fichas de personaje: el sitemap ya lista las 1086, pero al rastrearlas daban
// un #root vacío (cero contenido server-side). Ahora cada una se prerenderiza
// con meta + OG + canonical + JSON-LD ProfilePage/Person y un body SSR-light
// (nombre, universo, imagen, descripción + enlaces) inyectado en #root. La app
// monta con createRoot (CSR, no hydrate), así que React limpia ese body al
// arrancar para el usuario; los crawlers sin JS sí ven contenido indexable.
const personajeRoutes = personajes.map((p) => {
  const ficha = `/personajes/${p.slug}`
  const desc =
    p.descripcion && p.descripcion.trim().length > 40
      ? p.descripcion.trim()
      : `${p.nombre} es un personaje de ${p.anime}. En AnimeShowdown tiene ficha con imagen, universo, ranking ELO y duelos abiertos contra otros personajes anime.`
  return {
    path: ficha,
    title: `${p.nombre} · ${p.anime} · AnimeShowdown`,
    description: `${p.nombre} (${p.anime}) en AnimeShowdown: ELO, popularidad, duelos y ranking. ${desc}`.slice(0, 280),
    image: p.imagen,
    jsonLd: [personSchema(p)],
    seoBody: seoBodyFor(p, desc),
  }
})

// EN-first (Fase 1): variantes /en de las páginas money para captar búsqueda en
// inglés (el nicho "who would win / strongest" busca en EN). Genera la meta EN
// (title/description/og:locale) + hreflang recíproco es<->en. El shell ya está
// i18n'd (en.json completo); el cuerpo se traduce por fases. Reutiliza el JSON-LD
// (la señal de ranking principal es title/description en inglés).
const EN_COPY = {
  '/': {
    title: 'AnimeShowdown — Anime character battle tournaments',
    description: 'Over 1000 anime characters, live ELO ranking and visual brackets. Vote for your favorites and move the meta every week.',
  },
  '/ranking': {
    title: 'Anime ELO ranking · AnimeShowdown',
    description: 'Top anime characters ranked by competitive signals, community votes and base ELO on AnimeShowdown.',
  },
  '/personajes': {
    title: 'Anime characters · AnimeShowdown',
    description: 'Browsable catalog of anime characters with profile, image, universe and ELO ranking on AnimeShowdown.',
  },
  '/animes': {
    title: 'Anime universes · AnimeShowdown',
    description: 'Anime universes with their roster, ELO top 10 and featured duels inside AnimeShowdown.',
  },
  '/comparar': {
    title: 'Compare anime characters · AnimeShowdown',
    description: 'Build a versus between two anime characters and compare ELO, popularity and community signals.',
  },
  '/votar': {
    title: 'Vote anime duels · AnimeShowdown',
    description: 'Anime duel arena: pick the winners, move the ELO ranking and discover new matchups.',
  },
  '/games': {
    title: 'Anime games · AnimeShowdown',
    description: 'AnimeShowdown daily games: Shadow Guess, Anime Reveal, AniGrid, Impostor Trial and ELO Duel.',
  },
  '/juegos/anime': {
    title: 'Anime games online · AnimeShowdown',
    description: 'Online anime games with daily challenges, ranking, ELO Duel and otaku knowledge quizzes.',
  },
}

// Marca cada money page ES con su alternante EN y genera la variante /en.
for (const r of staticRoutes) {
  if (!EN_COPY[r.path]) continue
  r.lang = 'es'
  r.alt = { es: r.path, en: r.path === '/' ? '/en' : `/en${r.path}` }
}
const enStaticRoutes = staticRoutes
  .filter((r) => EN_COPY[r.path])
  .map((r) => ({
    path: r.alt.en,
    title: EN_COPY[r.path].title,
    description: EN_COPY[r.path].description,
    image: r.image,
    // Reusa el grafo ES pero declara el idioma del contenido como inglés: sin
    // inLanguage el JSON-LD de /en afirma implícitamente contenido ES y
    // contradice <html lang="en"> + og:locale en_US. Los tipos de las money
    // pages (WebSite/ItemList/CollectionPage/WebPage) soportan inLanguage.
    jsonLd: (Array.isArray(r.jsonLd) ? r.jsonLd : r.jsonLd ? [r.jsonLd] : []).map(
      (node) => ({ ...node, inLanguage: 'en' }),
    ),
    lang: 'en',
    alt: r.alt,
  }))

const routes = [...staticRoutes, ...enStaticRoutes, ...animeRoutes, ...versusRoutes, ...personajeRoutes]

for (const route of routes) {
  writeRoute(route, renderRoute(route))
}

console.log(`✅ SEO prerender generado: ${routes.length} rutas HTML iniciales`)
console.log(`   - ${staticRoutes.length} rutas base`)
console.log(`   - ${animeRoutes.length} rutas de anime/top 10`)
console.log(`   - ${versusRoutes.length} versus curados`)
console.log(`   - ${personajeRoutes.length} fichas de personaje (SSR-light)`)

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
  // og:locale por idioma de la ruta (antes clavado a es_ES en el HTML base).
  const lang = route.lang || 'es'
  // El template base declara <html lang="es">; en las variantes /en hay que
  // reescribir el atributo para no contradecir el title/og:locale/hreflang en
  // inglés (Google usa el lang del documento como señal del idioma de la página).
  html = html.replace(/(<html\b[^>]*\blang=["'])[^"']*(["'])/i, `$1${lang}$2`)
  html = setMetaProperty(html, 'og:locale',
    lang === 'en' ? 'en_US' : lang === 'ja' ? 'ja_JP' : 'es_ES')
  // hreflang recíproco solo en las páginas con alternante (money pages EN-first);
  // el resto sigue mono-idioma y se le quita cualquier alternate heredado.
  if (route.alt) {
    html = setMetaProperty(html, 'og:locale:alternate', lang === 'en' ? 'es_ES' : 'en_US')
    html = setHreflang(html, route.alt)
  } else {
    html = stripHreflang(html)
  }
  html = setJsonLd(html, {
    '@context': 'https://schema.org',
    '@graph': graph.filter(Boolean),
  })
  // SSR-light: inyecta contenido indexable en #root (solo rutas que lo aportan,
  // hoy las fichas). createRoot lo reemplaza al montar; sirve a crawlers sin JS.
  if (route.seoBody) {
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${route.seoBody}</div>`)
  }
  return html
}

// Orden de los "Top" prerenderizados: por POPULARIDAD curada (señal real y
// estable), no por un ELO sintético. Antes el orden lo decidía un estimatedElo
// con jitter de hash (ruido), que presentaba un orden arbitrario como si fuera
// el ranking competitivo real (riesgo de cloaking + el ItemList no publica el
// número de ELO, solo la posición). El ranking ELO real es server-side.
function popularidadDe(slug) {
  return POPULARIDAD_DESTACADA[slug] ?? 30
}

function topGlobal(limit) {
  return [...personajes]
    .sort((a, b) => popularidadDe(b.slug) - popularidadDe(a.slug) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limit)
}

function topAnime(anime, limit) {
  return personajes
    .filter((p) => p.anime === anime)
    .sort((a, b) => popularidadDe(b.slug) - popularidadDe(a.slug) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limit)
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

function personSchema(p) {
  const ficha = `/personajes/${p.slug}`
  return {
    '@type': 'ProfilePage',
    '@id': `${BASE_URL}${ficha}#webpage`,
    url: `${BASE_URL}${ficha}`,
    isPartOf: { '@id': `${BASE_URL}/#website` },
    mainEntity: {
      '@type': 'Person',
      name: p.nombre,
      image: absolutizar(p.imagen),
      memberOf: { '@type': 'TVSeries', name: p.anime },
    },
  }
}

// Body SSR-light de una ficha: HTML semántico con estilos inline (el bundle CSS
// aún no aplica durante el primer paint, así que el flash usa los tonos de marca
// como literal — este .mjs no pasa por el guard de tokens, que solo cubre jsx).
function seoBodyFor(p, desc) {
  const img = escapeAttr(absolutizar(p.imagen))
  const n = escapeText(p.nombre)
  const a = escapeText(p.anime)
  const d = escapeText(desc)
  return (
    // aria-hidden + data-ssr-light: este body solo existe para crawlers sin JS
    // (que leen el HTML igual); React lo reemplaza al montar. Marcarlo evita que
    // un lector de pantalla lo anuncie durante el flash previo al montaje.
    '<main data-ssr-light aria-hidden="true" ' +
    'style="max-width:640px;margin:0 auto;padding:56px 20px;color:#d7dce7;' +
    'font-family:system-ui,-apple-system,sans-serif;text-align:center">' +
    `<img src="${img}" alt="${escapeAttr(p.nombre)}" width="280" height="280" ` +
    'style="display:block;width:100%;max-width:280px;height:auto;margin:0 auto 24px;' +
    'border-radius:16px;object-fit:cover" />' +
    `<h1 style="font-size:2rem;font-weight:800;color:#f7f3ea;margin:0 0 6px">${n}</h1>` +
    `<p style="color:#a8b1c3;margin:0 0 20px;font-weight:600">${a} · AnimeShowdown</p>` +
    `<p style="line-height:1.7;margin:0 0 28px">${d}</p>` +
    '<p style="color:#a8b1c3"><a href="/votar" style="color:#e85a64;font-weight:700">' +
    'Vota duelos anime</a> · <a href="/ranking" style="color:#e85a64;font-weight:700">' +
    'Ranking ELO</a> · <a href="/personajes" style="color:#e85a64;font-weight:700">' +
    'Catálogo</a></p></main>'
  )
}

function absolutizar(path) {
  if (!path) return `${BASE_URL}/logo.webp`
  if (/^https?:\/\//.test(path)) return path
  // Imágenes del catálogo: directo al CDN (como la app), no al 302 del front.
  if (IMG_CDN_BASE_URL && path.startsWith('/img/')) {
    return `${IMG_CDN_BASE_URL}${path.slice('/img'.length)}`
  }
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

// Emite los <link rel="alternate" hreflang> recíprocos es/en + x-default (→ ES,
// el idioma por defecto). alt = { es: '/ranking', en: '/en/ranking' }.
function setHreflang(html, alt) {
  const links = [
    `<link rel="alternate" hreflang="es" href="${escapeAttr(BASE_URL + alt.es)}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeAttr(BASE_URL + alt.en)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(BASE_URL + alt.es)}" />`,
  ].join('\n    ')
  return stripHreflang(html).replace('</head>', `    ${links}\n  </head>`)
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
