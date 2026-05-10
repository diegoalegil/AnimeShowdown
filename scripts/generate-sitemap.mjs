#!/usr/bin/env node
// scripts/generate-sitemap.mjs
// Genera frontend/public/sitemap.xml leyendo personajes.js + torneos.js.
// Ejecutar manualmente cuando se añadan personajes/torneos: node scripts/generate-sitemap.mjs
// Idealmente se invoca como `npm run build:sitemap` antes de `npm run build`.

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASE_URL = 'https://animeshowdown.pages.dev'

// Parser simple regex de los .js — evita instalar dependencias.
function extractSlugs(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const matches = [...content.matchAll(/slug:\s*'([^']+)'/g)]
  return matches.map((m) => m[1])
}

const personajes = extractSlugs(join(ROOT, 'frontend/src/data/personajes.js'))
const torneos = extractSlugs(join(ROOT, 'frontend/src/data/torneos.js'))

// Rutas estáticas indexables (excluidas: /admin, /perfil, /forgot-password, /reset-password)
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
const url = (loc, priority, changefreq) => `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticRoutes.map((r) => url(r.path, r.priority, r.changefreq)).join('\n')}
${personajes.map((slug) => url(`/personajes/${slug}`, '0.6', 'monthly')).join('\n')}
${torneos.map((slug) => url(`/torneos/${slug}`, '0.5', 'weekly')).join('\n')}
</urlset>
`

const outPath = join(ROOT, 'frontend/public/sitemap.xml')
writeFileSync(outPath, xml)

console.log(`✅ sitemap.xml generado en ${outPath}`)
console.log(`   - ${staticRoutes.length} rutas estáticas`)
console.log(`   - ${personajes.length} personajes`)
console.log(`   - ${torneos.length} torneos`)
console.log(`   - Total: ${staticRoutes.length + personajes.length + torneos.length} URLs`)
