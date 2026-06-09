import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('VotarPage mobile viewport', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/pages/VotarPage.jsx'),
    'utf8',
  )

  it('compacta la cabecera y los controles antes de la arena en movil', () => {
    expect(source).toContain('contentClassName="mx-auto flex max-w-5xl flex-col gap-3 sm:gap-4"')
    expect(source).toContain('className="min-h-[calc(100svh-5rem)] py-3 sm:py-8 lg:py-10"')
    expect(source).toContain('className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"')
  })

  it('mantiene acciones icon-first en movil y texto visible desde sm', () => {
    expect(source.match(/sr-only sm:not-sr-only/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(source.match(/min-h-11 w-11 shrink-0/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(source.match(/sm:w-auto sm:px-3\.5/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(source).toContain('<ArrowRight className="hidden h-3 w-3 sm:block" />')
  })

  it('usa escala tipografica estable por breakpoint en la pregunta principal', () => {
    expect(source).toContain('className="text-2xl font-extrabold leading-tight tracking-normal sm:text-3xl"')
    expect(source).not.toContain('text-[clamp(1.5rem,3.5vw,2.25rem)]')
  })
})
