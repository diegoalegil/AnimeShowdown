#!/usr/bin/env node
// Backfill de género + favourites (popularidad) desde AniList para cada
// personaje del catálogo, para sembrar el ELO-semilla del ranking canónico.
//
// Lee backend/src/main/resources/personajes-seed.json (slug, nombre, anime) y
// escribe backend/src/main/resources/personajes-anilist.json:
//   { "<slug>": { "genero": "F"|"M"|"O"|null, "favourites": <int|null>,
//                 "anilistName": "...", "animeMatch": bool } }
//
// Estrategia de match: Page.characters(search: nombre, sort: FAVOURITES_DESC),
// y entre los candidatos se elige el que tenga un media cuyo título coincida con
// nuestro `anime` (contains normalizado en cualquier dirección); si ninguno
// coincide, el primero (el más favoriteado, que para nombres canónicos suele ser
// el correcto). El resultado se commitea = revisable en el diff del PR.
//
// Rate-limit respetuoso: lotes con alias + pausa entre requests + reintento ante
// 429 (Retry-After). Reanudable: conserva entradas ya resueltas del JSON previo.
//
// Uso: node scripts/data/backfill-anilist-genero.mjs [--limit N] [--batch N] [--force]

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const SEED = resolve(ROOT, 'backend/src/main/resources/personajes-seed.json')
const OUT = resolve(ROOT, 'backend/src/main/resources/personajes-anilist.json')
const ENDPOINT = 'https://graphql.anilist.co'

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const LIMIT = Number(getArg('--limit', '0')) || 0 // 0 = todos
const BATCH = Number(getArg('--batch', '10'))
const FORCE = args.includes('--force')
const PAUSE_MS = Number(getArg('--pause', '1600'))

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function mapGenero(g) {
  if (!g) return null
  const v = g.toLowerCase()
  if (v === 'female') return 'F'
  if (v === 'male') return 'M'
  return 'O'
}

function pickCandidate(candidates, anime) {
  if (!candidates || candidates.length === 0) return null
  const animeN = norm(anime)
  if (animeN) {
    for (const c of candidates) {
      const titles = (c.media?.nodes || []).flatMap((n) => [n.title?.romaji, n.title?.english])
      for (const t of titles) {
        const tn = norm(t)
        if (tn && (tn.includes(animeN) || animeN.includes(tn))) {
          return { ...c, animeMatch: true }
        }
      }
    }
  }
  return { ...candidates[0], animeMatch: false }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function queryBatch(batch) {
  // Una query con N alias Page; variables $s0..$sN evitan problemas de escaping.
  const decls = batch.map((_, i) => `$s${i}: String`).join(', ')
  const blocks = batch
    .map(
      (_, i) => `c${i}: Page(perPage: 4) { characters(search: $s${i}, sort: FAVOURITES_DESC) {
        name { full } gender favourites media(perPage: 3, sort: POPULARITY_DESC) { nodes { title { romaji english } } }
      } }`,
    )
    .join('\n')
  const query = `query(${decls}) {\n${blocks}\n}`
  const variables = Object.fromEntries(batch.map((p, i) => [`s${i}`, p.nombre]))

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') || '60')
      console.warn(`  429 rate-limited; espera ${retry}s`)
      await sleep((retry + 1) * 1000)
      continue
    }
    if (!res.ok) {
      console.warn(`  HTTP ${res.status}; reintento`)
      await sleep(3000)
      continue
    }
    const json = await res.json()
    if (json.errors) {
      console.warn('  GraphQL errors:', JSON.stringify(json.errors).slice(0, 200))
    }
    return json.data || {}
  }
  throw new Error('Demasiados reintentos contra AniList')
}

async function main() {
  const personajes = JSON.parse(readFileSync(SEED, 'utf8'))
  const out = existsSync(OUT) && !FORCE ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

  let pendientes = personajes.filter((p) => FORCE || !(p.slug in out))
  if (LIMIT > 0) pendientes = pendientes.slice(0, LIMIT)
  console.log(`Personajes: ${personajes.length} · pendientes: ${pendientes.length} · batch ${BATCH}`)

  let matched = 0
  let conGenero = 0
  for (let i = 0; i < pendientes.length; i += BATCH) {
    const batch = pendientes.slice(i, i + BATCH)
    let data
    try {
      data = await queryBatch(batch)
    } catch (e) {
      console.error('Batch falló, se guarda lo acumulado:', e.message)
      break
    }
    batch.forEach((p, j) => {
      const cands = data[`c${j}`]?.characters || []
      const best = pickCandidate(cands, p.anime)
      if (!best) {
        out[p.slug] = { genero: null, favourites: null, anilistName: null, animeMatch: false }
        return
      }
      const genero = mapGenero(best.gender)
      out[p.slug] = {
        genero,
        favourites: typeof best.favourites === 'number' ? best.favourites : null,
        anilistName: best.name?.full ?? null,
        animeMatch: best.animeMatch,
      }
      if (best.name?.full) matched++
      if (genero) conGenero++
    })
    // persistimos incremental (reanudable) y mostramos progreso
    writeFileSync(OUT, JSON.stringify(sortKeys(out), null, 2) + '\n')
    process.stdout.write(`  ${Math.min(i + BATCH, pendientes.length)}/${pendientes.length}\r`)
    if (i + BATCH < pendientes.length) await sleep(PAUSE_MS)
  }

  const total = Object.keys(out).length
  const fem = Object.values(out).filter((v) => v.genero === 'F').length
  const masc = Object.values(out).filter((v) => v.genero === 'M').length
  const sinGenero = Object.values(out).filter((v) => !v.genero).length
  console.log(
    `\nListo. total=${total} matched=${matched} conGénero(esta corrida)=${conGenero}\n` +
      `  F=${fem} M=${masc} O/desconocido=${total - fem - masc} sinGénero=${sinGenero}\n` +
      `  → ${OUT}`,
  )
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
