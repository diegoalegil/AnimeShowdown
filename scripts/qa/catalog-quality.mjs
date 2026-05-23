#!/usr/bin/env node
/**
 * Revisión de calidad del catálogo de AnimeShowdown.
 *
 * Cruza 4 fuentes de verdad:
 *   - backend/src/main/resources/personajes-seed.json (canónico)
 *   - frontend/src/data/personajes-tags.js (tags otaku)
 *   - frontend/src/data/glossary.json o equivalente (glossary)
 *   - frontend/public/assets/* + frontend/img/* (imágenes en disco)
 *
 * Reporta:
 *   - Slugs duplicados (mismo slug en >1 personaje)
 *   - Personajes sin imagen en disco
 *   - Tags huérfanos (apuntan a slugs que no existen)
 *   - Términos del glossary sin cross-link a /personajes?tag=X
 *   - Imágenes en disco sin personaje asociado
 *   - Caracteres especiales en slugs (no [a-z0-9_-])
 *
 * Output: private/qa/catalog-quality.md
 *
 * Uso:
 *   node scripts/qa/catalog-quality.mjs
 *
 * No requiere red, no requiere DB. Lee solo archivos locales.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PERSONAJES_SEED = join(ROOT, 'backend/src/main/resources/personajes-seed.json')
const TAGS_FILE = join(ROOT, 'frontend/src/data/personajes-tags.js')
const FRONTEND_IMG = join(ROOT, 'frontend/img')
const FRONTEND_PUBLIC_ASSETS = join(ROOT, 'frontend/public/assets')
const OUTPUT = join(ROOT, 'private/qa/catalog-quality.md')

// ---------- Loaders ----------

function loadPersonajes() {
  const raw = JSON.parse(readFileSync(PERSONAJES_SEED, 'utf8'))
  const arr = Array.isArray(raw) ? raw : raw.personajes ?? []
  return arr.map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    anime: p.anime,
    descripcion: p.descripcion ?? '',
    imagenUrl: p.imagenUrl ?? '',
  }))
}

function loadTags() {
  // El archivo es JS, contiene `const PERSONAJES_TAGS = { slug: ['tag1', 'tag2'], ... }`
  // con comentarios `// ====== Anime ======` por bloques.
  // Parseamos línea por línea: cada entry es `  slug: ['a', 'b'],`
  const src = readFileSync(TAGS_FILE, 'utf8')
  const tags = {}
  // Regex: captura slug + array de strings entre []. Permite saltos de linea.
  const re = /^\s+([a-z][a-z0-9_-]*):\s*\[([^\]]+)\]/gm
  let m
  while ((m = re.exec(src)) !== null) {
    const slug = m[1]
    const arr = m[2]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    if (arr.length > 0) tags[slug] = arr
  }
  return tags
}

function loadGlossary() {
  // Glossary actualmente vive hardcoded en GlossaryPage.jsx (const TERMINOS).
  // Lo leemos extrayendo solo los `termino:` con regex — no necesitamos
  // parsear el array entero, solo los nombres.
  const candidates = [
    join(ROOT, 'frontend/src/data/glossary.json'),
    join(ROOT, 'frontend/src/data/glosario.json'),
    join(ROOT, 'frontend/src/pages/GlossaryPage.jsx'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    if (path.endsWith('.json')) {
      return { path, data: JSON.parse(readFileSync(path, 'utf8')) }
    }
    // JSX: extraer todos los `termino: 'X'` o `termino: "X"`
    const src = readFileSync(path, 'utf8')
    const terms = []
    const re = /termino:\s*['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(src)) !== null) {
      terms.push({ termino: m[1] })
    }
    if (terms.length > 0) {
      return { path, data: terms }
    }
  }
  return null
}

function listImagesByAnime() {
  // Mapea: anime_dir -> Set<slug_normalizado>
  const byAnime = {}
  if (!existsSync(FRONTEND_IMG)) return byAnime
  for (const dir of readdirSync(FRONTEND_IMG)) {
    const full = join(FRONTEND_IMG, dir)
    try {
      if (!statSync(full).isDirectory()) continue
    } catch {
      continue
    }
    if (dir === 'cuts' || dir === 'tmp' || dir.startsWith('stage')) continue
    const files = readdirSync(full)
    const slugs = new Set()
    for (const f of files) {
      if (f === '.DS_Store' || f.endsWith('.dominant.json')) continue
      if (!/\.(webp|avif|png|jpg|jpeg|svg)$/i.test(f)) continue
      // Quitar -300.webp, -600.webp, -1024.avif, etc.
      const base = f.replace(/-(300|600|1024)\.(webp|avif|png|jpg|jpeg)$/i, '')
                    .replace(/\.(webp|avif|png|jpg|jpeg|svg)$/i, '')
                    .toLowerCase()
      slugs.add(base)
    }
    byAnime[dir] = slugs
  }
  return byAnime
}

// ---------- Análisis ----------

function findDuplicateSlugs(personajes) {
  const counts = {}
  for (const p of personajes) {
    counts[p.slug] = (counts[p.slug] || 0) + 1
  }
  return Object.entries(counts).filter(([, n]) => n > 1).map(([slug, n]) => ({ slug, count: n }))
}

function findInvalidSlugs(personajes) {
  const VALID = /^[a-z0-9_-]+$/
  return personajes.filter((p) => !VALID.test(p.slug))
}

function findCharactersWithoutImage(personajes) {
  const missing = []
  for (const p of personajes) {
    const url = p.imagenUrl
    if (!url) {
      missing.push({ slug: p.slug, nombre: p.nombre, motivo: 'imagenUrl vacío en seed' })
      continue
    }
    // imagenUrl es típicamente /img/Anime/slug.webp
    const relPath = url.replace(/^\//, '')
    const full = join(ROOT, 'frontend', relPath)
    if (!existsSync(full)) {
      missing.push({ slug: p.slug, nombre: p.nombre, motivo: `archivo no existe: ${url}` })
    }
  }
  return missing
}

function findOrphanTags(tags, personajes) {
  const validSlugs = new Set(personajes.map((p) => p.slug))
  const orphans = []
  for (const slug of Object.keys(tags)) {
    if (!validSlugs.has(slug)) {
      orphans.push({ slug, tags: tags[slug] })
    }
  }
  return orphans
}

function findGlossaryTermsWithoutCrosslink(glossary, tags) {
  if (!glossary?.data) return { unsupported: true, terms: [] }
  // Recolectar todos los rasgos otaku que aparecen en personajes-tags
  const allTags = new Set()
  for (const slugTags of Object.values(tags)) {
    if (Array.isArray(slugTags)) {
      for (const t of slugTags) allTags.add(t.toLowerCase())
    }
  }
  // Términos del glossary
  const terms = Array.isArray(glossary.data) ? glossary.data : glossary.data.terms ?? []
  const result = []
  for (const term of terms) {
    const id = (term.id ?? term.slug ?? term.termino ?? term.term ?? '').toLowerCase()
    const linked = allTags.has(id)
    result.push({ termino: id, linked })
  }
  return { unsupported: false, terms: result }
}

function findOrphanImages(personajes, imagesByAnime) {
  // Para cada anime en disco, qué slugs hay que NO están en seed
  const validSlugs = new Set(personajes.map((p) => p.slug))
  const orphans = []
  for (const [anime, slugs] of Object.entries(imagesByAnime)) {
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        orphans.push({ anime, slug })
      }
    }
  }
  return orphans
}

// ---------- Reporte ----------

function generateReport(data) {
  const { personajes, duplicates, invalidSlugs, missingImages, orphanTags, glossaryStatus, orphanImages, tags, imagesByAnime } = data

  const lines = []
  lines.push('# Revisión de calidad del catálogo')
  lines.push('')
  lines.push(`> Generado: ${new Date().toISOString()}`)
  lines.push(`> Script: \`scripts/qa/catalog-quality.mjs\``)
  lines.push('')

  // Resumen
  lines.push('## Resumen')
  lines.push('')
  lines.push(`| Métrica | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Personajes en seed | ${personajes.length} |`)
  lines.push(`| Slugs duplicados | ${duplicates.length} ${duplicates.length === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Slugs con caracteres inválidos | ${invalidSlugs.length} ${invalidSlugs.length === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Personajes sin imagen accesible | ${missingImages.length} ${missingImages.length === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Tags huérfanos (slug no existe) | ${orphanTags.length} ${orphanTags.length === 0 ? '✓' : '⚠'} |`)
  lines.push(`| Imágenes huérfanas (slug sin seed) | ${orphanImages.length} ${orphanImages.length === 0 ? '✓' : '⚠'} |`)
  if (!glossaryStatus.unsupported) {
    const linked = glossaryStatus.terms.filter((t) => t.linked).length
    const unlinked = glossaryStatus.terms.length - linked
    lines.push(`| Términos glossary linkados con tag | ${linked} / ${glossaryStatus.terms.length} |`)
    lines.push(`| Términos glossary sin tag cross-link | ${unlinked} ${unlinked === 0 ? '✓' : '⚠'} |`)
  } else {
    lines.push(`| Glossary | no encontrado |`)
  }
  lines.push(`| Animes en disco | ${Object.keys(imagesByAnime).length} |`)
  lines.push(`| Tags definidos | ${Object.keys(tags).length} |`)
  lines.push('')

  // Sección detalle
  if (duplicates.length > 0) {
    lines.push('## ⚠ Slugs duplicados')
    lines.push('')
    lines.push('Mismo slug en >1 personaje. Esto rompe lookups por slug y queries.')
    lines.push('')
    lines.push('| Slug | Apariciones |')
    lines.push('|---|---|')
    for (const d of duplicates) {
      lines.push(`| \`${d.slug}\` | ${d.count} |`)
    }
    lines.push('')
  }

  if (invalidSlugs.length > 0) {
    lines.push('## ⚠ Slugs con caracteres inválidos')
    lines.push('')
    lines.push('Slugs que no matchean `[a-z0-9_-]+`. Causa problemas en URLs y queries.')
    lines.push('')
    lines.push('| Slug | Nombre |')
    lines.push('|---|---|')
    for (const p of invalidSlugs) {
      lines.push(`| \`${p.slug}\` | ${p.nombre} |`)
    }
    lines.push('')
  }

  if (missingImages.length > 0) {
    lines.push('## ⚠ Personajes sin imagen accesible')
    lines.push('')
    lines.push(`Total: ${missingImages.length}. Mostrando los primeros 30.`)
    lines.push('')
    lines.push('| Slug | Nombre | Motivo |')
    lines.push('|---|---|---|')
    for (const p of missingImages.slice(0, 30)) {
      lines.push(`| \`${p.slug}\` | ${p.nombre} | ${p.motivo} |`)
    }
    if (missingImages.length > 30) {
      lines.push(`| ... | ... | ${missingImages.length - 30} más |`)
    }
    lines.push('')
  }

  if (orphanTags.length > 0) {
    lines.push('## ⚠ Tags huérfanos')
    lines.push('')
    lines.push('Slugs en `personajes-tags.js` que NO existen en `personajes-seed.json`.')
    lines.push('')
    lines.push('| Slug | Tags |')
    lines.push('|---|---|')
    for (const o of orphanTags) {
      lines.push(`| \`${o.slug}\` | ${(o.tags || []).join(', ')} |`)
    }
    lines.push('')
  }

  if (!glossaryStatus.unsupported) {
    const unlinked = glossaryStatus.terms.filter((t) => !t.linked)
    if (unlinked.length > 0) {
      lines.push('## ⚠ Términos glossary sin cross-link a personajes')
      lines.push('')
      lines.push('Estos términos del glossary no aparecen como tag en `personajes-tags.js`.')
      lines.push('Si añadiéramos `/personajes?tag=<term>`, estos no devolverían resultados.')
      lines.push('')
      lines.push('| Término |')
      lines.push('|---|')
      for (const t of unlinked) {
        lines.push(`| \`${t.termino}\` |`)
      }
      lines.push('')
    }
  }

  if (orphanImages.length > 0) {
    lines.push('## ⚠ Imágenes huérfanas (slug en disco sin entry en seed)')
    lines.push('')
    lines.push(`Total: ${orphanImages.length}. Mostrando los primeros 30.`)
    lines.push('')
    lines.push('Posibles causas: personajes borrados del seed sin borrar imágenes, slugs renombrados con archivo viejo quedó, archivo de variant (-300, -600) mal capturado.')
    lines.push('')
    lines.push('| Anime | Slug |')
    lines.push('|---|---|')
    for (const o of orphanImages.slice(0, 30)) {
      lines.push(`| ${o.anime} | \`${o.slug}\` |`)
    }
    if (orphanImages.length > 30) {
      lines.push(`| ... | ... ${orphanImages.length - 30} más |`)
    }
    lines.push('')
  }

  // Salud por anime
  lines.push('## Cobertura por anime (top 20 con más personajes)')
  lines.push('')
  const animeStats = {}
  for (const p of personajes) {
    animeStats[p.anime] = (animeStats[p.anime] || 0) + 1
  }
  const sorted = Object.entries(animeStats).sort((a, b) => b[1] - a[1]).slice(0, 20)
  lines.push('| Anime | Personajes |')
  lines.push('|---|---|')
  for (const [anime, count] of sorted) {
    lines.push(`| ${anime} | ${count} |`)
  }
  lines.push('')

  // Verdict
  lines.push('## Veredicto')
  lines.push('')
  const total = duplicates.length + invalidSlugs.length + missingImages.length + orphanTags.length
  if (total === 0) {
    lines.push('**✓ Catálogo en buen estado.** Sin issues críticos detectados en el análisis estático.')
  } else {
    lines.push(`**${total} issues** detectados que merecen atención. Priorizar duplicados y missing images primero — son lo que se rompe en runtime.`)
  }
  lines.push('')

  return lines.join('\n')
}

// ---------- Main ----------

console.log('Revisión de catálogo...')
const personajes = loadPersonajes()
console.log(`  ${personajes.length} personajes cargados`)

const tags = loadTags()
console.log(`  ${Object.keys(tags).length} tags cargados`)

const glossary = loadGlossary()
console.log(`  glossary: ${glossary ? glossary.path : 'no encontrado'}`)

const imagesByAnime = listImagesByAnime()
console.log(`  ${Object.keys(imagesByAnime).length} carpetas de anime con imágenes`)

const data = {
  personajes,
  tags,
  imagesByAnime,
  duplicates: findDuplicateSlugs(personajes),
  invalidSlugs: findInvalidSlugs(personajes),
  missingImages: findCharactersWithoutImage(personajes),
  orphanTags: findOrphanTags(tags, personajes),
  glossaryStatus: findGlossaryTermsWithoutCrosslink(glossary, tags),
  orphanImages: findOrphanImages(personajes, imagesByAnime),
}

const report = generateReport(data)
import('node:fs').then(({ writeFileSync }) => {
  writeFileSync(OUTPUT, report)
  console.log(`\nReport: ${OUTPUT}`)
  console.log(`\nResumen:`)
  console.log(`  duplicados: ${data.duplicates.length}`)
  console.log(`  slugs inválidos: ${data.invalidSlugs.length}`)
  console.log(`  sin imagen: ${data.missingImages.length}`)
  console.log(`  tags huérfanos: ${data.orphanTags.length}`)
  console.log(`  imágenes huérfanas: ${data.orphanImages.length}`)
})
