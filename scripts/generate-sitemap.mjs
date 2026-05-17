#!/usr/bin/env node
// scripts/generate-sitemap.mjs
// Genera frontend/public/sitemap.xml combinando:
//   1. Catálogo cliente-side de personajes (~642 con slug+nombre+anime+imagen,
//      parseado de personajes.js via regex sin deps).
//   2. Rutas estáticas indexables.
//   3. Datos dinámicos de backend (torneos APROBADO + perfiles públicos),
//      con fallback a torneos-seed.json si el backend no responde.
//
// Image extension (Plan v2 §5.5): cada URL de personaje lleva un
// <image:image> con loc absoluta, title (nombre) y caption (nombre de anime)
// para que Google Image Search indexe las webp del catálogo. ~642 imágenes
// indexables — buen volumen para tráfico orgánico de búsquedas tipo "akame
// ga kill akame imagen".
//
// Se invoca automático en `npm run build` antes de `vite build`.
// Variables de entorno:
//   - SITEMAP_API_URL: URL base del backend en producción (Railway).
//     Si no está definida, el script usa solo los torneos del seed.

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASE_URL = 'https://animeshowdown.dev'

const API_TIMEOUT_MS = 5000

/**
 * Parsea el catálogo cliente-side `personajes.js` extrayendo slug, nombre,
 * anime e imagen. Mantiene el regex parsing en lugar de import dinámico
 * para no depender del runtime de Vite/React durante el build de Cloudflare
 * Pages (que ejecuta el script con Node simple, antes de vite build).
 *
 * El catálogo tiene una línea por personaje con el formato:
 *   { slug: '...', nombre: '...', anime: '...', descripcion: '...', imagen: '...' }
 *
 * Capturamos los 4 campos clave en un solo regex con grupos nombrados.
 */
function extractPersonajesFromJs(filePath) {
  const content = readFileSync(filePath, 'utf8')
  // Patrón clásico para strings JS con escapes: cualquier char excepto
  // ' o \, O bien un \ seguido de cualquier char (cubre \', \\, \n, etc).
  // Necesario porque las descripciones tienen comas, apóstrofes escapadas
  // y caracteres acentuados que el regex naive [^']* no permitía.
  const STR = "'((?:[^'\\\\]|\\\\.)*)'"
  const re = new RegExp(
      `\\{\\s*slug:\\s*${STR},\\s*nombre:\\s*${STR},\\s*anime:\\s*${STR},\\s*descripcion:\\s*${STR},\\s*imagen:\\s*${STR}`,
      'g',
  )
  const out = []
  let m
  while ((m = re.exec(content))) {
    out.push({
      slug: m[1],
      nombre: m[2].replace(/\\'/g, "'"),
      anime: m[3].replace(/\\'/g, "'"),
      // m[4] es descripcion — la ignoramos pero el grupo es necesario para
      // que el regex consuma hasta `imagen` correctamente.
      imagen: m[5],
    })
  }
  return out
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

const personajesCatalogo = extractPersonajesFromJs(
  join(ROOT, 'frontend/src/data/personajes.js'),
)

const torneosSeed = JSON.parse(
  readFileSync(
    join(ROOT, 'backend/src/main/resources/torneos-seed.json'),
    'utf8',
  ),
)

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
  { path: '/ranking', priority: '0.9', changefreq: 'daily' },
  { path: '/leaderboards', priority: '0.7', changefreq: 'daily' },
  { path: '/votar', priority: '0.7', changefreq: 'daily' },
  // Anime Daily Trials rebrand 2026-05-17: las URLs viejas
  // (/higher-or-lower, /games/guess-character, /games/guess-anime,
  // /games/anidel, /games/impostor) redirigen 301 vía _redirects de CF
  // a las nuevas. Incluirlas aquí diluía el SEO/canonical — sólo
  // entran las URLs finales rebrandeadas.
  { path: '/games', priority: '0.8', changefreq: 'weekly' },
  { path: '/games/shadow-guess', priority: '0.7', changefreq: 'daily' },
  { path: '/games/anime-reveal', priority: '0.7', changefreq: 'daily' },
  { path: '/games/anigrid', priority: '0.7', changefreq: 'daily' },
  { path: '/games/impostor-trial', priority: '0.7', changefreq: 'daily' },
  { path: '/games/elo-duel', priority: '0.7', changefreq: 'monthly' },
  { path: '/mi-top5', priority: '0.5', changefreq: 'monthly' },
  { path: '/omikuji', priority: '0.6', changefreq: 'daily' },
  { path: '/glossary', priority: '0.7', changefreq: 'monthly' },
  { path: '/logros', priority: '0.7', changefreq: 'weekly' },
  { path: '/apoya', priority: '0.4', changefreq: 'monthly' },
  { path: '/privacidad', priority: '0.3', changefreq: 'yearly' },
  { path: '/terminos', priority: '0.3', changefreq: 'yearly' },
  { path: '/dmca', priority: '0.3', changefreq: 'yearly' },
  { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/api-docs', priority: '0.5', changefreq: 'monthly' },
  { path: '/login', priority: '0.3', changefreq: 'monthly' },
  { path: '/register', priority: '0.3', changefreq: 'monthly' },
]

const today = new Date().toISOString().split('T')[0]
function lastmodOf(value) {
  if (!value) return today
  return String(value).slice(0, 10) || today
}

function urlBlock(loc, priority, changefreq, lastmod = today, images = []) {
  const imageTags = images
      .map(
          (img) => `    <image:image>
      <image:loc>${xmlEscape(img.loc)}</image:loc>
      <image:title>${xmlEscape(img.title)}</image:title>
      <image:caption>${xmlEscape(img.caption)}</image:caption>
    </image:image>`,
      )
      .join('\n')
  return `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${imageTags ? '\n' + imageTags : ''}
  </url>`
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticRoutes.map((r) => urlBlock(r.path, r.priority, r.changefreq)).join('\n')}
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
${torneos
    .map((t) => {
      const priority = t.esDeUsuario ? '0.4' : '0.5'
      return urlBlock(`/torneos/${t.slug}`, priority, 'weekly', lastmodOf(t.lastmod))
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
console.log(
  `   - ${torneos.length} torneos (${apiData ? 'backend live' : 'seed fallback'})`,
)
console.log(`   - ${usuarios.length} usuarios públicos`)
console.log(
  `   - Total: ${staticRoutes.length + personajesCatalogo.length + torneos.length + usuarios.length} URLs · ${personajesCatalogo.length} imágenes`,
)
