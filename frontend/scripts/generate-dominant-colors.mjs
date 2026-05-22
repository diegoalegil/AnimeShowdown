#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')
const SEED_PATH = join(REPO_ROOT, 'backend/src/main/resources/personajes-seed.json')
const BACKEND_COLORS_PATH = join(REPO_ROOT, 'backend/src/main/resources/personajes-dominant-colors.json')

function hexByte(value) {
  return value.toString(16).padStart(2, '0')
}

function toHex(r, g, b) {
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`
}

async function dominantColor(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(16, 16, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let r = 0
  let g = 0
  let b = 0
  const pixels = Math.max(1, info.width * info.height)
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  r = Math.round(r / pixels)
  g = Math.round(g / pixels)
  b = Math.round(b / pixels)
  return { rgb: [r, g, b], hex: toHex(r, g, b) }
}

function sourcePath(imagenUrl) {
  if (!imagenUrl || !imagenUrl.startsWith('/img/')) return null
  return join(FRONTEND_ROOT, imagenUrl)
}

function dominantJsonPath(imagenUrl) {
  const filePath = sourcePath(imagenUrl)
  if (!filePath) return null
  return filePath.replace(/\.[^.]+$/, '.dominant.json')
}

const personajes = JSON.parse(readFileSync(SEED_PATH, 'utf8'))
const backendColors = {}
let generados = 0
let saltados = 0
let errores = 0

for (const personaje of personajes) {
  const img = sourcePath(personaje.imagenUrl)
  const out = dominantJsonPath(personaje.imagenUrl)
  if (!img || !out || !existsSync(img)) {
    saltados++
    continue
  }
  try {
    const color = await dominantColor(img)
    backendColors[personaje.slug] = color.hex
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(
      out,
      `${JSON.stringify({
        slug: personaje.slug,
        imagenUrl: personaje.imagenUrl,
        rgb: color.rgb,
        hex: color.hex,
      })}\n`,
    )
    generados++
  } catch (err) {
    errores++
    console.warn(`[dominant-colors] ${personaje.slug}: ${err.message}`)
  }
}

writeFileSync(BACKEND_COLORS_PATH, `${JSON.stringify(backendColors, null, 2)}\n`)

console.log(
  `[dominant-colors] generados=${generados}, saltados=${saltados}, errores=${errores}`,
)
if (errores > 0) process.exit(1)
