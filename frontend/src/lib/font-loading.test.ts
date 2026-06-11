import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Contrato tipográfico Kessen: la display "AS Display" va SELF-HOST en
 * subsets con unicode-range (cero terceros), con preload solo de la cara
 * core y fallback métrico que anula el CLS del swap. El cuerpo sigue en
 * stacks de sistema.
 */
describe('font loading', () => {
  it('no carga fuentes de terceros en el HTML crítico', () => {
    const indexHtml = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8')

    expect(indexHtml).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(indexHtml).not.toMatch(/fonts\.googleapis\.com\/css2/)
  })

  it('precarga SOLO la cara core de la display, con crossorigin', () => {
    const indexHtml = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8')

    const preloads = indexHtml.match(/rel="preload" as="font"[^>]*/g) ?? []
    expect(preloads).toHaveLength(1)
    expect(preloads[0]).toMatch(/crossorigin/)
    expect(preloads[0]).toMatch(/\/fonts\/as-display-core\.[0-9a-f]{8}\.woff2/)
  })

  it('el CSS generado trae las caras con unicode-range y el fallback métrico', () => {
    const fontCss = readFileSync(resolve(frontendRoot, 'src/styles/display-font.css'), 'utf8')

    expect(fontCss).toContain("font-family: 'AS Display'")
    expect(fontCss.match(/unicode-range:/g)?.length).toBeGreaterThanOrEqual(2)
    expect(fontCss).toContain("font-family: 'AS Display Fallback'")
    expect(fontCss).toContain('size-adjust:')
    expect(fontCss).toContain('ascent-override:')
    expect(fontCss).toContain('font-display: swap')
  })

  it('el preload de index.html apunta a un archivo que existe en public/fonts', () => {
    const indexHtml = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8')
    const href = indexHtml.match(/href="\/fonts\/(as-display-core\.[0-9a-f]{8}\.woff2)"/)?.[1]
    expect(href).toBeTruthy()
    expect(() => readFileSync(resolve(frontendRoot, 'public/fonts', href!))).not.toThrow()
  })

  it('usa stacks de sistema como tokens tipográficos base', () => {
    const indexCss = readFileSync(resolve(frontendRoot, 'src/index.css'), 'utf8')

    expect(indexCss).toContain('--font-sans: ui-sans-serif, system-ui')
    expect(indexCss).toContain('--font-mono: ui-monospace')
    expect(indexCss).toContain('--font-jp:')
    expect(indexCss).toContain('--font-display:')
    expect(indexCss).not.toMatch(/Geist|Geist Mono|Noto Sans JP/)
  })

  it('mantiene el splash dentro del viewport móvil con fuentes de sistema', () => {
    const indexCss = readFileSync(resolve(frontendRoot, 'src/index.css'), 'utf8')

    expect(indexCss).toContain('max-width: calc(100vw - 2rem);')
    expect(indexCss).toContain('@media (max-width: 360px)')
    expect(indexCss).toContain('font-size: 38px;')
  })
})
