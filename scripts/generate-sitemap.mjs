#!/usr/bin/env node
// scripts/generate-sitemap.mjs
// Genera frontend/public/sitemap.xml combinando:
//   1. Catálogo backend de personajes (~1052 con slug+nombre+anime+imagen),
//      leído desde personajes-seed.json para evitar duplicados frontend.
//   2. Rutas estáticas indexables.
//   3. Datos dinámicos de backend (torneos APROBADO + perfiles públicos),
//      con fallback a torneos-seed.json si el backend no responde.
//
// Image extension: cada URL de personaje lleva un
// <image:image> con loc absoluta, title (nombre) y caption (nombre de anime)
// para que Google Image Search indexe las webp del catálogo. 1052 imágenes
// indexables — buen volumen para tráfico orgánico de búsquedas tipo "akame
// ga kill akame imagen".
//
// Se invoca automático en `npm run build` antes de `vite build`.
// Variables de entorno:
//   - SITEMAP_API_URL: URL base del backend en producción (Railway).
//     Si no está definida, el script usa solo los torneos del seed.

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASE_URL = 'https://animeshowdown.dev'

const API_TIMEOUT_MS = 5000

function loadPersonajesFromSeed(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8')).map((personaje) => ({
    slug: personaje.slug,
    nombre: personaje.nombre,
    anime: personaje.anime,
    imagen: personaje.imagenUrl ?? personaje.imagen,
  }))
}

async function fetchSitemapData(apiUrl) {
  if (!apiUrl) {
    console.log('   ⚠ SITEMAP_API_URL no definida — fallback a torneos-seed.json')
    return null
  }
  const url = `${apiUrl.replace(/\/$/, '')}/api/sitemap/data`
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      console.log(`   ⚠ ${url} respondió ${res.status} — fallback a seed`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.log(`   ⚠ ${url} no respondió (${err.message}) — fallback a seed`)
    return null
  } finally {
    clearTimeout(tid)
  }
}

/**
 * Escapa caracteres XML reservados en strings que van dentro de tags. Sin
 * esto, un personaje con "&" o "<" en el nombre rompe el parseo del
 * sitemap (Googlebot lo descarta entero).
 */
function xmlEscape(s) {
  if (s == null) return ''
  return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
}

