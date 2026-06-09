import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('RankingPage performance contracts', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/pages/RankingPage.jsx'),
    'utf8',
  )

  it('reutiliza el ranking ELO preordenado para categorias', () => {
    expect(source).toContain('catalogoIndex.sortedBy?.elo_desc ?? catalogoIndex.rankedElo')
    expect(source).not.toMatch(
      /filter\(\(p\) => p\.categorias\.includes\(cat\.id\)\)[\s\S]{0,120}\.sort\(/,
    )
  })

  it('memoiza slices visibles del ranking local', () => {
    expect(source).toContain('const rankingSlices = useMemo')
    expect(source).toContain('filteredTop100')
    expect(source).toContain('visibleRankingRows')
    expect(source).not.toContain('const podio = filtered.slice(0, 3)')
    expect(source).not.toContain('(hayFiltros ? filtered.slice(0, 100) : resto).map')
  })
})
