import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import KeyLantern from './KeyLantern'

/* happy-dom SÍ trae IntersectionObserver nativo, así que todos los tests entran
   en la rama del observer (pausa del loop fuera de viewport) sin stub. Lo
   stubeamos SOLO en los tests que asertan sobre observe()/disconnect() (smoke y
   cleanup), para no depender de la implementación nativa. */
class IOStub {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('KeyLantern', () => {
  it('renderiza en cada estado (unlit / lit / expired) sin crashear', () => {
    vi.stubGlobal('IntersectionObserver', IOStub)
    for (const state of ['unlit', 'lit', 'expired'] as const) {
      const { container, unmount } = render(<KeyLantern state={state} />)
      expect(container.querySelector('.as-kl')).not.toBeNull()
      // El kanji 灯 (luz) siempre se pinta.
      expect(container.textContent).toContain('灯')
      unmount()
    }
  })

  it('es decorativo: aria-hidden y sin role/texto que duplique anuncios', () => {
    const { container } = render(<KeyLantern state="lit" />)
    const root = container.querySelector('.as-kl')
    expect(root).not.toBeNull()
    // Decorativo de cabo a rabo: el estado lo anuncia el aria-live de la página.
    expect(root?.getAttribute('aria-hidden')).toBe('true')
    expect(root?.getAttribute('role')).toBeNull()
    // No expone copy semántico (solo el glifo decorativo del kanji).
    expect(container.textContent?.trim()).toBe('灯')
  })

  it('refleja state="lit" y keyTurned en los data-attrs que cablean el CSS', () => {
    const { container } = render(<KeyLantern state="lit" keyTurned />)
    const root = container.querySelector('.as-kl') as HTMLElement
    expect(root.hasAttribute('data-lit')).toBe(true)
    expect(root.hasAttribute('data-key-turned')).toBe(true)
    expect(root.hasAttribute('data-expired')).toBe(false)
  })

  it('refleja state="expired" y oculta data-lit', () => {
    const { container } = render(<KeyLantern state="expired" />)
    const root = container.querySelector('.as-kl') as HTMLElement
    expect(root.hasAttribute('data-expired')).toBe(true)
    expect(root.hasAttribute('data-lit')).toBe(false)
  })

  it('omite la cerradura con showLock=false', () => {
    const { container } = render(<KeyLantern state="unlit" showLock={false} />)
    expect(container.querySelector('.as-kl__lock')).toBeNull()
  })

  it('limpia el observer al desmontar (sin fugas de listeners)', () => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observe
        disconnect = disconnect
        unobserve = vi.fn()
        takeRecords = vi.fn(() => [])
      },
    )
    const { unmount } = render(<KeyLantern state="lit" />)
    expect(observe).toHaveBeenCalledTimes(1)
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
