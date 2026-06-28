#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'dist', 'assets')
const imageDir = join(root, 'dist', 'img')
const htmlPath = join(root, 'dist', 'index.html')
const maxIndexRawKb = Number(process.env.MAX_INDEX_RAW_KB ?? 350)
const maxIndexGzipKb = Number(process.env.MAX_INDEX_GZIP_KB ?? 250)
const maxInitialJsGzipKb = Number(process.env.MAX_INITIAL_JS_GZIP_KB ?? 210)
const maxImageTotalMb = Number(process.env.MAX_DEPLOY_IMAGE_TOTAL_MB ?? 1100)
const maxImageFileKb = Number(process.env.MAX_DEPLOY_IMAGE_FILE_KB ?? 900)
const maxImageFileCount = Number(process.env.MAX_DEPLOY_IMAGE_FILE_COUNT ?? 8500)
const maxLazyChunkRawKb = Number(process.env.MAX_LAZY_CHUNK_RAW_KB ?? 250)
// Presupuesto de las PORTADAS/BANNERS de /assets (heroes, catalogs, banners de
// anime/torneo, covers de juegos/eventos). Son las imágenes que cargan las
// rutas pesadas (/torneos, /animes, /games). Se excluyen cartas-especiales
// (arte de carta a tamaño completo, otro caso de uso).
const maxCoverFileKb = Number(process.env.MAX_COVER_IMAGE_FILE_KB ?? 560)
const maxCoverTotalMb = Number(process.env.MAX_COVER_IMAGE_TOTAL_MB ?? 100)
const imageCdnBaseUrl = normalizeImageCdnBaseUrl(
  process.env.ANIMESHOWDOWN_IMG_CDN_BASE_URL ||
    process.env.ANIMESHOWDOWN_IMAGE_CDN_BASE_URL,
)
const requireExternalImageCdn = process.env.REQUIRE_EXTERNAL_IMAGE_CDN === 'true'

function fail(message) {
  console.error(`ERROR bundle budget: ${message}`)
  process.exitCode = 1
}

function sizeKb(bytes) {
  return bytes / 1024
}

function sizeMb(bytes) {
  return bytes / 1024 / 1024
}

function walkFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return walkFiles(fullPath)
    return entry.isFile() ? [fullPath] : []
  })
}

function normalizeImageCdnBaseUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function normalizeDistAssetPath(value) {
  try {
    return new URL(value, 'https://animeshowdown.local').pathname.replace(/^\/+/, '')
  } catch {
    return value.replace(/^\/+/, '')
  }
}

function extractInitialJsFiles(html) {
  const result = new Set()
  const tagRe = /<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = tagRe.exec(html))) {
    const [, tagName, assetRef] = match
    const tag = match[0]
    if (tagName.toLowerCase() === 'link' && !/\brel=["'][^"']*modulepreload/i.test(tag)) {
      continue
    }
    const assetPath = normalizeDistAssetPath(assetRef)
    if (!/^assets\/.+\.js$/.test(assetPath)) continue
    const fileName = assetPath.slice('assets/'.length)
    if (existsSync(join(assetsDir, fileName))) result.add(fileName)
  }
  return [...result].sort()
}

function checkExternalImageCdn(imageFiles) {
  if (!requireExternalImageCdn) return
  if (!imageCdnBaseUrl) {
    fail('REQUIRE_EXTERNAL_IMAGE_CDN=true requiere ANIMESHOWDOWN_IMG_CDN_BASE_URL valida')
    return
  }
  if (imageCdnBaseUrl.startsWith('http://')) {
    fail(`ANIMESHOWDOWN_IMG_CDN_BASE_URL debe usar https: ${imageCdnBaseUrl}`)
  }
  if (imageFiles.length > 0) {
    fail(`build CDN no debe contener dist/img; encontrados ${imageFiles.length} archivo(s)`)
  }
  const redirectsPath = join(root, 'dist', '_redirects')
  if (!existsSync(redirectsPath)) {
    fail('build CDN debe generar dist/_redirects con regla /img/* hacia CDN')
    return
  }
  const redirects = readFileSync(redirectsPath, 'utf8')
  const expected = `/img/* ${imageCdnBaseUrl}/:splat 302`
  if (!redirects.includes(expected)) {
    fail(`dist/_redirects no contiene la regla CDN esperada: ${expected}`)
  }
}

if (!existsSync(assetsDir)) {
  fail(`no existe ${assetsDir}. Ejecuta npm run build:no-images antes.`)
  process.exit()
}

if (!existsSync(htmlPath)) {
  fail(`no existe ${htmlPath}. Ejecuta npm run build:no-images antes.`)
  process.exit()
}

