#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

/**
 * Cache-bust quirúrgico para Cloudflare Pages tras renames case-only.
 *
 * macOS/APFS suele tener core.ignorecase=true y Git puede representar un
 * rename como cambio de casing. Cloudflare Pages corre sobre Linux, pero su
 * CDN puede conservar paths antiguos del deploy cuando el cambio fue solo
 * de mayúsculas/minúsculas y terminar sirviendo el fallback SPA como text/html
 * para algunos .webp. Para forzar un asset nuevo sin reencodear ni depender
 * de sharp/cwebp, añadimos un chunk RIFF desconocido válido ("ASCB") a los
 * WebP afectados. Los decoders lo ignoran y el contenido visual no cambia.
 */

const ROOT = new URL('../', import.meta.url)
const TARGET_DIRS = [
  'frontend/img/Erased',
  'frontend/img/Fullmetal_Alchemist',
]

const CHUNK_ID = Buffer.from('ASCB')
const MARKER = Buffer.from('AnimeShowdown CF Pages case-only cache bust v1')

function assertWebp(buf, file) {
  if (buf.length < 12
      || buf.subarray(0, 4).toString('ascii') !== 'RIFF'
      || buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error(`${file} no parece WEBP RIFF`)
  }
}

function hasCacheBustChunk(buf) {
  let offset = 12
  while (offset + 8 <= buf.length) {
    const id = buf.subarray(offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    const dataEnd = dataStart + size
    if (dataEnd > buf.length) return false
    if (id.equals(CHUNK_ID) && buf.subarray(dataStart, dataEnd).equals(MARKER)) {
      return true
    }
    offset = dataEnd + (size % 2)
  }
  return false
}

function appendCacheBustChunk(buf) {
  const size = MARKER.length
  const padding = size % 2 ? Buffer.from([0]) : Buffer.alloc(0)
  const chunkHeader = Buffer.alloc(8)
  CHUNK_ID.copy(chunkHeader, 0)
  chunkHeader.writeUInt32LE(size, 4)
  const next = Buffer.concat([buf, chunkHeader, MARKER, padding])
  next.writeUInt32LE(next.length - 8, 4)
  return next
}

async function collectWebpFiles(dir) {
  const out = []
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && entry.name.endsWith('.webp')) {
        out.push(path)
      }
    }
  }
  await walk(dir)
  return out.sort()
}

let touched = 0
let skipped = 0
for (const dir of TARGET_DIRS) {
  const absDir = join(ROOT.pathname, dir)
  const files = await collectWebpFiles(absDir)
  for (const file of files) {
    const buf = await readFile(file)
    assertWebp(buf, file)
    if (hasCacheBustChunk(buf)) {
      skipped += 1
      continue
    }
    await writeFile(file, appendCacheBustChunk(buf))
    touched += 1
  }
}

console.log(`cache-bust WEBP: tocados=${touched} omitidos=${skipped}`)
for (const dir of TARGET_DIRS) {
  console.log(`- ${relative(ROOT.pathname, join(ROOT.pathname, dir))}`)
}
