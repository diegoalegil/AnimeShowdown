import { describe, expect, it } from 'vitest'
import { esqueletoPortada } from './esqueleto.jsx'

describe('esqueletoPortada', () => {
  const html = esqueletoPortada()

  it('pinta la cabecera y la portada con su sala, su título y sus acciones', () => {
    expect(html).toContain('class="cabecera"')
    expect(html).toContain('id="portada-titulo"')
    expect(html).toMatch(/<img [^>]*srcSet="[^"]*personajes-archive-768\.webp/)
    expect(html).toMatch(/<a [^>]*href="[^"]*\/sobres"[^>]*>Abrir los sobres de hoy/)
  })

  it('deja fuera lo que depende del visitante: carta del día (solo su hueco), rejilla, pie y colección', () => {
    expect(html).toContain('del-dia--reserva')
    expect(html).not.toContain('del-dia-nombre')
    expect(html).not.toContain('class="filtros"')
    expect(html).not.toContain('class="pie"')
    expect(html).not.toContain('nav-cuenta')
  })
})
