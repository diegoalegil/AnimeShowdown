#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const colorLiteralRe = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g
// rgb(var(--token)/α) y rgb(${canal}) son token-driven, no literales.
const tokenDrivenRe = /^(rgba?|hsla?)\($/
const jsxExtensions = new Set(['.jsx', '.tsx'])
const cssAllowlist = new Map([
  ['frontend/src/index.css', '@theme centraliza los tokens visuales de la app'],
  [
    'frontend/src/features/cartas/cartas.css',
    'stylesheet de animaciones de cartas; los colores deben quedarse como variables CSS locales',
  ],
  [
    'frontend/src/features/games/shadow/shadow-byobu.css',
    'escena del biombo de Shadow Guess: paleta local de madera/papel/vela (sin token de la casa) como variables CSS del componente',
  ],
])
// Componentes del SISTEMA VISUAL PROCEDURAL: pintan auroras/god-rays/vignettes
// con rgb() token-driven (rgb(var(--visual-accent)/α)) y canales runtime
// (rgb(${visual.accentRgb}/α)) por diseño. El guard es un regex que no distingue
// esos tokens de un literal hardcoded, así que se excluyen (acordado con el owner).
// OJO: dentro de estos archivos un color hardcoded nuevo NO se detecta.
const jsxAllowlist = new Map([
  ['frontend/src/components/VisualSystem.jsx', 'motor visual procedural (auroras/god-rays/vignette) con rgb() token-driven'],
  ['frontend/src/components/EditorialCover.jsx', 'portada editorial con overlays gradient token-driven'],
  ['frontend/src/components/SectionPulso.jsx', 'sección pulso del home con fondo+overlays token-driven'],
  ['frontend/src/features/games/hub/GameCardBackground.jsx', 'fondo de game card con overlays token-driven'],
  ['frontend/src/components/Avatar.jsx', 'color de avatar derivado del hash del usuario en runtime (hsl()); el aro de marco vive en marcos.css con tokens'],
  ['frontend/src/features/animes/UniverseGalaxy.jsx', 'galaxia WebGL procedural: el atlas de symbols y el glow se pintan en canvas 2D con rgba() literal (blanco); los colores de escena salen de var(--color-*)'],
  ['frontend/src/components/BroadcastInterruption.jsx', 'pantalla de crash de último recurso: el fondo/color del <section> llevan el literal del token (#04070c / #d7dce7) como fallback de var() por si index.css no cargó — única forma de garantizar legibilidad sin la hoja de estilos'],
])

function git(args) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function changedFiles() {
  const base = process.env.COLOR_LITERAL_BASE || 'origin/main'
  return new Set([
    ...git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]),
    ...git(['diff', '--name-only', '--diff-filter=ACMR']),
    ...git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
  ])
}

/**
 * Números de línea AÑADIDOS/MODIFICADOS del archivo respecto a base+worktree.
 * El ratchet aplica solo a líneas que el cambio introduce: tocar una clase en
 * un archivo grande no obliga a migrar todos sus literales históricos en el
 * mismo PR. Devuelve null si no se puede calcular (archivo nuevo → todo).
 */
function addedLines(file) {
  const base = process.env.COLOR_LITERAL_BASE || 'origin/main'
  const lines = new Set()
  let sawDiff = false
  for (const args of [
    ['diff', '-U0', `${base}...HEAD`, '--', file],
    ['diff', '-U0', '--', file],
    ['diff', '-U0', '--cached', '--', file],
  ]) {
    const out = git(args)
    if (out.length > 0) sawDiff = true
    for (const line of out) {
      const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
      if (!m) continue
      const start = Number(m[1])
      const count = m[2] === undefined ? 1 : Number(m[2])
      for (let i = 0; i < count; i++) lines.add(start + i)
    }
  }
  // Sin diff calculable (p.ej. archivo untracked): escanear entero.
  return sawDiff ? lines : null
}

function isScannable(file) {
  const ext = extname(file)
  if (jsxExtensions.has(ext)) return !jsxAllowlist.has(file)
  return ext === '.css' && !cssAllowlist.has(file)
}

function findViolations(file, lineFilter) {
  const absolute = resolve(repoRoot, file)
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return []
  const text = readFileSync(absolute, 'utf8')
  const violations = []

  text.split('\n').forEach((line, index) => {
    if (lineFilter && !lineFilter.has(index + 1)) return
    colorLiteralRe.lastIndex = 0
    for (const match of line.matchAll(colorLiteralRe)) {
      // rgb(var(--token)/α) o rgb(${canal}) son token-driven: no es literal.
      if (tokenDrivenRe.test(match[0])) {
        const resto = line.slice((match.index ?? 0) + match[0].length)
        if (resto.startsWith('var(') || resto.startsWith('${')) continue
      }
      violations.push({
        file,
        line: index + 1,
        column: (match.index ?? 0) + 1,
        value: match[0],
      })
    }
  })

  return violations
}

const explicitFiles = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
const files = explicitFiles.length > 0 ? explicitFiles : [...changedFiles()]
const violations = files
  .filter(isScannable)
  // Con archivos explícitos (invocación manual) se escanea entero; en modo
  // diff, solo las líneas que el cambio introduce (ratchet por línea).
  .flatMap((file) => findViolations(file, explicitFiles.length > 0 ? null : addedLines(file)))

if (violations.length > 0) {
  console.error('Color literal detectado fuera de los tokens de diseño:')
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line}:${violation.column} (${violation.value})`,
    )
  }
  console.error('\nUsa tokens de frontend/src/index.css o variables CSS locales en un stylesheet allowlisted.')
  process.exit(1)
}

console.log('Color literal guard OK')
