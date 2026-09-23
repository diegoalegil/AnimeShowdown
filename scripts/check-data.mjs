#!/usr/bin/env node
// Valida el catálogo estático (src/data/*.json) y que cada carta tenga sus
// imágenes en public/. Sale con código 1 si encuentra algún error.
//
//   node scripts/check-data.mjs
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { campoProporcion, medidasWebp } from './imagenes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const fail = (msg) => errors.push(msg)

function load(name) {
  const file = join(root, 'src/data', name)
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(data)) throw new Error('no es un array')
    return data
  } catch (err) {
    fail(`${name}: no se pudo leer (${err.message})`)
    return []
  }
}

const HEX = /^#[0-9a-f]{6}$/
const isText = (v) => typeof v === 'string' && v.trim() !== ''

function checkRequired(list, name, fields) {
  list.forEach((item, i) => {
    for (const f of fields) if (!isText(item[f])) fail(`${name}[${i}] (${item.id ?? '?'}): falta "${f}"`)
  })
}

function checkUnique(list, name, ids = new Set()) {
  for (const item of list) {
    if (ids.has(item.id)) fail(`${name}: id duplicado "${item.id}"`)
    ids.add(item.id)
  }
  return ids
}

function checkNumbering(list, name) {
  list.forEach((item, i) => {
    if (item.n !== i + 1) fail(`${name}: "${item.id}" tiene n=${item.n}, se esperaba ${i + 1}`)
  })
}

function checkFile(rel, owner) {
  if (!existsSync(join(root, 'public', rel))) fail(`${owner}: no existe public/${rel}`)
}

// `ar` (ancho / alto) solo aparece en las cartas que no son 2:3 y debe
// coincidir con la ilustración original (lo anota scripts/generate-tamanos).
function checkProporcion(item, name) {
  const original = join(root, 'public', `${item.img}.webp`)
  if (!existsSync(original)) return
  let esperado
  try {
    esperado = campoProporcion(medidasWebp(original))
  } catch (err) {
    fail(`${name}: "${item.id}" ${err.message}`)
    return
  }
  if (item.ar !== esperado) {
    fail(`${name}: "${item.id}" ar=${item.ar ?? '(sin ar)'}, la ilustración pide ${esperado ?? '(sin ar, es 2:3)'}; ejecuta scripts/generate-tamanos.mjs`)
  }
}

const personajes = load('personajes.json')
const especiales = load('especiales.json')
const animes = load('animes.json')

// Animes
checkRequired(animes, 'animes', ['id', 'titulo'])
checkUnique(animes, 'animes')
const animeById = new Map(animes.map((a) => [a.id, a]))
const countByAnime = new Map()

// Personajes
checkRequired(personajes, 'personajes', ['id', 'nombre', 'anime', 'animeId', 'img', 'color'])
const ids = checkUnique(personajes, 'personajes')
checkNumbering(personajes, 'personajes')
for (const p of personajes) {
  if (p.color && !HEX.test(p.color)) fail(`personajes: "${p.id}" color inválido "${p.color}"`)
  if ('nativo' in p && !isText(p.nativo)) fail(`personajes: "${p.id}" nativo vacío`)
  const anime = animeById.get(p.animeId)
  if (!anime) fail(`personajes: "${p.id}" animeId desconocido "${p.animeId}"`)
  else if (anime.titulo !== p.anime) fail(`personajes: "${p.id}" anime "${p.anime}" no coincide con "${anime.titulo}"`)
  countByAnime.set(p.animeId, (countByAnime.get(p.animeId) ?? 0) + 1)
  if (isText(p.img)) {
    if (/\.\w+$/.test(p.img)) fail(`personajes: "${p.id}" img debe ir sin extensión`)
    for (const suffix of ['', '-300', '-450', '-600']) checkFile(`${p.img}${suffix}.webp`, `personajes "${p.id}"`)
    checkProporcion(p, 'personajes')
  }
}
for (const a of animes) {
  if (a.count !== (countByAnime.get(a.id) ?? 0)) fail(`animes: "${a.id}" count=${a.count}, hay ${countByAnime.get(a.id) ?? 0}`)
}

// Especiales
checkRequired(especiales, 'especiales', ['id', 'nombre', 'anime', 'animeId', 'img', 'color'])
checkUnique(especiales, 'especiales', new Set(ids))
checkNumbering(especiales, 'especiales')
for (const e of especiales) {
  if (!e.id?.startsWith('e-')) fail(`especiales: "${e.id}" debe empezar por "e-"`)
  if (e.personajeId !== undefined && !ids.has(e.personajeId)) fail(`especiales: "${e.id}" personajeId desconocido "${e.personajeId}"`)
  if (!animeById.has(e.animeId)) fail(`especiales: "${e.id}" animeId desconocido "${e.animeId}"`)
  if (e.color && !HEX.test(e.color)) fail(`especiales: "${e.id}" color inválido "${e.color}"`)
  if (isText(e.img)) {
    if (/\.\w+$/.test(e.img)) fail(`especiales: "${e.id}" img debe ir sin extensión`)
    for (const suffix of ['', '-300', '-450', '-600']) checkFile(`${e.img}${suffix}.webp`, `especiales "${e.id}"`)
    checkProporcion(e, 'especiales')
  }
}

if (errors.length) {
  console.error(`check-data: ${errors.length} error(es)`)
  for (const msg of errors.slice(0, 50)) console.error(`  - ${msg}`)
  if (errors.length > 50) console.error(`  … y ${errors.length - 50} más`)
  process.exit(1)
}
console.log(`check-data: OK — ${personajes.length} personajes, ${especiales.length} especiales, ${animes.length} animes`)
