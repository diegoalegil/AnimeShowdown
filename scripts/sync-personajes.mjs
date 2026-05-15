#!/usr/bin/env node
/**
 * sync-personajes.mjs
 *
 * Escanea frontend/img/<Anime>/<slug>.webp como fuente de verdad del catálogo
 * y genera:
 *   - frontend/src/data/personajes.js       (array consumido por el frontend)
 *   - backend/src/main/resources/personajes-seed.json (seed que DataSeeder carga al arrancar)
 *
 * Fuentes adicionales:
 *   - scripts/data/anime-display-names.json   (folder → display name del anime)
 *   - scripts/data/personajes-overrides.json  (slug → {nombre, descripcion} curados)
 *
 * Filosofía: la carpeta manda. Si un personaje desaparece de img/ desaparece
 * del catálogo. Si aparece uno nuevo, entra automáticamente con nombre derivado
 * del slug y descripción placeholder (a refinar editando el JSON de overrides).
 *
 * Uso:
 *   node scripts/sync-personajes.mjs           # regenera ambos outputs
 *   node scripts/sync-personajes.mjs --dry-run # solo imprime el resumen
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename, extname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const IMG_DIR = join(ROOT, 'frontend', 'img')
const OUT_FRONTEND = join(ROOT, 'frontend', 'src', 'data', 'personajes.js')
const OUT_BACKEND = join(ROOT, 'backend', 'src', 'main', 'resources', 'personajes-seed.json')
const ANIME_NAMES_FILE = join(__dirname, 'data', 'anime-display-names.json')
const OVERRIDES_FILE = join(__dirname, 'data', 'personajes-overrides.json')

const DRY_RUN = process.argv.includes('--dry-run')

// ─── carga de configuración ─────────────────────────────────────────────────

const animeNames = JSON.parse(readFileSync(ANIME_NAMES_FILE, 'utf8'))
const overrides = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'))
// _meta es solo documentación dentro del JSON, no es un slug
delete overrides._meta

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Folder name "Chainsaw_Man" → "Chainsaw Man" (o lo que diga el override). */
function getAnimeDisplayName(folder) {
  if (animeNames[folder]) return animeNames[folder]
  // default: reemplaza guiones bajos por espacios, conserva mayúsculas
  return folder.replace(/_/g, ' ')
}

/** Slug "denji" → "Denji"; "monkey_d_luffy" → "Monkey D Luffy" (capitaliza palabras). */
function deriveName(slug) {
  return slug
    .split('_')
    .map(w => (w.length <= 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

// ─── escaneo de img/ ────────────────────────────────────────────────────────

function scanFolder() {
  const entries = []
  const folders = readdirSync(IMG_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  for (const folder of folders) {
    const animeDisplay = getAnimeDisplayName(folder)
    const files = readdirSync(join(IMG_DIR, folder), { withFileTypes: true })
      .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.webp'))
      .map(f => f.name)
      .sort()

    for (const file of files) {
      const slug = basename(file, extname(file))
      const override = overrides[slug] || {}
      const nombre = override.nombre || deriveName(slug)
      const descripcion = override.descripcion || `Personaje del anime ${animeDisplay}.`
      const imagenUrl = `/img/${folder}/${file}`

      entries.push({
        slug,
        nombre,
        anime: animeDisplay,
        descripcion,
        imagenUrl,
        _folder: folder, // metadata interna, no se escribe
      })
    }
  }
  return entries
}

// ─── generadores de output ──────────────────────────────────────────────────

/**
 * Genera el contenido de frontend/src/data/personajes.js preservando los
 * helpers (imagenPersonaje, getPersonajeBySlug, getIndicePersonaje,
 * getPopularidad, getStatsPersonaje). El bloque de POPULARIDAD se mantiene
 * porque es data curada y no depende de la carpeta img/.
 */
function generatePersonajesJs(entries) {
  // Lee el archivo actual y extrae el bloque desde "export function imagenPersonaje"
  // hasta el final. Eso preserva todos los helpers tal cual.
  const current = readFileSync(OUT_FRONTEND, 'utf8')
  const helpersStart = current.indexOf('export function imagenPersonaje')
  if (helpersStart === -1) {
    throw new Error('No se encontró el bloque de helpers en personajes.js — abortando para no perder lógica')
  }
  const helpers = current.slice(helpersStart)

  // Construye el array nuevo
  const arrayLines = entries.map(e => {
    const slug = e.slug
    const nombre = e.nombre.replace(/'/g, "\\'")
    const anime = e.anime.replace(/'/g, "\\'")
    const descripcion = e.descripcion.replace(/'/g, "\\'")
    const imagen = e.imagenUrl
    return `  { slug: '${slug}', nombre: '${nombre}', anime: '${anime}', descripcion: '${descripcion}', imagen: '${imagen}' },`
  })

  const arrayBlock = ['export const personajes = [', ...arrayLines, ']', '', ''].join('\n')

  // Sustituye imagenPersonaje del helper antiguo por la nueva implementación
  // que hace lookup en el array por slug y devuelve el campo imagen.
  const newImagenPersonaje = [
    'export function imagenPersonaje(slug) {',
    '  const p = personajes.find((x) => x.slug === slug)',
    '  return p ? p.imagen : `/img/${slug}.webp`',
    '}',
    '',
  ].join('\n')

  // Reemplaza el bloque antiguo de imagenPersonaje
  const helpersWithoutOldImg = helpers.replace(
    /export function imagenPersonaje\(slug\) \{[^}]*\}\n/,
    newImagenPersonaje + '\n',
  )

  return arrayBlock + helpersWithoutOldImg
}

/** Genera el JSON del seed backend. */
function generateSeedJson(entries) {
  const seed = entries.map(e => ({
    slug: e.slug,
    nombre: e.nombre,
    anime: e.anime,
    descripcion: e.descripcion,
    imagenUrl: e.imagenUrl,
  }))
  return JSON.stringify(seed, null, 2) + '\n'
}

// ─── main ───────────────────────────────────────────────────────────────────

function main() {
  const entries = scanFolder()
  console.log(`✓ Detectados ${entries.length} personajes en ${IMG_DIR}`)

  // Resumen por anime
  const byAnime = {}
  for (const e of entries) {
    byAnime[e.anime] = (byAnime[e.anime] || 0) + 1
  }
  console.log(`  Anime: ${Object.keys(byAnime).length} distintos`)

  // Cobertura de overrides
  const conOverride = entries.filter(e => overrides[e.slug]).length
  const sinOverride = entries.length - conOverride
  console.log(`  Con descripción curada: ${conOverride}`)
  console.log(`  Con descripción placeholder: ${sinOverride}`)

  if (DRY_RUN) {
    console.log('\n--dry-run: no se escribe nada.')
    return
  }

  const personajesJs = generatePersonajesJs(entries)
  const seedJson = generateSeedJson(entries)

  writeFileSync(OUT_FRONTEND, personajesJs)
  console.log(`✓ Generado ${OUT_FRONTEND}`)

  writeFileSync(OUT_BACKEND, seedJson)
  console.log(`✓ Generado ${OUT_BACKEND}`)
}

main()
