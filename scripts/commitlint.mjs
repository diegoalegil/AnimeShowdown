#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const config = require('../commitlint.config.cjs')

function usage() {
  console.error('Usage: node scripts/commitlint.mjs --edit <file> | --message <msg> | --range <base> <head>')
}

function shouldSkip(header) {
  return /^Merge\b/.test(header) || /^Revert\b/.test(header)
}

function validateMessage(message, label = 'commit') {
  const text = String(message || '')
  const header = text.split(/\r?\n/)[0].trim()
  const errors = []

  if (!header) {
    errors.push('header vacío')
  } else if (!config.headerPattern.test(header)) {
    // Mensaje derivado de config.types para que se mantenga en sync cuando
    // se expandan los tipos permitidos (ver commitlint.config.cjs).
    errors.push(`usa "${config.types.join('|')}(scope): descripción"`)
  }

  if (header.length > config.maxHeaderLength) {
    errors.push(`header > ${config.maxHeaderLength} caracteres`)
  }

  if (/^Co-Authored-By:/im.test(text)) {
    errors.push('no uses trailers Co-Authored-By')
  }

  if (errors.length > 0 && !shouldSkip(header)) {
    return [`${label}: "${header || '(vacío)'}"`, ...errors.map((e) => `  - ${e}`)]
  }
  return []
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

const args = process.argv.slice(2)
let failures = []

if (args[0] === '--edit') {
  const file = args[1]
  if (!file || !existsSync(file)) {
    usage()
    process.exit(2)
  }
  failures = validateMessage(readFileSync(file, 'utf8'), file)
} else if (args[0] === '--message') {
  failures = validateMessage(args.slice(1).join(' '), 'message')
} else if (args[0] === '--range') {
  const [base, head] = args.slice(1)
  if (!base || !head) {
    usage()
    process.exit(2)
  }
  for (const commit of readCommitRange(base, head)) {
    failures.push(...validateMessage(commit.message, commit.sha.slice(0, 12)))
  }
} else {
  usage()
  process.exit(2)
}

if (failures.length > 0) {
  console.error('Commit message inválido:\n' + failures.join('\n'))
  process.exit(1)
}

console.log('Commit messages OK')
