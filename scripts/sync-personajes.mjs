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
 *   node scripts/sync-personajes.mjs --check   # falla si seed.json no coincide
 *                                              # con lo detectado (audit P2 CI)
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
const WIP_ALLOWLIST_FILE = join(__dirname, 'data', 'personajes-wip-allowlist.json')

const DRY_RUN = process.argv.includes('--dry-run')
const CHECK = process.argv.includes('--check')

// ─── carga de configuración ─────────────────────────────────────────────────

const animeNames = JSON.parse(readFileSync(ANIME_NAMES_FILE, 'utf8'))
const overrides = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'))
// _meta es solo documentación dentro del JSON, no es un slug
delete overrides._meta

// Audit P2 (2026-05-17): carpetas WIP que NO entran al seed. Permite tener
// webp en construcción en frontend/img/ sin que el CI falle ni se filtren a
// producción. Tanto el sync como el --check respetan esta lista.
const wipAllowlist = JSON.parse(readFileSync(WIP_ALLOWLIST_FILE, 'utf8'))
const wipFolders = new Set(wipAllowlist.folders ?? [])
const wipSlugs = new Set(wipAllowlist.slugs ?? [])

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

// generate-image-variants.mjs escribe variantes responsive (-300/-600/-1024
// + .avif) en frontend/img/. Si se cuela aquí, las trataríamos como
// personajes nuevos e inyectaríamos 4x el catálogo + duplicados. Lección
// aprendida en 2026-05-17: el seed terminó con 2815 entries (700 reales x
// 4 variantes) y rompió el DataSeeder con Unique constraint violations.
const VARIANT_SUFFIX = /-(?:300|600|1024)$/

