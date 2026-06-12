#!/usr/bin/env node
// Genera los subsets de la display "AS Display" (Zen Old Mincho 700, OFL)
// a partir del inventario REAL de caracteres del repo, en tres caras con
// unicode-range para que la ruta inicial solo pague la cara core:
//
//   A core — latín completo + puntuación + los kanji del chrome de la UI
//            (literales en componentes/páginas). Única cara con preload.
//   B ext  — kanji que solo viven en los data files de contenido
//            (identidades de anime, omikuji, glosarios…): lazy por rango.
//   C ja   — caracteres que solo aparecen en el locale ja: solo descarga
//            si se pinta japonés.
//
// Salidas (todas commiteadas):
//   public/fonts/as-display-{cara}.{hash8}.woff2  (nombre versionado por
//     contenido → /fonts/* puede ser immutable en _headers)
//   public/fonts/OFL.txt
//   src/styles/display-font.css  (@font-face ×3 + fallback métrico)
//   scripts/display-font-manifest.json  (inventario por cara)
//
// Modo --check (CI, anti-tofu): re-escanea el repo y falla si aparece un
// carácter CJK que no esté en el manifest commiteado — cada anime/copy
// nuevo con kanji obliga a regenerar los subsets (npm run build:display-font).
//
// La fuente origen NO se commitea (5,4MB): se descarga a /tmp con
// `npm run build:display-font:fetch` o se pasa vía DISPLAY_FONT_TTF.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '..')
const SRC = join(FRONTEND, 'src')
const OUT_FONTS = join(FRONTEND, 'public', 'fonts')
const OUT_CSS = join(SRC, 'styles', 'display-font.css')
const MANIFEST = join(__dirname, 'display-font-manifest.json')
const CHECK = process.argv.includes('--check')

const TTF =
  process.env.DISPLAY_FONT_TTF || '/tmp/font-src/ZenOldMincho-Bold.ttf'
const OFL =
  process.env.DISPLAY_FONT_OFL || '/tmp/font-src/OFL.txt'
const FONT_URL =
  'https://github.com/google/fonts/raw/main/ofl/zenoldmincho/ZenOldMincho-Bold.ttf'

// Caras B: contenido (kanji que no pinta el chrome de la UI) — los data
// files más las páginas/libs de contenido denso en CJK.
const DATA_PREFIXES = [
  join(SRC, 'data') + '/',
  join(SRC, 'pages', 'GlossaryPage.jsx'),
  join(SRC, 'pages', 'OmikujiPage.jsx'),
  join(SRC, 'lib', 'badgeKanji.js'),
  join(SRC, 'lib', 'danKyu.js'),
]
// Excluidos del subset: estos kanji se DIBUJAN como paths SVG
// (KanjiStroke), nunca se tipografían — no necesitan glifo en la fuente.
const EXCLUDE_FILES = [join(SRC, 'lib', 'kanjiStrokes.js')]
// Cara C: locales (solo el ja aporta CJK).
const LOCALE_PREFIXES = [join(SRC, 'locales') + '/']

const CJK_RE = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/u

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

function esFuente(p) {
  if (/\.(test|spec)\./.test(p)) return false
  if (EXCLUDE_FILES.includes(p)) return false
  return /\.(jsx?|tsx?|json|css)$/.test(p)
}

/** Inventario de caracteres CJK del repo, clasificado por cara. */
export function escanearRepo() {
  const en = { core: new Set(), ext: new Set(), ja: new Set() }
  for (const p of walk(SRC)) {
    if (!esFuente(p)) continue
    const destino = LOCALE_PREFIXES.some((pre) => p.startsWith(pre))
      ? 'ja'
      : DATA_PREFIXES.some((pre) => p.startsWith(pre))
        ? 'ext'
        : 'core'
    const texto = readFileSync(p, 'utf8')
    for (const ch of texto) {
      if (CJK_RE.test(ch)) en[destino].add(ch)
    }
  }
  // Prioridad core > ext > ja: un kanji del chrome no se repite en B/C.
  for (const ch of en.core) {
    en.ext.delete(ch)
    en.ja.delete(ch)
  }
  for (const ch of en.ext) en.ja.delete(ch)
  return {
    core: [...en.core].sort(),
    ext: [...en.ext].sort(),
    ja: [...en.ja].sort(),
  }
}

