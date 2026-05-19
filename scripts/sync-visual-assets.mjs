#!/usr/bin/env node
import { readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const repoRoot = new URL('..', import.meta.url).pathname
const publicAssetsDir = join(repoRoot, 'frontend/public/assets')
const manifestPath = join(repoRoot, 'frontend/src/data/visual-assets-manifest.js')
const exts = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif'])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(full))
      continue
    }
    const dot = entry.name.lastIndexOf('.')
    const ext = dot >= 0 ? entry.name.slice(dot).toLowerCase() : ''
    if (exts.has(ext)) files.push(full)
  }
  return files
}

const files = await walk(publicAssetsDir)
const paths = files
  .map((file) => `/${relative(join(repoRoot, 'frontend/public'), file).split(sep).join('/')}`)
  .sort()

const body = `// Generado por scripts/sync-visual-assets.mjs. Si anades portadas nuevas en
// frontend/public/assets, ejecuta ese script para que el frontend las use.
export const VISUAL_ASSET_PATHS = new Set(${JSON.stringify(paths, null, 2)})
`

await writeFile(manifestPath, body)
console.log(`visual-assets: ${paths.length} archivo(s) registrados`)