function scanFolder() {
  // Primera pasada: lista cruda sin resolver conflictos
  const raw = []
  const folders = readdirSync(IMG_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  let variantesIgnoradas = 0
  let wipFoldersSkipped = 0
  let wipSlugsSkipped = 0
  const nonWebp = []
  for (const folder of folders) {
    if (wipFolders.has(folder)) {
      wipFoldersSkipped++
      continue
    }
    const animeDisplay = getAnimeDisplayName(folder)
    const allFiles = readdirSync(join(IMG_DIR, folder), { withFileTypes: true })
      .filter(f => f.isFile())
      .map(f => f.name)
      .sort()
    for (const file of allFiles) {
      const lower = file.toLowerCase()
      // Audit P2.6 (2026-05-17): detecta PNG/JPG sueltos en folders de
      // anime. El catálogo asume .webp como fuente; estos archivos no
      // se incorporan al seed y por tanto no aparecen en producción.
      // Suelen ser drops sin renombrar (nombres tipo hash). Warning
      // accionable para que el usuario los convierta o renombre.
      if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        nonWebp.push(join(folder, file))
        continue
      }
      if (!lower.endsWith('.webp')) continue
      const baseSlug = basename(file, extname(file))
      // Ignorar variantes responsive — no son personajes, son outputs del
      // pipeline de imágenes.
      if (VARIANT_SUFFIX.test(baseSlug)) {
        variantesIgnoradas++
        continue
      }
      if (wipSlugs.has(baseSlug)) {
        wipSlugsSkipped++
        continue
      }
      raw.push({ baseSlug, folder, animeDisplay, file })
    }
  }

  if (variantesIgnoradas > 0) {
    console.log(`  ℹ ${variantesIgnoradas} variantes responsive (-300/-600/-1024) ignoradas`)
  }
  if (wipFoldersSkipped > 0 || wipSlugsSkipped > 0) {
    console.log(
      `  ℹ WIP allowlist: ${wipFoldersSkipped} carpeta(s) y ${wipSlugsSkipped} slug(s) saltados (personajes-wip-allowlist.json)`,
    )
  }
  if (nonWebp.length > 0) {
    console.warn(`  ⚠ ${nonWebp.length} imagen(es) PNG/JPG sueltas — NO entran al catálogo (deben convertirse a .webp y renombrar al slug del personaje):`)
    for (const p of nonWebp.slice(0, 10)) console.warn(`     ${p}`)
    if (nonWebp.length > 10) console.warn(`     ... (+${nonWebp.length - 10} más)`)
  }

  // Detecta colisiones de slug entre anime distintos. Si un mismo slug aparece
  // en dos folders, se prefijan AMBOS con el folder lowercased (lucy + Pokemon
  // → pokemon_lucy; lucy + Elfen_Lied → elfen_lied_lucy). Si solo aparece una
  // vez, el slug queda limpio.
  const slugCount = {}
  for (const r of raw) {
    slugCount[r.baseSlug] = (slugCount[r.baseSlug] || 0) + 1
  }

  const collisions = []
  const seenFinalSlugs = new Set()
  const entries = []
  for (const r of raw) {
    const folderPrefix = r.folder.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const finalSlug = slugCount[r.baseSlug] > 1
      ? `${folderPrefix}_${r.baseSlug}`
      : r.baseSlug
    if (slugCount[r.baseSlug] > 1) {
      collisions.push(`${r.baseSlug} (${r.folder}) → ${finalSlug}`)
    }
    // Dedup defensivo final: si por alguna razón el mismo finalSlug aparece
    // dos veces (e.g. variante de carpeta + carpeta con espacio renombrada),
    // nos quedamos con el primero. Mejor que duplicar y romper el seed.
    if (seenFinalSlugs.has(finalSlug)) {
      console.warn(`  ⚠ slug duplicado descartado: ${finalSlug} (${r.folder}/${r.file})`)
      continue
    }
    seenFinalSlugs.add(finalSlug)
    // Lookup de override:
    //   - Sin colisión: acepta baseSlug como fallback (preserva descripciones
    //     curadas si el slug nunca cambió).
    //   - Con colisión: SOLO finalSlug. El fallback a baseSlug era el bug
    //     reportado el 2026-05-17 — overrides['lucy'] (descripción de Pokemon
    //     Lucy) se copiaba a Cyberpunk Lucy y Elfen Lied Lucy porque las 3
    //     compartían baseSlug. Ahora cada una requiere su propio override por
    //     el slug final (pokemon_lucy / elfen_lied_lucy / cyberpunk_edgerunners_lucy)
    //     o cae al placeholder genérico.
    const hayColision = slugCount[r.baseSlug] > 1
    const override = hayColision
      ? (overrides[finalSlug] || {})
      : (overrides[finalSlug] || overrides[r.baseSlug] || {})
    const nombre = override.nombre || deriveName(r.baseSlug)
    const descripcion = override.descripcion || `Personaje del anime ${r.animeDisplay}.`
    const imagenUrl = `/img/${r.folder}/${r.file}`
    entries.push({
      slug: finalSlug,
      nombre,
      anime: r.animeDisplay,
      descripcion,
      imagenUrl,
    })
  }

  if (collisions.length > 0) {
    console.log(`  ⚠ ${collisions.length} colisiones de slug resueltas con prefijo de folder:`)
    for (const c of collisions) console.log(`    ${c}`)
  }

  // Avisa de overrides cuya clave es un baseSlug colisionado — esos overrides
  // ya no se aplican a NINGÚN personaje (el fallback se desactivó en colisión)
  // y deberían migrarse al slug final correcto o eliminarse del JSON.
  const colisionadosKeys = new Set()
  for (const baseSlug in slugCount) {
    if (slugCount[baseSlug] > 1 && overrides[baseSlug]) {
      colisionadosKeys.add(baseSlug)
    }
  }
  if (colisionadosKeys.size > 0) {
    console.warn(
      `  ⚠ ${colisionadosKeys.size} override(s) huérfano(s) por colisión — la clave es ambigua y ya no aplica:`,
    )
    for (const k of colisionadosKeys) {
      const finales = entries.length
        ? entries.filter(e => e.slug.endsWith('_' + k) || e.slug === k).map(e => e.slug)
        : []
      console.warn(`     overrides['${k}'] → migrar a alguno de: ${finales.join(', ') || '(ver finalSlugs en collisions de arriba)'}`)
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

  // Helper imagenPersonaje vía Map slug→imagen construido una vez al cargar
  // el módulo. Antes este script generaba personajes.find() lineal — con
  // 723 personajes y la home pintando varias decenas de cards por render,
  // eso era O(n) por imagen. El Map es O(1) y se queda en memoria.
  //
  // Ojo: regresión histórica. En 2026-05-16 la regen del catálogo borró
  // el Map (porque el helpers slice empieza en 'export function
  // imagenPersonaje' y descarta lo de arriba) y el frontend rompió en
  // producción con ReferenceError: slugToImagen is not defined → todas
  // las cards salían con icono roto. Añadirlo aquí garantiza que cada
  // regeneración lo emite junto al helper.
  const slugToImagenBlock = [
    '// Map slug → ruta de imagen para lookup O(1) en cada render.',
    '// Generado por scripts/sync-personajes.mjs — no editar a mano.',
    'const slugToImagen = new Map(personajes.map((p) => [p.slug, p.imagen]))',
    '',
  ].join('\n')

  const newImagenPersonaje = [
    'export function imagenPersonaje(slug) {',
    '  // Fallback determinístico para slugs ausentes del catálogo: devolvemos',
    '  // una ruta que dará 404 visible (PersonajePlaceholder vía onError) en',
    '  // vez de undefined que dejaría el <img> en estado raro.',
    '  return slugToImagen.get(slug) ?? `/img/_missing/${slug}.webp`',
    '}',
    '',
  ].join('\n')

  // Reemplaza el bloque antiguo de imagenPersonaje (sea cual sea su
  // implementación — find() lineal antiguo o Map nuevo). El [\s\S] no
  // greedy + cierre exacto de la fn evita comerse helpers posteriores.
  const helpersWithoutOldImg = helpers.replace(
    /export function imagenPersonaje\(slug\) \{[\s\S]*?\n\}\n/,
    slugToImagenBlock + newImagenPersonaje + '\n',
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

  if (CHECK) {
    runCheck(entries)
    return
  }

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

/**
 * Modo CI: verifica que el seed.json commiteado coincide con lo que el
 * escaneo de img/ produce (ya filtrado por la WIP allowlist). Falla con
 * exit 1 si hay drift, listando qué slugs sobran o faltan. Hasta este
 * P2 (2026-05-17), CI solo hacía --dry-run y permitía pushear carpetas
 * enteras de personajes sin que entraran nunca al frontend/backend.
 */
function runCheck(entries) {
  const seed = JSON.parse(readFileSync(OUT_BACKEND, 'utf8'))
  const seedSlugs = new Set(seed.map(e => e.slug))
  const detectedSlugs = new Set(entries.map(e => e.slug))

  const missingFromSeed = [...detectedSlugs].filter(s => !seedSlugs.has(s)).sort()
  const extraInSeed = [...seedSlugs].filter(s => !detectedSlugs.has(s)).sort()

  if (missingFromSeed.length === 0 && extraInSeed.length === 0) {
    console.log(`\n✓ --check OK: seed.json (${seed.length}) coincide con el escaneo de img/ (${entries.length}).`)
    return
  }

  console.error('\n❌ --check FALLÓ: seed.json no está en sync con frontend/img/')
  if (missingFromSeed.length > 0) {
    console.error(`\n  Slugs detectados en img/ pero AUSENTES del seed (${missingFromSeed.length}):`)
    for (const s of missingFromSeed.slice(0, 30)) console.error(`    + ${s}`)
    if (missingFromSeed.length > 30) console.error(`    ... (+${missingFromSeed.length - 30} más)`)
  }
  if (extraInSeed.length > 0) {
    console.error(`\n  Slugs en seed pero AUSENTES de img/ (${extraInSeed.length}):`)
    for (const s of extraInSeed.slice(0, 30)) console.error(`    - ${s}`)
    if (extraInSeed.length > 30) console.error(`    ... (+${extraInSeed.length - 30} más)`)
  }
  console.error('\n  Fix: corre `node scripts/sync-personajes.mjs` y commitea')
  console.error('       personajes.js + personajes-seed.json. O añade el folder/slug')
  console.error('       a scripts/data/personajes-wip-allowlist.json si es WIP.')
  process.exit(1)
}

main()
