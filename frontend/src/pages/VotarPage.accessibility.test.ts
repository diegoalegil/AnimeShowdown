import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('VotarPage feedback accesible', () => {
  it('mantiene regiones live en resultados de victoria y empate', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/VotarPage.jsx'),
      'utf8',
    )

    expect(source).toMatch(
      /tieSelected[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/,
    )
    expect(source).toMatch(
      /votedPersonaje[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/,
    )
  })
})
