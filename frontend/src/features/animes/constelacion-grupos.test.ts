import { describe, expect, it } from 'vitest'
import { CONSTELACIONES, TOP_DESTACADOS, construirGruposConstelacion } from './constelacion-grupos'
import { buildLayout } from './constelacion-layout'

function catalogoFalso() {
  // 3 universos con identidad curada real y conteos distintos.
  const personajes = []
  const meter = (anime, n) => {
    for (let i = 0; i < n; i++) personajes.push({ anime, slug: `${anime}-${i}` })
  }
  meter('Naruto', 45)
  meter('Death Note', 12)
  meter('Haikyuu!!', 20)
  return personajes
}

describe('construirGruposConstelacion', () => {
  it('agrupa por la taxonomía de identidades con conteos reales del catálogo', () => {
    const grupos = construirGruposConstelacion(catalogoFalso())
    const todos = grupos.flatMap((g) => g.list)
    expect(todos).toHaveLength(3)
    const naruto = todos.find((u) => u.slug === 'naruto')
    expect(naruto?.chars).toBe(45)
    // Naruto es battle → constelación 戦.
    const battle = grupos.find((g) => g.k === CONSTELACIONES.battle.k)
    expect(battle?.list.some((u) => u.slug === 'naruto')).toBe(true)
  })

  it('marca como top los universos con más personajes (umbral top-N)', () => {
    const grupos = construirGruposConstelacion(catalogoFalso())
    const todos = grupos.flatMap((g) => g.list)
    // Con 3 universos y TOP_DESTACADOS=10, todos entran en el umbral.
    expect(TOP_DESTACADOS).toBeGreaterThanOrEqual(3)
    expect(todos.every((u) => u.top)).toBe(true)
  })

  it('ignora animes sin identidad curada y catálogos vacíos', () => {
    expect(construirGruposConstelacion([])).toEqual([])
    const grupos = construirGruposConstelacion([{ anime: 'Anime Inventado Sin Identidad' }])
    expect(grupos).toEqual([])
  })
})

describe('buildLayout', () => {
  const grupos = construirGruposConstelacion(catalogoFalso())

  it('es determinista: mismo seed, mismo cielo', () => {
    const a = buildLayout(grupos, 7)
    const b = buildLayout(grupos, 7)
    expect(a.nodes).toEqual(b.nodes)
    expect(a.edges).toEqual(b.edges)
    expect(a.stars).toEqual(b.stars)
  })

  it('distinto seed produce otro cielo, con los mismos universos', () => {
    const a = buildLayout(grupos, 7)
    const b = buildLayout(grupos, 8)
    expect(a.nodes.map((n) => n.slug).sort()).toEqual(b.nodes.map((n) => n.slug).sort())
    expect(a.nodes).not.toEqual(b.nodes)
  })

  it('cada constelación queda conectada (n-1 aristas por grupo)', () => {
    const layout = buildLayout(grupos, 7)
    for (let gi = 0; gi < grupos.length; gi++) {
      const nodos = layout.nodes.filter((n) => n.g === gi).length
      const aristas = layout.edges.filter((e) => e.g === gi).length
      expect(aristas).toBe(Math.max(0, nodos - 1))
    }
  })
})
