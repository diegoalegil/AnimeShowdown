import { Suspense } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { diferido } from './diferido.js'

const Pagina = () => <p>página</p>

describe('diferido', () => {
  it('descarga el módulo una sola vez aunque se precargue varias', async () => {
    const importar = vi.fn(async () => ({ default: Pagina }))
    const { precargar } = diferido(importar)
    await Promise.all([precargar(), precargar()])
    expect(importar).toHaveBeenCalledTimes(1)
  })

  it('tras una descarga fallida, el siguiente intento la vuelve a pedir', async () => {
    const importar = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ default: Pagina })
    const { precargar } = diferido(importar)
    await expect(precargar()).rejects.toThrow('sin red')
    await expect(precargar()).resolves.toEqual({ default: Pagina })
    expect(importar).toHaveBeenCalledTimes(2)
  })

  it('ya precargada, se pinta sin mostrar el marcador de carga', async () => {
    const { Componente, precargar } = diferido(async () => ({ default: Pagina }))
    await precargar()
    const html = renderToStaticMarkup(
      <Suspense fallback={<p>cargando</p>}>
        <Componente />
      </Suspense>,
    )
    expect(html).toBe('<p>página</p>')
  })
})
