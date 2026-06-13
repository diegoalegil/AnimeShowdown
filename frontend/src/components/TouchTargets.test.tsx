import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CartaTile from './CartaTile'
import AltarFive from '../features/miTop5/AltarFive'

vi.mock('../features/cartas/CartaFace', () => ({
  default: () => <div data-testid="carta-face" />,
}))

vi.mock('./PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn() }),
}))

describe('targets tactiles', () => {
  afterEach(cleanup)

  it('mantiene 44px para quitar un personaje del altar', () => {
    render(
      <AltarFive
        entries={[{ slug: 'luffy', name: 'Luffy' }, null, null, null, null]}
      />,
    )

    const quitar = screen.getByRole('button', { name: 'Quitar a Luffy del altar' })
    expect(quitar).toHaveClass('af-card__remove')
    // El tamaño vive en el CSS de feature: pinnearlo evita que una
    // limpieza de estilos encoja el target sin que ningún test lo vea.
    const css = readFileSync(
      resolve(process.cwd(), 'src/features/miTop5/altar-five.css'),
      'utf8',
    )
    const reglaRemove = css.match(/\.af-card__remove \{[\s\S]*?\}/)?.[0] ?? ''
    expect(reglaRemove).toContain('width: 44px')
    expect(reglaRemove).toContain('height: 44px')
    const reglaMove = css.match(/\.af-move \{[\s\S]*?\}/)?.[0] ?? ''
    expect(reglaMove).toContain('width: 44px')
    expect(reglaMove).toContain('height: 44px')
  })

  it('mantiene 44px para descargar cartas poseidas', () => {
    render(
      <CartaTile
        carta={{
          poseida: true,
          personajeNombre: 'Asuka',
          personajeSlug: 'asuka',
          rareza: 'SSR',
          anime: 'Evangelion',
        }}
        onDownload={() => {}}
      />,
    )

    const descargar = screen.getByRole('button', { name: /Descargar carta de Asuka/i })
    expect(descargar).toHaveClass('h-11')
    expect(descargar).toHaveClass('w-11')
  })
})
