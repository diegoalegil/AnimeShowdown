#!/usr/bin/env node
// Genera public/sobre-cara.webp: la cara del sobre (el envoltorio de
// components/Sobre, tal como lo pinta sobres.css) aplanada en una sola
// imagen. La usan las tres piezas del sobre que se rasga: cada pieza es esa
// imagen recortada, en lugar de una copia entera del envoltorio con sus
// degradados, su máscara de olas, sus textos y su ilustración, que Safari
// repintaba tres veces en cada frame de la apertura.
//
// La imagen se toma del propio build, así que coincide con el sobre cerrado.
// Hay que volver a generarla cuando cambie el envoltorio (Sobre.jsx o el
// bloque «Envoltorio» de sobres.css). El número del sobre (Nº 01 / 05) no va
// en la imagen: lo pintan las piezas encima.
//
// Necesita un build en dist/, cwebp (libwebp) en el PATH y playwright-core
// con Chromium (no es una dependencia del proyecto; por ejemplo
// `npm i --no-save playwright-core && npx playwright-core install chromium`,
// o PLAYWRIGHT_CORE=<carpeta de playwright-core>).
//
//   npm run build && node scripts/generate-sobre.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(raiz, 'dist')
const destino = join(raiz, 'public/sobre-cara.webp')
const base = process.env.BASE_PATH || '/'

// El sobre de escritorio (17rem) a 3×: nítido también en las pantallas de
// móvil, donde el sobre es algo más estrecho.
const ANCHO_CSS = 272
const ESCALA = 3
const CALIDAD = 80

const require = createRequire(join(raiz, 'package.json'))
let playwright
try {
  playwright = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
} catch {
  console.error('generate-sobre: falta playwright-core (ver la cabecera del script).')
  process.exit(1)
}
if (!statSync(join(dist, 'index.html'), { throwIfNoEntry: false })) {
  console.error('generate-sobre: no hay build en dist/ (npm run build).')
  process.exit(1)
}

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' }
const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (ruta.startsWith(base)) ruta = '/' + ruta.slice(base.length)
  let archivo = normalize(join(dist, ruta))
  if (!archivo.startsWith(dist)) archivo = join(dist, '404.html')
  if (statSync(archivo, { throwIfNoEntry: false })?.isDirectory()) archivo = join(archivo, 'index.html')
  if (!statSync(archivo, { throwIfNoEntry: false })) archivo = join(dist, '404.html')
  res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' })
  res.end(readFileSync(archivo))
})
await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo))
const url = `http://127.0.0.1:${servidor.address().port}${base}sobres/`

const temporal = mkdtempSync(join(tmpdir(), 'sobre-'))
const navegador = await playwright.chromium.launch()
try {
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: ESCALA })
  await pagina.goto(url, { waitUntil: 'networkidle' })
  await pagina.addStyleTag({
    content: `
      html, body, .sobres { background: none !important; }
      body * { visibility: hidden !important; animation: none !important; transition: none !important; }
      .sobres { --sobre-ancho: ${ANCHO_CSS}px !important; }
      .envoltorio, .envoltorio * { visibility: visible !important; }
      .envoltorio-numero, .envoltorio-numero * { visibility: hidden !important; }
    `,
  })
  const envoltorio = pagina.locator('.sobre .envoltorio')
  await envoltorio.waitFor()
  // Todas las fuentes (también los trozos japoneses) y la ilustración, ya pintadas.
  // (En texto: se evalúa en la página, no en Node.)
  await pagina.evaluate('document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))')
  await pagina.waitForLoadState('networkidle')
  const png = join(temporal, 'cara.png')
  await envoltorio.screenshot({ path: png, omitBackground: true, animations: 'disabled' })
  execFileSync('cwebp', ['-quiet', '-q', String(CALIDAD), '-alpha_q', '100', '-m', '6', '-sharp_yuv', png, '-o', destino])
  console.log(`generate-sobre: public/sobre-cara.webp (${Math.round(statSync(destino).size / 1024)} KB)`)
} finally {
  await navegador.close()
  servidor.close()
  rmSync(temporal, { recursive: true, force: true })
}
