#!/usr/bin/env node
// Smoke de PRODUCCIÓN: verifica la capa CDN/Cloudflare que los tests de build
// NO ven. Cubre dos regresiones reales detectadas en auditoría:
//   1) Rutas públicas que devolvían 404 porque _redirects es allowlist sin
//      catch-all (deben responder 200 sirviendo la SPA / su HTML prerenderizado).
//   2) Sourcemaps servidos públicamente (deben dar 404; se quitan en el build).
//
// Corre por schedule en CI; si algo falla, el job falla y GitHub avisa al owner.
// Uso local: `node scripts/smoke-prod.mjs` (o SMOKE_BASE_URL=... para otra base).

const BASE = (process.env.SMOKE_BASE_URL || 'https://animeshowdown.dev').replace(/\/$/, '')

// Rutas públicas que DEBEN responder 200 (la SPA o su HTML prerenderizado).
const DEBEN_200 = [
  '/',
  '/personajes',
  '/animes',
  '/ranking',
  '/votar',
  '/cartas',
  '/especiales',
  '/fantasy',
  '/tier-lists',
  '/games',
  '/games/oraculo',
  '/games/nexo-anime',
  '/games/elo-duel',
  '/feed',
  '/faq',
  '/wrapped',
  '/animes/one-piece',
]

async function status(path) {
  try {
    const res = await fetch(BASE + path, { redirect: 'follow' })
    return res.status
  } catch (e) {
    return `ERR ${e.message}`
  }
}

const fallos = []

for (const path of DEBEN_200) {
  const s = await status(path)
  const ok = s === 200
  console.log(`${ok ? '✓' : '✗'} ${path} -> ${s}`)
  if (!ok) fallos.push(`${path} esperaba 200, dio ${s}`)
}

// Los sourcemaps NO deben servirse públicamente (se eliminan del artefacto).
const html = await (await fetch(BASE + '/')).text()
const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
if (m) {
  const mapStatus = await status(`${m[0]}.map`)
  const ok = mapStatus === 404
  console.log(`${ok ? '✓' : '✗'} ${m[0]}.map -> ${mapStatus} (debe ser 404)`)
  if (!ok) fallos.push(`sourcemap ${m[0]}.map accesible (${mapStatus}); debe ser 404`)
} else {
  console.log('⚠ no se pudo localizar el bundle index-*.js en el HTML (¿cambió el naming?)')
}

if (fallos.length > 0) {
  console.error(`\n${fallos.length} fallo(s) de smoke en ${BASE}:`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`\nSmoke OK (${BASE})`)
