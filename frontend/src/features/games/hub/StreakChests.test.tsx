import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StreakChests from './StreakChests'

afterEach(cleanup)

describe('StreakChests', () => {
  it('pinta 7 cofres y los días completados van abiertos (flip)', () => {
    // [6] = hoy. 3 días completados.
    const { container } = render(
      <StreakChests days={[true, true, false, true, false, false, false]} />,
    )
    expect(container.querySelectorAll('.streak-chest__flip')).toHaveLength(7)
    expect(container.querySelectorAll('.streak-chest__flip.is-abierto')).toHaveLength(3)
  })

  it('hoy sin completar invita (cara--hoy)', () => {
    const { container } = render(
      <StreakChests days={[false, false, false, false, false, false, false]} />,
    )
    expect(container.querySelector('.streak-chest__face--hoy')).not.toBeNull()
  })

  it('con peligro hoy usa cara--peligro en vez de cara--hoy', () => {
    const { container } = render(
      <StreakChests days={[false, false, false, false, false, false, false]} danger />,
    )
    expect(container.querySelector('.streak-chest__face--peligro')).not.toBeNull()
    expect(container.querySelector('.streak-chest__face--hoy')).toBeNull()
  })

  it('hoy ya completado no muestra invitación y su cofre va abierto', () => {
    const { container } = render(
      <StreakChests days={[false, false, false, false, false, false, true]} />,
    )
    expect(container.querySelector('.streak-chest__face--hoy')).toBeNull()
    expect(container.querySelectorAll('.streak-chest__flip.is-abierto')).toHaveLength(1)
  })

  it('el aria-label refleja el conteo de días completados', () => {
    const { getByRole } = render(
      <StreakChests days={[true, true, true, false, false, false, false]} />,
    )
    expect(getByRole('img').getAttribute('aria-label')).toContain('3 de 7')
  })
})
