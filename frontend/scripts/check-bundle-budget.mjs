#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'dist', 'assets')
const maxIndexRawKb = Number(process.env.MAX_INDEX_RAW_KB ?? 350)
const maxIndexGzipKb = Number(process.env.MAX_INDEX_GZIP_KB ?? 250)

function fail(message) {
  console.error(`ERROR bundle budget: ${message}`)
  process.exitCode = 1
}

function sizeKb(bytes) {
  return bytes / 1024
}

if (!existsSync(assetsDir)) {
  fail(`no existe ${assetsDir}. Ejecuta npm run build:no-images antes.`)
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

const personaje3dChunks = files.filter((file) => /^personaje3d-.*\.js$/.test(file))
if (personaje3dChunks.length === 0) {
  fail('no se encontró chunk personaje3d-*.js')
} else {
  console.log(`personaje3d chunks: ${personaje3dChunks.join(', ')}`)
}

// Ajuste de robustez (2026-05-22): el check original fallaba si EXISTIA
// cualquier Personaje3D-*.js. Pero React.lazy genera un boundary chunk
// chiquito (~1KB) con solo el import() dinamico — eso NO contiene
// react-three/fiber, solo es el lazy wrapper. El peso real va al chunk
// manual 'personaje3d' (verificado arriba). Solo fallamos si el wrapper
// pesa > 50KB (señal de que NO se aislo bien).
const legacy3dChunks = files.filter((file) => /^Personaje3D-.*\.js$/.test(file))
for (const chunk of legacy3dChunks) {
  const rawBytes = statSync(join(assetsDir, chunk)).size
  if (rawBytes > 50 * 1024) {
    fail(`Personaje3D-*.js chunk pesado (${sizeKb(rawBytes).toFixed(1)}KB) — react-three no esta aislado en chunk 'personaje3d'`)
  } else {
    console.log(`Personaje3D lazy boundary: ${chunk} (${sizeKb(rawBytes).toFixed(1)}KB, OK)`)
  }
}

if (process.exitCode) process.exit(process.exitCode)
console.log('Bundle budget OK')
