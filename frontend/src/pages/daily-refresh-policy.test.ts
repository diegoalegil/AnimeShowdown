import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const DAILY_GAME_PAGES = [
  'src/pages/GuessCharacterPage.jsx',
  'src/pages/GuessAnimePage.jsx',
  'src/pages/AnidelPage.jsx',
  'src/pages/ImpostorPage.jsx',
  'src/pages/OraculoPage.jsx',
  'src/pages/NexoAnimePage.jsx',
]

describe('daily game refresh policy', () => {
  it('wires daily game pages to the midnight-aware today key', () => {
    for (const file of DAILY_GAME_PAGES) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')

      expect(source, file).toContain('useTodayKey')
      expect(source, file).toContain('key={todayKey}')
      expect(source, file).toContain('todayKey={todayKey}')
    }
  })
})