/** Latín + puntuación que la display cubre en títulos (cara core). */
function latinBase() {
  const out = []
  const rangos = [
    [0x20, 0x7e], // ASCII imprimible
    [0x2010, 0x2027], // guiones, comillas, puntos suspensivos, bullet
  ]
  for (const [a, b] of rangos) {
    for (let c = a; c <= b; c++) out.push(String.fromCodePoint(c))
  }
  // Latin-1: solo lo que el español real usa en títulos (no el bloque entero).
  out.push(...'¡¿ÁÉÍÓÚÜÑáéíóúüñ·×°')
  return out
}

/** Codepoints → valor unicode-range comprimido (U+X, U+X-Y, …). */
function aUnicodeRange(chars) {
  const cps = [...new Set(chars.map((c) => c.codePointAt(0)))].sort((a, b) => a - b)
  const partes = []
  let ini = cps[0]
  let fin = cps[0]
  for (const cp of cps.slice(1)) {
    if (cp === fin + 1) {
      fin = cp
    } else {
      partes.push(ini === fin ? `U+${ini.toString(16).toUpperCase()}` : `U+${ini.toString(16).toUpperCase()}-${fin.toString(16).toUpperCase()}`)
      ini = cp
      fin = cp
    }
  }
  partes.push(ini === fin ? `U+${ini.toString(16).toUpperCase()}` : `U+${ini.toString(16).toUpperCase()}-${fin.toString(16).toUpperCase()}`)
  return partes.join(', ')
}

const inventario = escanearRepo()

if (CHECK) {
  if (!existsSync(MANIFEST)) {
    console.error('display-font-manifest.json no existe — corre npm run build:display-font')
    process.exit(1)
  }
  const prev = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const previos = new Set([...prev.core, ...prev.ext, ...prev.ja])
  const nuevos = [...inventario.core, ...inventario.ext, ...inventario.ja].filter(
    (ch) => !previos.has(ch),
  )
  if (nuevos.length > 0) {
    console.error(
      `ANTI-TOFU: ${nuevos.length} caracteres CJK nuevos fuera de los subsets de AS Display: ${nuevos.join(' ')}\n` +
        'Regenera con: npm run build:display-font (necesita la TTF, ver build:display-font:fetch)',
    )
    process.exit(1)
  }
  console.log('Subsets de AS Display al día (anti-tofu OK)')
  process.exit(0)
}

if (!existsSync(TTF)) {
  console.log(`TTF no encontrada en ${TTF} — descargando…`)
  mkdirSync(dirname(TTF), { recursive: true })
  execSync(`curl -sL -o "${TTF}" "${FONT_URL}"`)
  execSync(`curl -sL -o "${OFL}" "https://raw.githubusercontent.com/google/fonts/main/ofl/zenoldmincho/OFL.txt"`)
}

const ttf = readFileSync(TTF)
const caras = {
  core: [...latinBase(), ...inventario.core],
  ext: inventario.ext,
  ja: inventario.ja,
}

mkdirSync(OUT_FONTS, { recursive: true })
mkdirSync(dirname(OUT_CSS), { recursive: true })
// Limpia builds anteriores (nombres con hash distinto quedarían huérfanos).
for (const f of existsSync(OUT_FONTS) ? readdirSync(OUT_FONTS) : []) {
  if (/^as-display-/.test(f)) rmSync(join(OUT_FONTS, f))
}

