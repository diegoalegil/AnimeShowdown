#!/usr/bin/env node
// ===========================================================================
// Guardrail: las migraciones Flyway YA APLICADAS son INMUTABLES.
//
// Cambiar el contenido de una migración existente —incluso un comentario—
// cambia su checksum y Flyway aborta el arranque en producción con
// "Migration checksum mismatch for migration version N". Solo se permite
// AÑADIR nuevas migraciones V{n}__*.sql; nunca modificar/borrar/renombrar las
// que ya existen.
//
// Incidente de referencia: 2026-05-29 — editar un comentario de
// V1__initial_schema.sql tumbó prod (crash-loop por checksum mismatch).
//
// Modos:
//   --staged             (hook pre-commit): revisa el índice (git diff --cached)
//   --range <base> <head> (CI): revisa el rango entre dos commits
// ===========================================================================
import { execFileSync } from 'node:child_process'

const MIG_DIR = 'backend/src/main/resources/db/migration'
const isMigration = (f) => /(^|\/)V\d+(?:\.\d+)*__.+\.sql$/.test(f)

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function reportAndFail(files) {
  console.error('✖ Migración Flyway ya existente modificada/borrada/renombrada:')
  for (const f of files) console.error(`   - ${f}`)
  console.error('')
  console.error('Las migraciones aplicadas son INMUTABLES: cambiar su contenido (aunque sea')
  console.error('un comentario) rompe el checksum y Flyway no arranca en prod.')
  console.error('→ Crea una migración NUEVA V{n}__descripcion.sql en lugar de editar una existente.')
  console.error('  (Override consciente y bajo tu riesgo: git commit --no-verify)')
  process.exit(1)
}

const args = process.argv.slice(2)
let changed = ''

if (args[0] === '--staged') {
  changed = git(['diff', '--cached', '--diff-filter=MDR', '--name-only', '--', MIG_DIR])
} else if (args[0] === '--range') {
  const base = args[1]
  const head = args[2]
  if (!base || !head) {
    console.error('Usage: check-migrations-immutable.mjs --range <base> <head>')
    process.exit(2)
  }
  // La base puede no existir (p.ej. push inicial con before=000...): si no es
  // un commit verificable, no hay nada con qué comparar → se omite el check.
  try {
    git(['rev-parse', '--verify', `${base}^{commit}`])
  } catch {
    console.log(`Base no comparable (${base}); check omitido.`)
    process.exit(0)
  }
  let from = base
  try {
    from = git(['merge-base', base, head])
  } catch {
    from = base
  }
  changed = git(['diff', '--diff-filter=MDR', '--name-only', from, head, '--', MIG_DIR])
} else {
  console.error('Usage: check-migrations-immutable.mjs --staged | --range <base> <head>')
  process.exit(2)
}

const files = changed.split(/\r?\n/).filter(Boolean).filter(isMigration)
if (files.length > 0) reportAndFail(files)
console.log('✓ Ninguna migración existente fue modificada.')