const files = readdirSync(assetsDir)
const indexFiles = files.filter((file) => /^index-.*\.js$/.test(file))
if (indexFiles.length !== 1) {
  fail(`se esperaba 1 index-*.js y hay ${indexFiles.length}`)
}

const indexFile = indexFiles[0]
if (indexFile) {
  const indexPath = join(assetsDir, indexFile)
  const rawBytes = statSync(indexPath).size
  const gzipBytes = gzipSync(readFileSync(indexPath)).length
  console.log(
    `index bundle: ${indexFile} raw=${sizeKb(rawBytes).toFixed(1)}KB gzip=${sizeKb(gzipBytes).toFixed(1)}KB`,
  )
  if (rawBytes > maxIndexRawKb * 1024) {
    fail(`index raw ${sizeKb(rawBytes).toFixed(1)}KB > ${maxIndexRawKb}KB`)
  }
  if (gzipBytes > maxIndexGzipKb * 1024) {
    fail(`index gzip ${sizeKb(gzipBytes).toFixed(1)}KB > ${maxIndexGzipKb}KB`)
  }
}

const initialJsFiles = extractInitialJsFiles(readFileSync(htmlPath, 'utf8'))
if (initialJsFiles.length === 0) {
  fail('no se encontraron scripts iniciales en dist/index.html')
} else {
  let initialRawBytes = 0
  let initialGzipBytes = 0
  for (const file of initialJsFiles) {
    const filePath = join(assetsDir, file)
    const source = readFileSync(filePath)
    initialRawBytes += statSync(filePath).size
    initialGzipBytes += gzipSync(source).length
  }
  console.log(
    `initial js: files=${initialJsFiles.length} raw=${sizeKb(initialRawBytes).toFixed(1)}KB gzip=${sizeKb(initialGzipBytes).toFixed(1)}KB budget=${maxInitialJsGzipKb}KB`,
  )
  console.log(`initial js files: ${initialJsFiles.join(', ')}`)
  if (initialGzipBytes > maxInitialJsGzipKb * 1024) {
    fail(`initial JS gzip ${sizeKb(initialGzipBytes).toFixed(1)}KB > ${maxInitialJsGzipKb}KB`)
  }
}

const personaje3dChunks = files.filter((file) => /^personaje3d-.*\.js$/.test(file))
if (personaje3dChunks.length === 0) {
  fail('no se encontró chunk personaje3d-*.js')
} else {
  console.log(`personaje3d chunks: ${personaje3dChunks.join(', ')}`)
  // Techo de tamaño del chunk 3D (three.js + react-three/fiber): es el más
  // pesado de la app y, al ser lazy, no tenía guard — podía crecer sin que
  // nadie lo viera. Generoso (hoy ~876KB raw); salta sólo ante crecimiento real.
  const maxPersonaje3dRawKb = Number(process.env.MAX_PERSONAJE3D_RAW_KB || 1100)
  for (const chunk of personaje3dChunks) {
    const rawKb = sizeKb(statSync(join(assetsDir, chunk)).size)
    console.log(`  ${chunk}: raw=${rawKb.toFixed(1)}KB budget=${maxPersonaje3dRawKb}KB`)
    if (rawKb > maxPersonaje3dRawKb) {
      fail(`personaje3d chunk ${chunk} raw ${rawKb.toFixed(1)}KB > ${maxPersonaje3dRawKb}KB`)
    }
  }
}

const realtimeChunks = files.filter((file) => /^realtime-.*\.js$/.test(file))
if (realtimeChunks.length === 0) {
  fail('no se encontró chunk realtime-*.js')
} else {
  console.log(`realtime chunks: ${realtimeChunks.join(', ')}`)
  for (const chunk of realtimeChunks) {
    if (initialJsFiles.includes(chunk)) {
      fail(`realtime chunk ${chunk} no debe cargarse como JS inicial`)
    }
  }
}

// React.lazy genera un boundary chunk pequeño (~1KB) con solo el import()
// dinámico: eso no contiene react-three/fiber, solo el lazy wrapper. El peso
// real va al chunk manual 'personaje3d' (verificado arriba). Solo fallamos si
// el wrapper pesa > 50KB, señal de que no se aisló bien.
const legacy3dChunks = files.filter((file) => /^Personaje3D-.*\.js$/.test(file))
for (const chunk of legacy3dChunks) {
  const rawBytes = statSync(join(assetsDir, chunk)).size
  if (rawBytes > 50 * 1024) {
    fail(`Personaje3D-*.js chunk pesado (${sizeKb(rawBytes).toFixed(1)}KB) — react-three no esta aislado en chunk 'personaje3d'`)
  } else {
    console.log(`Personaje3D lazy boundary: ${chunk} (${sizeKb(rawBytes).toFixed(1)}KB, OK)`)
  }
}

