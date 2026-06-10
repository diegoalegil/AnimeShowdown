import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// Los checks de las acciones icon-first viven con el componente extraído:
// src/features/votar/components/VotarTopBar.test.tsx

describe('VotarPage mobile viewport', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/pages/VotarPage.jsx'),
    'utf8',
  )

  it('compacta la cabecera antes de la arena en movil', () => {
    expect(source).toContain('contentClassName="mx-auto flex max-w-5xl flex-col gap-3 sm:gap-4"')
    expect(source).toContain('className="min-h-[calc(100svh-5rem)] py-3 sm:py-8 lg:py-10"')
  })

  it('usa escala tipografica estable por breakpoint en la pregunta principal', () => {
    expect(source).toContain('className="text-2xl font-extrabold leading-tight tracking-normal sm:text-3xl"')
    expect(source).not.toContain('text-[clamp(1.5rem,3.5vw,2.25rem)]')
  })
})