const resultados = {}
for (const [cara, chars] of Object.entries(caras)) {
  if (chars.length === 0) continue
  const woff2 = await subsetFont(ttf, chars.join(''), { targetFormat: 'woff2' })
  const hash = createHash('sha256').update(woff2).digest('hex').slice(0, 8)
  const nombre = `as-display-${cara}.${hash}.woff2`
  writeFileSync(join(OUT_FONTS, nombre), woff2)
  resultados[cara] = { nombre, kb: (woff2.length / 1024).toFixed(1), range: aUnicodeRange(chars), chars: chars.length }
}
if (existsSync(OFL)) copyFileSync(OFL, join(OUT_FONTS, 'OFL.txt'))

// Presupuesto en DOS topes duros (política 2026-06-12, decisión del owner):
//  - core+ext ≤120KB: el camino que paga una visita normal (core se
//    precarga; ext baja lazy con el primer kanji en pantalla).
//  - total ≤180KB: techo de TODO lo descargable (incluida la cara ja,
//    lazy por unicode-range y cacheada inmutable). El rediseño Kessen
//    firma con kanji (sellos, marcas de agua, kanji de universo) y ese
//    coste se declara aquí en vez de fingir que el total cabe en 120.
const PRESUPUESTO_CRITICO_KB = 120
const PRESUPUESTO_TOTAL_KB = 180
const totalKb = Object.values(resultados).reduce((a, r) => a + Number(r.kb), 0)
const presupuestoKb = Number(resultados.core?.kb ?? 0) + Number(resultados.ext?.kb ?? 0)

// Fallback métrico sobre Georgia: anula el CLS del swap (valores medidos
// sobre la TTF real: ascent 880/1000, descent 120/1000, em ~97%).
const css = `/* GENERADO por scripts/subset-display-font.mjs — NO editar a mano.
   AS Display = Zen Old Mincho 700 (OFL, licencia en /fonts/OFL.txt) en
   ${Object.keys(resultados).length} caras con unicode-range; solo la cara core se precarga.
   core+ext ${presupuestoKb.toFixed(1)}KB (tope 120) · total ${totalKb.toFixed(1)}KB (tope 180). */
${Object.entries(resultados)
  .map(
    ([cara, r]) => `@font-face {
  font-family: 'AS Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/${r.nombre}') format('woff2');
  unicode-range: ${r.range};
}`,
  )
  .join('\n')}
@font-face {
  font-family: 'AS Display Fallback';
  src: local('Georgia');
  size-adjust: 97%;
  ascent-override: 88%;
  descent-override: 12%;
  line-gap-override: 0%;
}
`
writeFileSync(OUT_CSS, css)
writeFileSync(
  MANIFEST,
  JSON.stringify({ generado: 'scripts/subset-display-font.mjs', ...inventario, archivos: resultados }, null, 2) + '\n',
)

// Mantiene el preload de la cara core en index.html apuntando al hash nuevo.
const INDEX_HTML = join(FRONTEND, 'index.html')
if (existsSync(INDEX_HTML) && resultados.core) {
  const html = readFileSync(INDEX_HTML, 'utf8')
  const actualizado = html.replace(
    /href="\/fonts\/as-display-core\.[0-9a-f]{8}\.woff2"/,
    `href="/fonts/${resultados.core.nombre}"`,
  )
  if (actualizado !== html) writeFileSync(INDEX_HTML, actualizado)
}

for (const [cara, r] of Object.entries(resultados)) {
  console.log(`${cara}: ${r.nombre} — ${r.kb}KB (${r.chars} chars)`)
}
console.log(
  `core+ext: ${presupuestoKb.toFixed(1)}KB ${presupuestoKb <= PRESUPUESTO_CRITICO_KB ? 'OK' : `⚠️ SOBRE PRESUPUESTO (${PRESUPUESTO_CRITICO_KB}KB)`} · ` +
    `total con ja: ${totalKb.toFixed(1)}KB ${totalKb <= PRESUPUESTO_TOTAL_KB ? 'OK' : `⚠️ SOBRE TECHO TOTAL (${PRESUPUESTO_TOTAL_KB}KB)`}`,
)
if (presupuestoKb > PRESUPUESTO_CRITICO_KB || totalKb > PRESUPUESTO_TOTAL_KB) process.exit(1)
