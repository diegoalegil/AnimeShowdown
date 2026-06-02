import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('font loading', () => {
  it('no carga fuentes externas en el HTML crítico', () => {
    const indexHtml = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8')

    expect(indexHtml).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(indexHtml).not.toMatch(/fonts\.googleapis\.com\/css2/)
  })

  it('usa stacks de sistema como tokens tipográficos base', () => {
    const indexCss = readFileSync(resolve(frontendRoot, 'src/index.css'), 'utf8')

    expect(indexCss).toContain('--font-sans: ui-sans-serif, system-ui')
    expect(indexCss).toContain('--font-mono: ui-monospace')
    expect(indexCss).toContain('--font-jp:')
    expect(indexCss).not.toMatch(/Geist|Geist Mono|Noto Sans JP/)
  })

  it('mantiene el splash dentro del viewport móvil con fuentes de sistema', () => {
    const indexCss = readFileSync(resolve(frontendRoot, 'src/index.css'), 'utf8')

    expect(indexCss).toContain('max-width: calc(100vw - 2rem);')
    expect(indexCss).toContain('@media (max-width: 360px)')
    expect(indexCss).toContain('font-size: 38px;')
  })
})
