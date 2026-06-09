#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const trailerCoauthor = ['Co', 'Authored', 'By'].join('-')
const forbiddenExact = [
  [99, 111, 100, 101, 120],
  [99, 108, 97, 117, 100, 101],
].map((codes) => String.fromCharCode(...codes))
const forbiddenPhrases = [
  ['generated', 'with'].join(' '),
  ['ai', 'generated'].join(' '),
]

function usage() {
  console.error([
    'Usage:',
    '  node scripts/metadata-hygiene.mjs --text <label> <value>',
    '  node scripts/metadata-hygiene.mjs --env <ENV_NAME> <label>',
    '  node scripts/metadata-hygiene.mjs --file <path> <label>',
    '  node scripts/metadata-hygiene.mjs --range <base> <head>',
  ].join('\n'))
}

export function metadataIssues(value, label = 'metadata') {
  const text = String(value || '')
  const normalized = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const issues = []

  const trailerPattern = new RegExp(`^${trailerCoauthor}\\s*:`, 'im')
  if (trailerPattern.test(text)) {
    issues.push('no uses trailers de coautoria automatica')
  }

  for (const term of forbiddenExact) {
    if (normalized.includes(term)) {
      issues.push(`no uses referencias de herramienta automatica en ${label}`)
      break
    }
  }

  for (const phrase of forbiddenPhrases) {
    if (normalized.includes(phrase)) {
      issues.push(`no uses marcas de generacion automatica en ${label}`)
      break
    }
  }

  return issues.map((issue) => `${label}: ${issue}`)
}

function readCommitRange(base, head) {
  const out = execFileSync(
    'git',
    ['log', '--format=%H%x00%B%x00END-COMMIT%x00', `${base}..${head}`],
    { encoding: 'utf8' },
  )
  return out
    .split('\0END-COMMIT\0')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [sha, ...body] = chunk.split('\0')
      return { sha, message: body.join('\0').trim() }
    })
}

function collectIssues(args) {
  const issues = []
  for (let i = 0; i < args.length;) {
    const mode = args[i]
    if (mode === '--text') {
      const label = args[i + 1]
      const value = args[i + 2]
      if (!label || value == null) return null
      issues.push(...metadataIssues(value, label))
      i += 3
    } else if (mode === '--env') {
      const envName = args[i + 1]
      const label = args[i + 2]
      if (!envName || !label) return null
      issues.push(...metadataIssues(process.env[envName] || '', label))
      i += 3
    } else if (mode === '--file') {
      const file = args[i + 1]
      const label = args[i + 2]
      if (!file || !label || !existsSync(file)) return null
      issues.push(...metadataIssues(readFileSync(file, 'utf8'), label))
      i += 3
    } else if (mode === '--range') {
      const base = args[i + 1]
      const head = args[i + 2]
      if (!base || !head) return null
      for (const commit of readCommitRange(base, head)) {
        issues.push(...metadataIssues(commit.message, commit.sha.slice(0, 12)))
      }
      i += 3
    } else {
      return null
    }
  }
  return issues
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const issues = collectIssues(process.argv.slice(2))
  if (!issues) {
    usage()
    process.exit(2)
  }
  if (issues.length > 0) {
    console.error('Metadata inválida:\n' + issues.map((i) => `  - ${i}`).join('\n'))
    process.exit(1)
  }
  console.log('Metadata OK')
}
