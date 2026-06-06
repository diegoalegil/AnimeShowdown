import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar — marco', () => {
  it('no envuelve en aro cuando el usuario no tiene marco', () => {
    const { container } = render(<Avatar user={{ username: 'neo' }} />)
    expect(container.querySelector('.marco')).toBeNull()
  })

  it('pinta el aro del marco equipado del usuario', () => {
    const { container } = render(
      <Avatar user={{ username: 'neo', marcoAvatar: 'oro' }} />,
    )
    expect(container.querySelector('.marco.marco-oro')).not.toBeNull()
  })

  it('el prop marco tiene prioridad (preview del picker)', () => {
    const { container } = render(
      <Avatar user={{ username: 'neo', marcoAvatar: 'oro' }} marco="prismatico" />,
    )
    expect(container.querySelector('.marco-prismatico')).not.toBeNull()
    expect(container.querySelector('.marco-oro')).toBeNull()
  })

  it('ignora un marco desconocido', () => {
    const { container } = render(
      <Avatar user={{ username: 'neo' }} marco="inventado" />,
    )
    expect(container.querySelector('.marco')).toBeNull()
  })
})
