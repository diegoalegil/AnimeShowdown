import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(__dirname, '../..')

describe('Header layout', () => {
  it('permite que el wordmark se contraiga en mobile con fuentes de sistema', () => {
    const headerSource = readFileSync(resolve(frontendRoot, 'src/components/Header.jsx'), 'utf8')

    expect(headerSource).toContain('min-h-11 min-w-0 flex-1')
    expect(headerSource).toContain('truncate text-base font-extrabold')
  })

  it('mantiene un disparador visible del buscador en desktop y mobile', () => {
    const headerSource = readFileSync(resolve(frontendRoot, 'src/components/Header.jsx'), 'utf8')

    expect(headerSource).toContain('const openQuickSearch')
    expect(headerSource.match(/onClick=\{openQuickSearch\}/g)).toHaveLength(3)
    expect(headerSource).toContain("t('header.searchAria')")
    expect(headerSource).toContain("t('header.searchShort')")
  })
})
