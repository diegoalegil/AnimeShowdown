import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PanelCodigo } from './PanelCodigo.jsx'

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
})
