import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LanguageToggle from './LanguageToggle'

const i18nState = vi.hoisted(() => ({
  resolvedLanguage: 'es',
  language: 'es',
  changeLanguage: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nState,
    t: (key: string) => (key === 'header.elegirIdioma' ? 'Elegir idioma' : key),
  }),
}))

describe('LanguageToggle', () => {
  afterEach(() => {
    cleanup()
    i18nState.resolvedLanguage = 'es'
    i18nState.language = 'es'
    i18nState.changeLanguage.mockReset()
  })

  it('mantiene un target tactil de 44px en el trigger y las opciones', async () => {
    render(<LanguageToggle />)

    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    expect(trigger).toHaveClass('min-h-11')
    expect(trigger).not.toHaveClass('xl:h-8')

    fireEvent.click(trigger)

    const opciones = await screen.findAllByRole('menuitemradio')
    opciones.forEach((opcion) => {
      expect(opcion).toHaveClass('min-h-11')
    })
  })

  it('permite navegar el menu con flechas, Home, End, Escape y Enter', async () => {
    render(<LanguageToggle />)

    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const espanol = await screen.findByRole('menuitemradio', { name: /Español/i })
    const english = screen.getByRole('menuitemradio', { name: /English/i })
    const japones = screen.getByRole('menuitemradio', { name: /日本語/i })

    await waitFor(() => expect(espanol).toHaveFocus())

    fireEvent.keyDown(espanol, { key: 'ArrowDown' })
    expect(english).toHaveFocus()

    fireEvent.keyDown(english, { key: 'End' })
    expect(japones).toHaveFocus()

    fireEvent.keyDown(japones, { key: 'Home' })
    expect(espanol).toHaveFocus()

    const documentEscape = vi.fn()
    document.addEventListener('keydown', documentEscape)
    try {
      fireEvent.keyDown(espanol, { key: 'Escape' })
      expect(documentEscape).not.toHaveBeenCalled()
      expect(trigger).toHaveFocus()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    } finally {
      document.removeEventListener('keydown', documentEscape)
    }

    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    const japonesReabierto = await screen.findByRole('menuitemradio', { name: /日本語/i })
    await waitFor(() => expect(japonesReabierto).toHaveFocus())
    fireEvent.keyDown(japonesReabierto, { key: 'Enter' })

    expect(i18nState.changeLanguage).toHaveBeenCalledWith('ja')
    expect(trigger).toHaveFocus()
  })
})