// Per-chunk ceiling: lazy vendor chunks (framer/i18n/lucide/react-vendor) +
// page route chunks no deben superar el umbral para evitar regresiones
// silenciosas tras actualizaciones de dependencias.
const vendorChunks = files.filter((file) => /^(framer|i18n|lucide|react-vendor|realtime)-.*\.js$/.test(file))
const pageChunks = files.filter((file) => /^[A-Z][^.-]+(Page|Page)-\w+\.js$/.test(file) && !/^index-/.test(file))
for (const chunk of [...vendorChunks, ...pageChunks]) {
  const rawBytes = statSync(join(assetsDir, chunk)).size
  if (rawBytes > maxLazyChunkRawKb * 1024) {
    fail(`lazy chunk ${chunk} raw ${sizeKb(rawBytes).toFixed(1)}KB > ${maxLazyChunkRawKb}KB ceiling`)
  }
}
if (vendorChunks.length > 0) {
  console.log(`vendor chunks: ${vendorChunks.join(', ')} (ceiling ${maxLazyChunkRawKb}KB)`)
}

const imageFiles = walkFiles(imageDir)
checkExternalImageCdn(imageFiles)
if (imageFiles.length > 0) {
  let imageBytes = 0
  let largestImage = { path: null, bytes: 0 }
  for (const imagePath of imageFiles) {
    const bytes = statSync(imagePath).size
    imageBytes += bytes
    if (bytes > largestImage.bytes) {
      largestImage = { path: imagePath, bytes }
    }
  }

  const largestRelativePath = largestImage.path
    ? largestImage.path.replace(`${root}/dist/`, '')
    : 'n/a'
  console.log(
    `deploy images: files=${imageFiles.length} total=${sizeMb(imageBytes).toFixed(1)}MB largest=${largestRelativePath} (${sizeKb(largestImage.bytes).toFixed(1)}KB)`,
  )

  if (imageFiles.length > maxImageFileCount) {
    fail(`imagenes ${imageFiles.length} > ${maxImageFileCount}`)
  }
  if (imageBytes > maxImageTotalMb * 1024 * 1024) {
    fail(`imagenes total ${sizeMb(imageBytes).toFixed(1)}MB > ${maxImageTotalMb}MB`)
  }
  if (largestImage.bytes > maxImageFileKb * 1024) {
    fail(`imagen mas pesada ${sizeKb(largestImage.bytes).toFixed(1)}KB > ${maxImageFileKb}KB (${largestRelativePath})`)
  }
} else {
  if (requireExternalImageCdn) {
    console.log(`deploy images: external CDN ${imageCdnBaseUrl}/:splat`)
  } else {
    console.log('deploy images: dist/img no existe o no tiene imagenes')
  }
}

// Covers/banners de /assets: el bloque dist/img de arriba solo mide personajes
// (y se salta entero cuando /img va por CDN), así que estos covers eran un punto
// ciego y volver a meter imágenes pesadas en /torneos, /animes o /games sin que
// el budget lo marque.
const coverImageExt = /\.(webp|avif|png|jpe?g)$/i
const coverFiles = walkFiles(assetsDir).filter(
  (file) => coverImageExt.test(file) && !file.includes('/cartas-especiales/'),
)
if (coverFiles.length > 0) {
  let coverBytes = 0
  let largestCover = { path: null, bytes: 0 }
  for (const coverPath of coverFiles) {
    const bytes = statSync(coverPath).size
    coverBytes += bytes
    if (bytes > largestCover.bytes) largestCover = { path: coverPath, bytes }
  }
  const largestCoverRel = largestCover.path
    ? largestCover.path.replace(`${root}/dist/`, '')
    : 'n/a'
  console.log(
    `cover images (/assets): files=${coverFiles.length} total=${sizeMb(coverBytes).toFixed(1)}MB largest=${largestCoverRel} (${sizeKb(largestCover.bytes).toFixed(1)}KB)`,
  )
  if (largestCover.bytes > maxCoverFileKb * 1024) {
    fail(
      `cover mas pesado ${sizeKb(largestCover.bytes).toFixed(1)}KB > ${maxCoverFileKb}KB (${largestCoverRel}). ` +
        'Recomprime/redimensiona con: npm run build:optimize-assets',
    )
  }
  if (coverBytes > maxCoverTotalMb * 1024 * 1024) {
    fail(`cover images total ${sizeMb(coverBytes).toFixed(1)}MB > ${maxCoverTotalMb}MB`)
  }
}

if (process.exitCode) process.exit(process.exitCode)
console.log('Bundle budget OK')
