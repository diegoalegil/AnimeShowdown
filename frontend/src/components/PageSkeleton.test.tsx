import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PageSkeleton from './PageSkeleton'

describe('PageSkeleton', () => {
  it('pinta skeleton especifico para anime detail con reserva anti blanco', () => {
    const { container } = render(
      <PageSkeleton pathname="/animes/one-piece" reserveClassName="min-h-[2200px]" />,
    )

    const skeleton = container.querySelector('[data-page-skeleton]')
    expect(skeleton).not.toBeNull()
    expect(skeleton?.getAttribute('data-page-skeleton')).toBe('animeDetail')
    expect(skeleton?.className).toContain('min-h-[2200px]')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(3)
  })
})
