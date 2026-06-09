import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('VotarPage flujo rapido', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/pages/VotarPage.jsx'),
    'utf8',
  )

  it('precarga el siguiente duelo cuando aparece una pareja nueva', () => {
    expect(source).toContain('warmPrefetchPairKeyRef')
    expect(source).toMatch(
      /warmPrefetchPairKeyRef\.current === currentPairKey[\s\S]*warmPrefetchPairKeyRef\.current = currentPairKey[\s\S]*prefetchSiguientePar\(\)/,
    )
    expect(source).toMatch(/if \(!modoBackend && !modoSugerido\) return/)
  })

  it('reutiliza una precarga activa o lista en vez de duplicar peticiones', () => {
    expect(source).toContain('hasPrefetchReadyOrRunning')
    expect(source).toMatch(
      /hasPrefetchReadyOrRunning\(queryClient, PREFETCH_BACKEND_KEY\)[\s\S]*return/,
    )
    expect(source).toMatch(
      /hasPrefetchReadyOrRunning\(queryClient, PREFETCH_SUGERIDO_KEY\)[\s\S]*return/,
    )
  })

  it('descarta precargas repetidas antes de pedir un duelo nuevo', () => {
    expect(source).toMatch(
      /prefetchedData[\s\S]*queryClient\.removeQueries\(\{ queryKey: PREFETCH_BACKEND_KEY \}\)[\s\S]*await refetch\(\)/,
    )
    expect(source).toMatch(
      /prefetchedData[\s\S]*queryClient\.removeQueries\(\{ queryKey: PREFETCH_SUGERIDO_KEY \}\)[\s\S]*for \(let attempt = 0;/,
    )
  })
})
