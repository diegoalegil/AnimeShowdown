import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(__dirname, '../..')

describe('BrandSelect layout contract', () => {
  it('centraliza selects premium en las paginas con filtros visibles', () => {
    const files = [
      'src/pages/RankingPage.jsx',
      'src/pages/CartasPage.jsx',
      'src/pages/TierListsPage.jsx',
    ]

    for (const file of files) {
      const source = readFileSync(resolve(frontendRoot, file), 'utf8')
      expect(source).toContain('BrandSelect')
      expect(source).not.toMatch(/<select\b/)
    }
  })

  it('mantiene estado disabled y aria-controls en el trigger', () => {
    const source = readFileSync(resolve(frontendRoot, 'src/components/BrandSelect.jsx'), 'utf8')

    expect(source).toContain('disabled = false')
    expect(source).toContain('aria-controls={panelOpen ? listboxId : undefined}')
    expect(source).toContain('disabled={disabled}')
  })
})
