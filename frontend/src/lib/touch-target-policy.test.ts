import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = join(process.cwd(), 'src')
const INTERACTIVE_OPENING_TAG = /<(button|Link|NavLink|a)\b[\s\S]*?>/g
const SMALL_TOUCH_TARGET_CLASS = /\b(?:h-(?:8|9|10)|min-h-(?:9|10)|min-h-\[40px\])\b/

function sourceFiles(dir = SOURCE_ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    if (/\.(jsx|tsx)$/.test(entry.name)) return [fullPath]
    return []
  })
}

describe('touch target policy', () => {
  it('keeps interactive JSX targets at 44px or above', () => {
    const offenders = []

    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(INTERACTIVE_OPENING_TAG)) {
        const openingTag = match[0]
        if (!SMALL_TOUCH_TARGET_CLASS.test(openingTag)) continue

        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${relative(SOURCE_ROOT, file)}:${line}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
