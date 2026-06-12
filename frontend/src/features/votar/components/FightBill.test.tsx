import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import FightBill from './FightBill'

// Camino reduced-motion: swap directo sin timers → asserts deterministas.
vi.mock('../../../hooks/useReducedMotionPref', () => ({
  useReducedMotionPref: () => true,
}))

afterEach(() => cleanup())

const goku = { slug: 'goku', nombre: 'Goku' }
const luffy = { slug: 'monkey-d-luffy', nombre: 'Luffy' }
const naruto = { slug: 'naruto-uzumaki', nombre: 'Naruto' }
const ichigo = { slug: 'ichigo-kurosaki', nombre: 'Ichigo' }

describe('FightBill', () => {
  it('pinta el titular con sus nombres y el siguiente cartel de la cola', () => {
    render(
      <FightBill
        current={{ key: '101', a: goku, b: luffy }}
        queue={[{ key: '102', a: naruto, b: ichigo }]}
        maxSlots={1}
      />,
    )
    expect(screen.getByLabelText('Combate actual')).toHaveTextContent('Goku')
    expect(screen.getByLabelText('Combate actual')).toHaveTextContent('Luffy')
    expect(screen.getByLabelText('Próximos combates')).toHaveTextContent('Naruto')
    expect(screen.getByText('ahora')).toBeInTheDocument()
  })

  it('es un espejo key-driven: al cambiar current.key converge al nuevo duelo', () => {
    const { rerender } = render(
      <FightBill current={{ key: '101', a: goku, b: luffy }} queue={[]} maxSlots={1} />,
    )
    rerender(
      <FightBill current={{ key: '102', a: naruto, b: ichigo }} queue={[]} maxSlots={1} />,
    )
    expect(screen.getByLabelText('Combate actual')).toHaveTextContent('Naruto')
    expect(screen.getByLabelText('Combate actual')).not.toHaveTextContent('Goku')
  })

  it('con la misma key sincroniza la cola repuesta sin coreografía', () => {
    const { rerender } = render(
      <FightBill current={{ key: '101', a: goku, b: luffy }} queue={[]} maxSlots={1} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('la arena respira…')
    rerender(
      <FightBill
        current={{ key: '101', a: goku, b: luffy }}
        queue={[{ key: '103', a: naruto, b: ichigo }]}
        maxSlots={1}
      />,
    )
    expect(screen.getByLabelText('Próximos combates')).toHaveTextContent('Ichigo')
  })

  it('cola vacía con prefetch en vuelo: «pidiendo el siguiente…»', () => {
    render(
      <FightBill
        current={{ key: '101', a: goku, b: luffy }}
        queue={[]}
        replenishing
        maxSlots={1}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('pidiendo el siguiente…')
  })

  it('sin onJumpToDuel los carteles son presentacionales (sin botón)', () => {
    render(
      <FightBill
        current={{ key: '101', a: goku, b: luffy }}
        queue={[{ key: '102', a: naruto, b: ichigo }]}
        maxSlots={1}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
