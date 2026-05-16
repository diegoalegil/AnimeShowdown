#!/usr/bin/env node
// scripts/generate-sitemap.mjs
// Genera frontend/public/sitemap.xml combinando:
//   1. Catálogo cliente-side de personajes (~642, estable, parseado de
//      personajes.js via regex sin deps).
//   2. Rutas estáticas indexables (8 rutas).
//   3. Datos dinámicos de backend (torneos APROBADO + perfiles públicos),
//      con fallback a torneos-seed.json si el backend no responde.
//
// Se invoca automático en `npm run build` antes de `vite build`.
// Variables de entorno:
//   - SITEMAP_API_URL: URL base del backend en producción (Railway).
//     Si no está definida, el script usa solo los torneos del seed.
//
// Plan v2 §5.4 — sitemap segmentado (foundations).

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASE_URL = 'https://animeshowdown.dev'

// 5 segundos antes de rendirse y caer al seed. Si Railway está cold-start
// puede tardar hasta 8s, pero entonces preferimos seed + faltarle algunos
// torneos UGC que romper el build.
const API_TIMEOUT_MS = 5000

function extractSlugsFromJs(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const matches = [...content.matchAll(/slug:\s*'([^']+)'/g)]
  return matches.map((m) => m[1])
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

const personajes = extractSlugsFromJs(
  join(ROOT, 'frontend/src/data/personajes.js'),
)

const torneosSeed = JSON.parse(
  readFileSync(
    join(ROOT, 'backend/src/main/resources/torneos-seed.json'),
    'utf8',
  ),
)

const apiData = await fetchSitemapData(process.env.SITEMAP_API_URL)

// Si el backend respondió usamos su lista de torneos. Si no, los del seed
// (mínimo aceptable para que el sitemap nunca esté vacío). Dedup por slug
// por si el backend devuelve también los del seed.
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
  { path: '/higher-or-lower', priority: '0.7', changefreq: 'monthly' },
  { path: '/votar', priority: '0.7', changefreq: 'daily' },
  { path: '/login', priority: '0.3', changefreq: 'monthly' },
  { path: '/register', priority: '0.3', changefreq: 'monthly' },
]

const today = new Date().toISOString().split('T')[0]
function lastmodOf(value) {
  if (!value) return today
  // El backend devuelve LocalDateTime como '2026-05-16T16:14:33.123'. Para
  // sitemap solo queremos YYYY-MM-DD.
  return String(value).slice(0, 10) || today
}

const url = (loc, priority, changefreq, lastmod = today) => `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticRoutes.map((r) => url(r.path, r.priority, r.changefreq)).join('\n')}
${personajes.map((slug) => url(`/personajes/${slug}`, '0.6', 'monthly')).join('\n')}
${torneos
    .map((t) => {
      // UGC más activos al principio → priority levemente menor que admin
      // para no sesgar el sitemap completo. weekly por defecto.
      const priority = t.esDeUsuario ? '0.4' : '0.5'
      return url(`/torneos/${t.slug}`, priority, 'weekly', lastmodOf(t.lastmod))
    })
    .join('\n')}
${usuarios
    .map((u) =>
      url(
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
console.log(`   - ${personajes.length} personajes`)
console.log(`   - ${torneos.length} torneos (${apiData ? 'backend live' : 'seed fallback'})`)
console.log(`   - ${usuarios.length} usuarios públicos`)
console.log(
  `   - Total: ${staticRoutes.length + personajes.length + torneos.length + usuarios.length} URLs`,
)
