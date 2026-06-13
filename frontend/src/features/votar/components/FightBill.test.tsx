import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import FightBill from './FightBill'

// reduced-motion controlable por test: por defecto true (swap directo → asserts
// deterministas); los tests de coreografía lo bajan a false con timers falsos.
const motion = vi.hoisted(() => ({ rm: true }))
vi.mock('../../../hooks/useReducedMotionPref', () => ({
  useReducedMotionPref: () => motion.rm,
}))

afterEach(() => {
  cleanup()
  motion.rm = true
})

const goku = { slug: 'goku', nombre: 'Goku' }
const luffy = { slug: 'monkey-d-luffy', nombre: 'Luffy' }
const naruto = { slug: 'naruto-uzumaki', nombre: 'Naruto' }
const ichigo = { slug: 'ichigo-kurosaki', nombre: 'Ichigo' }
const gojo = { slug: 'gojo-satoru', nombre: 'Gojo' }
const sukuna = { slug: 'ryomen-sukuna', nombre: 'Sukuna' }

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
    expect(screen.getByText('la arena respira…')).toBeInTheDocument()
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
    expect(screen.getByText(/pidiendo el siguiente…/)).toBeInTheDocument()
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

  it('placement="bottom" pinta la tira horizontal', () => {
    render(
      <FightBill
        current={{ key: '101', a: goku, b: luffy }}
        queue={[{ key: '102', a: naruto, b: ichigo }]}
        placement="bottom"
        maxSlots={1}
      />,
    )
    expect(screen.getByLabelText('El cartel de la velada')).toHaveClass('fb--bottom')
  })

  it('coalesce una ráfaga de keys: converge al duelo final sin anclarse en uno viejo', () => {
    // El camino animado (rm=false) es el que ejercita runTransition/pendingRef:
    // 102 arranca la transición; 103 y 104 llegan durante la animación → se
    // coalescen (103 se pisa) y solo se anima el salto al más reciente (104).
    motion.rm = false
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <FightBill current={{ key: '101', a: goku, b: luffy }} queue={[]} maxSlots={1} />,
      )
      act(() => {
        rerender(<FightBill current={{ key: '102', a: naruto, b: ichigo }} queue={[]} maxSlots={1} />)
        rerender(<FightBill current={{ key: '103', a: ichigo, b: naruto }} queue={[]} maxSlots={1} />)
        rerender(<FightBill current={{ key: '104', a: gojo, b: sukuna }} queue={[]} maxSlots={1} />)
      })
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      const titular = screen.getByLabelText('Combate actual')
      expect(titular).toHaveTextContent('Gojo')
      expect(titular).toHaveTextContent('Sukuna')
      // no se queda anclado en el duelo inicial (regresión de carrera del drenaje)
      expect(titular).not.toHaveTextContent('Goku')
    } finally {
      vi.useRealTimers()
    }
  })
})
