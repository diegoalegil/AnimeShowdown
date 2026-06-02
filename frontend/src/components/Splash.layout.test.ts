import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(__dirname, '../..')

describe('Splash layout', () => {
  it('recorta el overlay animado para no ensanchar el viewport móvil', () => {
    const splashSource = readFileSync(resolve(frontendRoot, 'src/components/Splash.jsx'), 'utf8')

    expect(splashSource).toContain('fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-bg')
  })
})
