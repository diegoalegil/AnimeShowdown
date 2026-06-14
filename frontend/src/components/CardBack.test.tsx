import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import CardBack from './CardBack'

afterEach(() => {
  cleanup()
})

describe('CardBack', () => {
  it('es decorativo (aria-hidden) y base sin clase de rareza', () => {
    const { container } = render(<CardBack />)
    const root = container.querySelector('.card-back')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root?.className).not.toMatch(/card-back--/)
  })

  it('compone la clase de rareza, mini y className extra', () => {
    const { container } = render(
      <CardBack rareza="legendary" mini className="h-full w-full" />,
    )
    const root = container.querySelector('.card-back')
    expect(root?.className).toContain('card-back--legendary')
    expect(root?.className).toContain('card-back--mini')
    expect(root?.className).toContain('h-full')
  })
})
