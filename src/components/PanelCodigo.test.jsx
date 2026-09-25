import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { catalogo } from '../lib/catalog.js'
import { exportar, leerCodigo, previsionImportacion } from '../lib/collection.js'
import { ConfirmarImportacion, PanelCodigo } from './PanelCodigo.jsx'

describe('PanelCodigo', () => {
  it('explica dónde se guarda la colección y ofrece pegar un código', () => {
    const html = renderToStaticMarkup(<PanelCodigo />)
    expect(html).toContain('id="codigo"')
    expect(html).toContain('Tu colección se guarda en este navegador.')
    expect(html).toContain('aria-label="Código para importar"')
    // Sin cartas no hay nada que copiar todavía.
    expect(html).not.toContain('aria-label="Código de tu colección"')
    expect(html).toContain('Cuando consigas cartas')
  })

  it('el aviso de importación está siempre montado y puede recibir el foco', () => {
    const html = renderToStaticMarkup(<PanelCodigo />)
    expect(html).toMatch(/<p class="codigo-aviso" role="status" aria-live="polite" tabindex="-1"><\/p>/)
  })
})

describe('ConfirmarImportacion', () => {
  const vacio = { tengo: {}, desde: {}, pegadas: [], ultimo: [] }
  const conAkame = { ...vacio, tengo: { akame: 1 }, desde: { akame: '2026-09-01' } }
  const leer = (tengo) => leerCodigo(exportar({ tengo, desde: {} }), { existe: catalogo.conocida })
  const pintar = (estado, leido) =>
    renderToStaticMarkup(
      <ConfirmarImportacion
        estado={estado}
        leido={leido}
        prevision={previsionImportacion(estado, leido, catalogo.existe)}
        alAplicar={() => {}}
        alCancelar={() => {}}
      />,
    )

  it('un código con solo cartas ocultas no ofrece sustituir: solo guardarlas', () => {
    expect(catalogo.oculta('kurome')).toBe(true)
    const leido = leer({ kurome: 3 })
    expect(leido.ok).toBe(true)
    expect(previsionImportacion(conAkame, leido, catalogo.existe)).toMatchObject({ entrantes: 0, actuales: 1 })

    for (const estado of [conAkame, vacio]) {
      const html = pintar(estado, leido)
      expect(html).toContain('Las cartas de este código están ocultas por ahora.')
      expect(html).toContain('Se guardarán en tu colección y aparecerán cuando vuelvan.')
      expect(html).toContain('>Guardar</button>')
      expect(html).not.toContain('Sustituir la mía')
      expect(html).not.toContain('>Importar</button>')
      expect(html).not.toContain('Este código trae 0 cartas')
    }
  })

  it('con alguna carta visible se mantienen combinar y sustituir', () => {
    const html = pintar(conAkame, leer({ kurome: 3, mine: 1 }))
    expect(html).toContain('Este código trae 1 carta.')
    expect(html).toContain('Sustituir la mía')
    expect(html).not.toContain('>Guardar</button>')
  })
})
