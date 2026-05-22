#!/usr/bin/env node
/**
 * Nightly QA crawler.
 *
 * Recorre rutas clave de producción (o localhost si se pasa --local) y
 * captura para cada una:
 *   - status HTTP
 *   - title + meta description
 *   - referencias a imágenes en el HTML (con probing HEAD a una muestra)
 *   - links internos descubiertos
 *   - tiempo de respuesta
 *
 * Output: docs/audit/nightly-crawl-report.md
 *
 * Uso:
 *   node scripts/audit/nightly-crawl.mjs
 *   node scripts/audit/nightly-crawl.mjs --local                          # http://localhost:5173
 *   node scripts/audit/nightly-crawl.mjs --base=https://animeshowdown.pages.dev
 *
 * Implementación:
 *   Usa fetch nativo de Node 18+ — no requiere Playwright ni instalar nada.
 *   No carga JS, así que SOLO ve el HTML inicial (shell de Vite + meta SSR).
 *   Suficiente para detectar 404, problemas SEO básicos y referencias rotas.
 *
 * Diseñado para correr en serie sobre <15 rutas, ignora variantes con query
 * strings y limita probes de imagen a 3 por ruta.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUTPUT = join(ROOT, 'docs/audit/nightly-crawl-report.md')

const args = process.argv.slice(2)
const BASE = args.find((a) => a.startsWith('--base='))?.split('=')[1]
  ?? (args.includes('--local') ? 'http://localhost:5173' : 'https://animeshowdown.pages.dev')

const USER_AGENT = 'AnimeShowdownAuditBot/1.0 (nightly QA crawler; +https://animeshowdown.pages.dev)'

const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/personajes', label: 'Personajes (catálogo)' },
  { path: '/personajes/luffy', label: 'Personaje ficha (Luffy)' },
  { path: '/animes', label: 'Animes (catálogo)' },
  { path: '/animes/one-piece', label: 'Anime ficha (One Piece)' },
  { path: '/torneos', label: 'Torneos' },
  { path: '/ranking', label: 'Ranking' },
  { path: '/votar', label: 'Votar' },
  { path: '/glossary', label: 'Glossary' },
  { path: '/status', label: 'Status' },
  { path: '/duel-live', label: 'Duelo PvP live' },
  { path: '/ruta-que-no-existe', label: '404 (control)' },
]

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeHtmlEntities(m[1].trim()).slice(0, 200) : ''
}

function extractMetaDescription(html) {
  const m = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  return m ? decodeHtmlEntities(m[1]).slice(0, 300) : ''
}

function extractOgImage(html) {
  const m = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  return m ? m[1] : ''
}

function extractCanonical(html) {
  const m = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  return m ? m[1] : ''
}

function extractRobotsMeta(html) {
  const m = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)
  return m ? m[1] : ''
}

function extractImageSrcs(html) {
  const out = new Set()
  const re = /<img[^>]*\s(?:src|data-src)=["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    out.add(m[1])
  }
  // También <link rel="preload" as="image">
  const re2 = /<link[^>]*\srel=["']preload["'][^>]*\sas=["']image["'][^>]*\shref=["']([^"']+)["']/gi
  while ((m = re2.exec(html))) {
    out.add(m[1])
  }
  return [...out]
}

function extractInternalLinks(html, base) {
  const out = new Set()
  const re = /<a[^>]*\shref=["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    const h = m[1]
    if (h.startsWith('/') && !h.startsWith('//')) {
      out.add(h.split('#')[0].split('?')[0])
    } else if (h.startsWith(base)) {
      const path = h.slice(base.length)
      out.add(path.split('#')[0].split('?')[0] || '/')
    }
  }
  return [...out].filter(Boolean)
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ctl.signal, headers: { 'user-agent': USER_AGENT, ...(opts.headers || {}) } })
  } finally {
    clearTimeout(timer)
  }
}

async function probeImage(url) {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' }, 8000)
    return { url, status: res.status, ok: res.ok }
  } catch (e) {
    return { url, status: null, ok: false, error: e.message.slice(0, 100) }
  }
}

async function crawlRoute(base, route) {
  const url = `${base}${route.path}`
  const t0 = Date.now()
  let httpStatus = null
  let html = ''
  let error = null

  try {
    const res = await fetchWithTimeout(url, {}, 20000)
    httpStatus = res.status
    html = await res.text()
  } catch (e) {
    error = e.message.slice(0, 200)
  }

  const elapsed = Date.now() - t0

  const title = extractTitle(html)
  const metaDescription = extractMetaDescription(html)
  const ogImage = extractOgImage(html)
  const canonical = extractCanonical(html)
  const robots = extractRobotsMeta(html)
  const imgSrcs = extractImageSrcs(html)
  const internalLinks = extractInternalLinks(html, base)
  const htmlLength = html.length

  // Probe hasta 3 imágenes únicas (las primeras) — para no martillar CDN
  const sampleImgs = imgSrcs.slice(0, 3)
  const probedImages = []
  for (const src of sampleImgs) {
    const absUrl = src.startsWith('http') ? src : src.startsWith('/') ? `${base}${src}` : null
    if (!absUrl) continue
    // Saltarse data: URIs
    if (absUrl.startsWith('data:')) continue
    const probe = await probeImage(absUrl)
    probedImages.push(probe)
  }

  return {
    route,
    url,
    httpStatus,
    title,
    metaDescription,
    ogImage,
    canonical,
    robots,
    htmlLength,
    elapsed,
    imgCount: imgSrcs.length,
    probedImages,
    internalLinkCount: internalLinks.length,
    error,
  }
}

async function main() {
  console.log(`\nNightly crawl contra ${BASE}`)
  console.log(`Rutas: ${ROUTES.length}\n`)

  const results = []
  for (const route of ROUTES) {
    process.stdout.write(`  ${route.path.padEnd(35)} `)
    try {
      const result = await crawlRoute(BASE, route)
      results.push(result)
      const statusBadge = result.httpStatus === 200
        ? 'OK'
        : result.httpStatus === 404 && route.path === '/ruta-que-no-existe'
          ? '404 (esperado)'
          : result.httpStatus === null
            ? 'ERR'
            : `${result.httpStatus} ⚠`
      const brokenImgs = result.probedImages.filter((p) => !p.ok).length
      const imgBadge = brokenImgs > 0 ? ` [${brokenImgs} img rotas]` : ''
      process.stdout.write(`${statusBadge.padEnd(15)} ${result.elapsed}ms${imgBadge}\n`)
    } catch (e) {
      console.log(`ERROR ${e.message}`)
      results.push({ route, error: e.message, probedImages: [] })
    }
  }

  // Generar reporte markdown
  const report = generateReport(results, BASE)
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, report)
  console.log(`\nReporte: ${OUTPUT}`)
}

function generateReport(results, base) {
  const lines = []
  lines.push(`# Nightly crawl — ${base}`)
  lines.push('')
  lines.push(`> Generado: ${new Date().toISOString()}`)
  lines.push(`> Base URL: ${base}`)
  lines.push(`> Script: \`scripts/audit/nightly-crawl.mjs\``)
  lines.push(`> Modo: HTTP fetch (no headless browser) — captura HTML inicial + probe HEAD a imágenes`)
  lines.push('')

  // Resumen
  const ok = results.filter((r) => r.httpStatus === 200).length
  const ctrl404 = results.filter((r) => r.httpStatus === 404 && r.route.path === '/ruta-que-no-existe').length
  const unexpectedNon200 = results.filter((r) => r.httpStatus !== null && r.httpStatus !== 200 && !(r.httpStatus === 404 && r.route.path === '/ruta-que-no-existe')).length
  const errors = results.filter((r) => r.error).length
  const brokenImgRoutes = results.filter((r) => (r.probedImages || []).some((p) => !p.ok)).length
  const noTitle = results.filter((r) => r.httpStatus === 200 && !r.title).length
  const noMeta = results.filter((r) => r.httpStatus === 200 && !r.metaDescription).length
  const slow = results.filter((r) => r.elapsed > 3000).length

  lines.push('## Resumen')
  lines.push('')
  lines.push('| Métrica | Valor |')
  lines.push('|---|---|')
  lines.push(`| Rutas testeadas | ${results.length} |`)
  lines.push(`| HTTP 200 OK | ${ok} |`)
  lines.push(`| 404 control (ruta inexistente) | ${ctrl404} ${ctrl404 === 1 ? '✓' : '⚠ debería ser 1'} |`)
  lines.push(`| Errores de fetch | ${errors} ${errors === 0 ? '✓' : '⚠'} |`)
  lines.push(`| HTTP no esperado (no 200, no 404 control) | ${unexpectedNon200} ${unexpectedNon200 === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Rutas sin \`<title>\` | ${noTitle} ${noTitle === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Rutas sin meta description | ${noMeta} ${noMeta === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Rutas con imágenes rotas (en muestra) | ${brokenImgRoutes} ${brokenImgRoutes === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Respuestas > 3s | ${slow} ${slow === 0 ? '✓' : '⚠'} |`)
  lines.push('')

  // Tabla detalle
  lines.push('## Detalle por ruta')
  lines.push('')
  lines.push('| Ruta | HTTP | Tiempo | Title | HTML KB | Imgs | Links |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const r of results) {
    const path = r.route.path
    const status = r.httpStatus ?? 'ERR'
    const elapsed = r.elapsed ? `${r.elapsed}ms` : '—'
    const title = (r.title || '').slice(0, 50).replace(/\|/g, '\\|')
    const kb = r.htmlLength ? Math.round(r.htmlLength / 1024) : '—'
    const imgs = r.imgCount ?? '—'
    const links = r.internalLinkCount ?? '—'
    lines.push(`| \`${path}\` | ${status} | ${elapsed} | ${title} | ${kb} | ${imgs} | ${links} |`)
  }
  lines.push('')

  // SEO por ruta
  lines.push('## SEO básico por ruta')
  lines.push('')
  lines.push('| Ruta | Title | Meta description | Canonical | Robots | og:image |')
  lines.push('|---|---|---|---|---|---|')
  for (const r of results) {
    if (r.httpStatus !== 200) continue
    const path = r.route.path
    const titleOk = r.title ? '✓' : '✗'
    const metaOk = r.metaDescription ? '✓' : '✗'
    const canonical = r.canonical ? '✓' : '—'
    const robots = r.robots || '—'
    const ogImage = r.ogImage ? '✓' : '—'
    lines.push(`| \`${path}\` | ${titleOk} | ${metaOk} | ${canonical} | ${robots} | ${ogImage} |`)
  }
  lines.push('')

  // Hallazgos por ruta
  let anyFinding = false
  const findingsLines = []
  for (const r of results) {
    const brokenImgs = (r.probedImages || []).filter((p) => !p.ok)
    const isControlNotFound = r.httpStatus === 404 && r.route.path === '/ruta-que-no-existe'
    const hasUnexpectedStatus = r.httpStatus !== null && r.httpStatus !== 200 && !isControlNotFound
    const hasError = !!r.error
    const missingSeo = r.httpStatus === 200 && (!r.title || !r.metaDescription)

    if (!brokenImgs.length && !hasUnexpectedStatus && !hasError && !missingSeo) continue
    anyFinding = true

    findingsLines.push(`### \`${r.route.path}\` — ${r.route.label}`)
    findingsLines.push('')
    findingsLines.push(`- URL: \`${r.url}\``)
    findingsLines.push(`- HTTP status: \`${r.httpStatus ?? 'ERR'}\``)
    if (hasError) {
      findingsLines.push(`- **Error fetch:** ${r.error}`)
    }
    if (r.httpStatus === 200) {
      if (!r.title) findingsLines.push('- **⚠ Falta `<title>`**')
      if (!r.metaDescription) findingsLines.push('- **⚠ Falta meta description**')
      if (r.title) findingsLines.push(`- Title actual: \`${r.title}\``)
      if (r.metaDescription) findingsLines.push(`- Meta: \`${r.metaDescription.slice(0, 160)}\``)
    }
    if (brokenImgs.length) {
      findingsLines.push('')
      findingsLines.push('**Imágenes rotas (muestra de las primeras 3):**')
      findingsLines.push('')
      findingsLines.push('| URL | Status |')
      findingsLines.push('|---|---|')
      for (const img of brokenImgs) {
        findingsLines.push(`| \`${img.url.slice(0, 100)}\` | ${img.status ?? `ERR (${img.error || 'unknown'})`} |`)
      }
    }
    findingsLines.push('')
  }

  if (anyFinding) {
    lines.push('## Hallazgos detallados')
    lines.push('')
    lines.push(...findingsLines)
  } else {
    lines.push('## Hallazgos detallados')
    lines.push('')
    lines.push('_Sin hallazgos — todas las rutas devuelven HTTP esperado, tienen title + meta, y la muestra de imágenes probadas responde 2xx._')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Limitaciones')
  lines.push('')
  lines.push('- **No ejecuta JS** — solo ve el HTML inicial servido por Cloudflare. Si la app es SPA y el title/meta los inyecta React tras hidratar, este crawler verá los valores fallback (`index.html` template).')
  lines.push('- **Probe de imágenes limitado a 3 por ruta** — para no sobrecargar el CDN. Una auditoría exhaustiva de imágenes rotas requeriría rastrear `frontend/img/` contra `personajes-seed.json` (eso ya lo hace `scripts/audit/catalog-quality.mjs`).')
  lines.push('- **No detecta errores de consola** — para eso haría falta un headless browser (Playwright). Se podría añadir como follow-up si compensa instalar la dep en CI.')
  lines.push('- **404 control esperado**: la ruta `/ruta-que-no-existe` debe responder 404 en Cloudflare Pages (sirve `404.html` si existe, o el index para SPA). Si responde 200 con el shell de la app, la SPA se encarga de mostrar el "Not Found" pero los crawlers SEO lo verán como 200 — eso es deuda conocida de SPAs sin SSR.')
  lines.push('')

  return lines.join('\n')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
