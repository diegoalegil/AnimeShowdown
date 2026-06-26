import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest corre desde la raíz del paquete (frontend/), donde vive index.html.
const indexHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf-8')

describe('index.html viewport', () => {
  it('incluye viewport-fit=cover', () => {
    // Sin viewport-fit=cover, env(safe-area-inset-*) evalúa a 0 en iPhones con
    // notch — y la app usa esos insets (MobileBottomNav, header, etc.) bajo el
    // status bar black-translucent. Guardamos el meta contra regresiones.
    const viewport = indexHtml.match(/<meta\s+name="viewport"\s+content="([^"]*)"/i)?.[1] ?? ''
    expect(viewport).toContain('viewport-fit=cover')
  })
})
