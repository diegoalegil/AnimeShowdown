#!/usr/bin/env node
// Elimina los sourcemaps (*.map) del artefacto de despliegue (frontend/dist).
//
// vite genera sourcemaps 'hidden' (sin referencia //# sourceMappingURL desde el
// bundle) — útiles para desminificar stack traces de Sentry —, pero Cloudflare
// Pages sirve TODO lo que hay en dist, así que sin este paso los .map quedaban
// accesibles públicamente y exponían el código fuente. Los borramos del artefacto
// final. Si en el futuro se añade subida a Sentry del release, debe ejecutarse
// ANTES de este script.
import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDir = resolve(repoRoot, 'frontend/dist')

let eliminados = 0
function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return // dist no existe (build falló antes) — nada que limpiar
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (name.endsWith('.map')) {
      unlinkSync(full)
      eliminados++
    }
  }
}

walk(distDir)
console.log(`[strip-sourcemaps] ${eliminados} archivo(s) .map eliminados de frontend/dist`)
