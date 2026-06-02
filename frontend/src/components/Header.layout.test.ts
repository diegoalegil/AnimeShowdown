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
})
