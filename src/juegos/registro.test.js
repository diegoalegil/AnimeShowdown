import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { JUEGOS, SLUGS, juegoPorSlug } from './registro.js'

const aqui = dirname(fileURLToPath(import.meta.url))

describe('registro de juegos', () => {
  it('hay diez juegos con slug, nombre, kanji y acento válidos, sin repetir', () => {
    expect(JUEGOS).toHaveLength(10)
    const unicos = (campo) => new Set(JUEGOS.map((j) => j[campo])).size
    expect(unicos('slug')).toBe(10)
    expect(unicos('kanji')).toBe(10)
    expect(unicos('nombre')).toBe(10)
    for (const juego of JUEGOS) {
      expect(juego.slug).toMatch(/^[a-z0-9-]+$/)
      expect(juego.nombre.trim()).toBe(juego.nombre)
      expect(juego.kanji).toHaveLength(1)
      expect(juego.descripcion.length).toBeGreaterThan(20)
      expect(['carmesi', 'oro', 'cian']).toContain(juego.acento)
      expect(typeof juego.recompensa).toBe('boolean')
      expect(typeof juego.cargar).toBe('function')
    }
  })

  it('siete dan sobre y tres (ruleta, omikuji, top5) no', () => {
    const sin = JUEGOS.filter((j) => !j.recompensa).map((j) => j.slug)
    expect(sin).toEqual(['ruleta', 'omikuji', 'top5'])
  })

  it('cada juego tiene su pantalla en src/juegos/<slug>/index.jsx', () => {
    for (const slug of SLUGS) expect(existsSync(join(aqui, slug, 'index.jsx'))).toBe(true)
  })

  it('las pantallas se cargan y exportan un componente', async () => {
    for (const juego of JUEGOS) {
      const modulo = await juego.cargar()
      expect(typeof modulo.default).toBe('function')
    }
  })

  it('busca por slug', () => {
    expect(juegoPorSlug('silueta')?.nombre).toBe('Silueta')
    expect(juegoPorSlug('inventado')).toBeUndefined()
    expect(juegoPorSlug(undefined)).toBeUndefined()
  })
})
