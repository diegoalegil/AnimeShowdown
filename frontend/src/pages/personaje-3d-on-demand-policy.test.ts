import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const PERSONAJE_DETAIL_SOURCE = 'src/pages/PersonajeDetailPage.jsx'

describe('personaje 3D on-demand policy', () => {
  it('loads the 3D viewer only from an explicit click', () => {
    const source = readFileSync(resolve(process.cwd(), PERSONAJE_DETAIL_SOURCE), 'utf8')

    expect(source).toContain('const loadPersonaje3D = () => import')
    expect(source).toContain('onClick={handleOpen3D}')
    expect(source).toContain('canCreateWebGLContext()')
    expect(source).not.toContain('preloadPersonaje3D')
    expect(source).not.toContain('requestIdleCallback(preload')
    expect(source).not.toContain('onPointerEnter=')
    expect(source).not.toContain('onFocus=')
  })
})