const personajesCatalogo = loadPersonajesFromSeed(
  join(ROOT, 'backend/src/main/resources/personajes-seed.json'),
)
const personajesPorSlug = new Map(personajesCatalogo.map((p) => [p.slug, p]))
const versusCurados = [
  ['luffy', 'naruto'],
  ['goku', 'saitama'],
  ['light_yagami', 'l'],
  ['zoro', 'itachi'],
  ['kaneki', 'eren_yeager'],
  // Matchups ICÓNICOS de alta búsqueda (curados, NO masivo). Cada uno es una
  // página con datos reales de comparación + OG + schema — sustancia, no
  // doorway. Mismo set que el prerender SEO. Slugs verificados contra el seed.
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

// Derivamos la lista de animes únicos del catálogo para emitir una URL
// /animes/{slug} por cada uno. Antes faltaban — el
// sitemap solo tenía /animes (listado) pero no las fichas individuales,
// perdiendo ~70 páginas indexables con contenido único (top ELO, roster,
// schema TVSeries, etc).
const animesUnicos = [...new Set(personajesCatalogo.map((p) => p.anime))].sort()

// No emitimos /duelos/{a}-vs-{b} masivamente en el sitemap.
// La ruta existe para share/internal linking, pero indexar combinaciones
// templáticas antes de tener análisis editorial único se acerca demasiado a
// una granja de contenido. Cuando haya duelos curados con copy propio, se
// pueden añadir aquí como lista editorial corta.
//
// Sí emitimos /animes/{slug}/ranking: hay una sola página por universo,
// reutiliza el roster real del catálogo y responde a búsquedas claras tipo
// "ranking de Naruto" sin generar combinaciones infinitas.

// Réplica de frontend/src/lib/animes.js:slugifyAnime para no depender
// del runtime de Vite/React. Si cambia ese helper, actualizar aquí
// también — el slug del sitemap DEBE coincidir con la ruta real.
function slugifyAnime(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const torneosSeed = JSON.parse(
  readFileSync(
    join(ROOT, 'backend/src/main/resources/torneos-seed.json'),
    'utf8',
  ),
)
const torneosSeedPorSlug = new Map(torneosSeed.map((t) => [t.slug, t]))

const apiData = await fetchSitemapData(process.env.SITEMAP_API_URL)

let torneos
let usuarios
if (apiData) {
  const slugsSeed = new Set(torneosSeed.map((t) => t.slug))
  torneos = [
    ...torneosSeed.map((t) => ({
      slug: t.slug,
      lastmod: null,
      esDeUsuario: false,
    })),
    ...apiData.torneos.filter((t) => !slugsSeed.has(t.slug)),
  ]
  usuarios = apiData.usuarios ?? []
} else {
  torneos = torneosSeed.map((t) => ({
    slug: t.slug,
    lastmod: null,
    esDeUsuario: false,
  }))
  usuarios = []
}

const staticRoutes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/personajes', priority: '0.9', changefreq: 'weekly' },
  { path: '/animes', priority: '0.8', changefreq: 'weekly' },
  { path: '/torneos', priority: '0.9', changefreq: 'weekly' },
  { path: '/eventos', priority: '0.7', changefreq: 'weekly' },
  { path: '/ranking', priority: '0.9', changefreq: 'daily' },
  { path: '/rankings/mejores-personajes-anime', priority: '0.75', changefreq: 'weekly' },
  { path: '/rankings/personajes-mas-fuertes-anime', priority: '0.75', changefreq: 'weekly' },
  { path: '/rankings/mejores-villanos-anime', priority: '0.7', changefreq: 'weekly' },
  { path: '/rankings/mejores-waifus-anime', priority: '0.7', changefreq: 'weekly' },
  { path: '/rankings/mejores-protagonistas-anime', priority: '0.7', changefreq: 'weekly' },
  { path: '/leaderboards', priority: '0.7', changefreq: 'daily' },
  { path: '/votar', priority: '0.7', changefreq: 'daily' },
  { path: '/comparar', priority: '0.7', changefreq: 'weekly' },
  { path: '/descubre-personaje', priority: '0.7', changefreq: 'daily' },
  { path: '/misiones', priority: '0.7', changefreq: 'daily' },
  { path: '/como-funciona', priority: '0.7', changefreq: 'monthly' },
  { path: '/metodologia-elo', priority: '0.7', changefreq: 'monthly' },
  // Las URLs viejas (/higher-or-lower, /games/guess-character,
  // /games/guess-anime, /games/anidel, /games/impostor) redirigen 301
  // vía _redirects de CF a las nuevas. Incluirlas aquí diluye el
  // SEO/canonical; sólo entran las URLs finales rebrandeadas.
  { path: '/games', priority: '0.8', changefreq: 'weekly' },
  { path: '/juegos/anime', priority: '0.8', changefreq: 'weekly' },
  { path: '/games/shadow-guess', priority: '0.7', changefreq: 'daily' },
  { path: '/games/anime-reveal', priority: '0.7', changefreq: 'daily' },
  { path: '/games/oraculo', priority: '0.7', changefreq: 'weekly' },
  { path: '/games/anigrid', priority: '0.7', changefreq: 'daily' },
  { path: '/games/nexo-anime', priority: '0.7', changefreq: 'daily' },
  { path: '/games/impostor-trial', priority: '0.7', changefreq: 'daily' },
  { path: '/games/elo-duel', priority: '0.7', changefreq: 'monthly' },
  { path: '/omikuji', priority: '0.6', changefreq: 'daily' },
  { path: '/glossary', priority: '0.7', changefreq: 'monthly' },
  { path: '/logros', priority: '0.7', changefreq: 'weekly' },
  { path: '/apoya', priority: '0.4', changefreq: 'monthly' },
  { path: '/privacidad', priority: '0.3', changefreq: 'yearly' },
  { path: '/terminos', priority: '0.3', changefreq: 'yearly' },
  { path: '/dmca', priority: '0.3', changefreq: 'yearly' },
  { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/api-docs', priority: '0.5', changefreq: 'monthly' },
  { path: '/status', priority: '0.5', changefreq: 'daily' },
]

const today = new Date().toISOString().split('T')[0]
function lastmodOf(value) {
  if (!value) return today
  return String(value).slice(0, 10) || today
}

// EN-first: las money pages tienen variante /en con hreflang recíproco.
const EN_PATHS = new Set(['/', '/personajes', '/animes', '/comparar', '/ranking', '/votar', '/games', '/juegos/anime'])
function altOf(path) {
  if (!EN_PATHS.has(path)) return null
  return { es: path, en: path === '/' ? '/en' : `/en${path}` }
}

function urlBlock(loc, priority, changefreq, lastmod = today, images = [], alt = null) {
  const imageTags = images
      .map(
          (img) => `    <image:image>
      <image:loc>${xmlEscape(img.loc)}</image:loc>
      <image:title>${xmlEscape(img.title)}</image:title>
      <image:caption>${xmlEscape(img.caption)}</image:caption>
    </image:image>`,
      )
      .join('\n')
  // hreflang recíproco es/en + x-default (→ ES), recomendado por Google en el
  // sitemap además de en el HTML. Cada lado del par lleva el mismo bloque.
  const altTags = alt
      ? [
          `    <xhtml:link rel="alternate" hreflang="es" href="${BASE_URL}${alt.es}"/>`,
          `    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}${alt.en}"/>`,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${alt.es}"/>`,
        ].join('\n')
      : ''
  return `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${altTags ? '\n' + altTags : ''}${imageTags ? '\n' + imageTags : ''}
  </url>`
}

function publicAsset(path) {
  if (!path) return null
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const fsPath = join(ROOT, 'frontend/public', cleanPath)
  return existsSync(fsPath) ? cleanPath : null
}

function firstPublicAsset(candidates) {
  for (const candidate of candidates) {
    const found = publicAsset(candidate)
    if (found) return found
  }
  return null
}

function animeImage(anime) {
  const slug = slugifyAnime(anime)
  const banner = firstPublicAsset([
    `/assets/anime-banners/${slug}.webp`,
    `/assets/anime-banners/${slug}.avif`,
    `/assets/anime-banners/${slug}.jpg`,
    `/assets/anime-banners/${slug}.png`,
    `/assets/anime-banners/${slug}.svg`,
  ])
  if (banner) {
    return {
      loc: `${BASE_URL}${banner}`,
      title: `${anime} — banner`,
      caption: `Banner del universo ${anime} en AnimeShowdown`,
    }
  }
  const personajePortada = personajesCatalogo.find((p) => p.anime === anime && p.imagen)
  if (!personajePortada) return null
  return {
    loc: `${BASE_URL}${personajePortada.imagen}`,
    title: `${anime} — ${personajePortada.nombre}`,
    caption: `Imagen representativa de ${anime} en AnimeShowdown`,
  }
}

function torneoImages(torneo) {
  const seed = torneosSeedPorSlug.get(torneo.slug) ?? torneo
  const banner = firstPublicAsset([
    `/assets/tournament-banners/${torneo.slug}.webp`,
    `/assets/tournament-banners/${torneo.slug}.avif`,
    `/assets/tournament-banners/${torneo.slug}.jpg`,
    `/assets/tournament-banners/${torneo.slug}.png`,
    `/assets/tournament-banners/${torneo.slug}.svg`,
  ])
  if (banner) {
    return [{
      loc: `${BASE_URL}${banner}`,
      title: `${seed.nombre ?? torneo.slug} — banner`,
      caption: `Banner del torneo ${seed.nombre ?? torneo.slug} en AnimeShowdown`,
    }]
  }
  const destacadoSlug = seed.ganadorSlug ?? seed.participantes?.[0]
  const destacado = destacadoSlug ? personajesPorSlug.get(destacadoSlug) : null
  if (!destacado?.imagen) return []
  return [{
    loc: `${BASE_URL}${destacado.imagen}`,
    title: `${seed.nombre ?? torneo.slug} — ${destacado.nombre}`,
    caption: `Imagen representativa del torneo ${seed.nombre ?? torneo.slug}`,
  }]
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticRoutes.map((r) => urlBlock(r.path, r.priority, r.changefreq, today, [], altOf(r.path))).join('\n')}
${staticRoutes.filter((r) => EN_PATHS.has(r.path)).map((r) => urlBlock(altOf(r.path).en, r.priority, r.changefreq, today, [], altOf(r.path))).join('\n')}
${personajesCatalogo
    .map((p) =>
      urlBlock(`/personajes/${p.slug}`, '0.6', 'monthly', today, [
        {
          loc: `${BASE_URL}${p.imagen}`,
          title: p.nombre,
          caption: `${p.nombre} — personaje de ${p.anime} en AnimeShowdown`,
        },
      ]),
    )
    .join('\n')}
${animesUnicos
    .map((anime) =>
      urlBlock(
        `/animes/${slugifyAnime(anime)}`,
        '0.7',
        'weekly',
        today,
        [animeImage(anime)].filter(Boolean),
      ),
    )
    .join('\n')}
${animesUnicos
    .map((anime) =>
      urlBlock(
        `/animes/${slugifyAnime(anime)}/ranking`,
        '0.65',
        'weekly',
        today,
        [animeImage(anime)].filter(Boolean),
      ),
    )
    .join('\n')}
${versusCurados
    .map(([a, b]) =>
      urlBlock(
        `/versus/${a.slug}-vs-${b.slug}`,
        '0.55',
        'monthly',
        today,
        [a, b]
          .filter((p) => p.imagen)
          .map((p) => ({
            loc: `${BASE_URL}${p.imagen}`,
            title: p.nombre,
            caption: `${p.nombre} — personaje de ${p.anime} en AnimeShowdown`,
          })),
      ),
    )
    .join('\n')}
${torneos
    .map((t) => {
      const priority = t.esDeUsuario ? '0.4' : '0.5'
      return urlBlock(
        `/torneos/${t.slug}`,
        priority,
        'weekly',
        lastmodOf(t.lastmod),
        torneoImages(t),
      )
    })
    .join('\n')}
${usuarios
    .map((u) =>
      urlBlock(
        `/u/${encodeURIComponent(u.username)}`,
        '0.3',
        'weekly',
        lastmodOf(u.lastmod),
      ),
    )
    .join('\n')}
</urlset>
`

const outPath = join(ROOT, 'frontend/public/sitemap.xml')
writeFileSync(outPath, xml)

console.log(`✅ sitemap.xml generado en ${outPath}`)
console.log(`   - ${staticRoutes.length} rutas estáticas`)
console.log(`   - ${personajesCatalogo.length} personajes (con image extension)`)
console.log(`   - ${animesUnicos.length} fichas de anime`)
console.log(`   - ${animesUnicos.length} rankings por anime`)
console.log(`   - ${versusCurados.length} versus curados`)
console.log(
  `   - ${torneos.length} torneos (${apiData ? 'backend live' : 'seed fallback'})`,
)
console.log(`   - ${usuarios.length} usuarios públicos`)
console.log(
  `   - Total: ${staticRoutes.length + personajesCatalogo.length + animesUnicos.length * 2 + versusCurados.length + torneos.length + usuarios.length} URLs · ${personajesCatalogo.length + animesUnicos.length * 2 + versusCurados.length * 2 + torneos.length} imágenes`,
)
