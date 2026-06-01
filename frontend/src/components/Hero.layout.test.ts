import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(__dirname, '../..')

describe('Hero layout', () => {
  it('encierra el ticker de votos recientes para no provocar overflow móvil', () => {
    const heroSource = readFileSync(resolve(frontendRoot, 'src/components/Hero.jsx'), 'utf8')

    expect(heroSource).toContain('relative z-10 flex w-full max-w-5xl')
    expect(heroSource).toContain('w-full max-w-full flex-col')
    expect(heroSource).toContain('sm:max-w-2xl')
  })
})
