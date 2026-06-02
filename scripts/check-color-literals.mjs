#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const colorLiteralRe = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g
const jsxExtensions = new Set(['.jsx', '.tsx'])
const cssAllowlist = new Map([
  ['frontend/src/index.css', '@theme centraliza los tokens visuales de la app'],
  [
    'frontend/src/features/cartas/cartas.css',
    'stylesheet de animaciones de cartas; los colores deben quedarse como variables CSS locales',
  ],
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

function isScannable(file) {
  const ext = extname(file)
  return jsxExtensions.has(ext) || (ext === '.css' && !cssAllowlist.has(file))
}

function findViolations(file) {
  const absolute = resolve(repoRoot, file)
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return []
  const text = readFileSync(absolute, 'utf8')
  const violations = []

  text.split('\n').forEach((line, index) => {
    colorLiteralRe.lastIndex = 0
    for (const match of line.matchAll(colorLiteralRe)) {
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
  .flatMap(findViolations)

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
