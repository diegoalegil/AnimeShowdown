import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageToggle from './LanguageToggle'

const i18nState = vi.hoisted(() => ({
  resolvedLanguage: 'es',
  language: 'es',
  changeLanguage: vi.fn(),
}))

const sound = vi.hoisted(() => ({
  play: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nState,
    t: (key: string) => (key === 'header.elegirIdioma' ? 'Elegir idioma' : key),
  }),
}))

vi.mock('../contexts/SoundContext', () => ({
  useSound: () => ({ play: sound.play, warm: vi.fn(), muted: false, toggleMute: vi.fn() }),
}))

describe('LanguageToggle', () => {
  beforeEach(() => {
    // Mock realista: changeLanguage muta el estado i18n para que un cambio
    // iniciado por la UI, tras un rerender, derive el nuevo activo (y dispare
    // el estampado), igual que en producción con react-i18next.
    i18nState.changeLanguage.mockImplementation((code: string) => {
      i18nState.resolvedLanguage = code
      i18nState.language = code
    })
  })
  afterEach(() => {
    cleanup()
    i18nState.resolvedLanguage = 'es'
    i18nState.language = 'es'
    i18nState.changeLanguage.mockReset()
    sound.play.mockReset()
  })

  it('muestra el sello del idioma activo y no anuncia nada al montar', () => {
    render(<LanguageToggle />)

    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    expect(trigger).toHaveTextContent('ES')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // cero ceremonia al montar: ni sonido ni anuncio del live region
    expect(sound.play).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('deriva el sello desde un locale regional (en-US) y marca el item correcto', async () => {
    i18nState.resolvedLanguage = 'en-US'
    render(<LanguageToggle />)

    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    expect(trigger).toHaveTextContent('EN')

    // Cruza la derivación slice(0,2) con el aria-checked del item activo: en-US
    // debe marcar English, no caer a ES.
    fireEvent.click(trigger)
    const english = await screen.findByRole('menuitemradio', { name: /English/i })
    const espanol = screen.getByRole('menuitemradio', { name: /Español/i })
    expect(english).toHaveAttribute('aria-checked', 'true')
    expect(espanol).toHaveAttribute('aria-checked', 'false')
  })

  it('abre el popover con click y expone menuitemradio con aria-checked en el activo', async () => {
    render(<LanguageToggle />)

    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const espanol = await screen.findByRole('menuitemradio', { name: /Español/i })
    const english = screen.getByRole('menuitemradio', { name: /English/i })
    const japones = screen.getByRole('menuitemradio', { name: /日本語/i })

    expect(espanol).toHaveAttribute('aria-checked', 'true')
    expect(english).toHaveAttribute('aria-checked', 'false')
    expect(japones).toHaveAttribute('aria-checked', 'false')
  })

  it('al elegir un idioma llama i18n.changeLanguage y cierra el popover', async () => {
    render(<LanguageToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Elegir idioma' }))
    const japones = await screen.findByRole('menuitemradio', { name: /日本語/i })
    fireEvent.click(japones)

    expect(i18nState.changeLanguage).toHaveBeenCalledWith('ja')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('no llama a changeLanguage si se elige el idioma ya activo', async () => {
    render(<LanguageToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Elegir idioma' }))
    const espanol = await screen.findByRole('menuitemradio', { name: /Español/i })
    fireEvent.click(espanol)

    expect(i18nState.changeLanguage).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('permite navegar el menu con flechas, Home, End, Escape y Enter', async () => {
    render(<LanguageToggle />)

    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    // ArrowDown desde el trigger abre y enfoca el idioma activo
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

    // ArrowUp circular desde el primero salta al último
    fireEvent.keyDown(espanol, { key: 'ArrowUp' })
    expect(japones).toHaveFocus()

    // Escape cierra, devuelve foco al trigger y no se propaga al document
    const documentEscape = vi.fn()
    document.addEventListener('keydown', documentEscape)
    try {
      fireEvent.keyDown(japones, { key: 'Escape' })
      expect(documentEscape).not.toHaveBeenCalled()
      expect(trigger).toHaveFocus()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    } finally {
      document.removeEventListener('keydown', documentEscape)
    }

    // ArrowUp desde el trigger abre y enfoca el último idioma; Enter elige
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    const japonesReabierto = await screen.findByRole('menuitemradio', { name: /日本語/i })
    await waitFor(() => expect(japonesReabierto).toHaveFocus())
    fireEvent.keyDown(japonesReabierto, { key: 'Enter' })

    expect(i18nState.changeLanguage).toHaveBeenCalledWith('ja')
    expect(trigger).toHaveFocus()
  })

  it('Tab dentro del menu lo cierra', async () => {
    render(<LanguageToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Elegir idioma' }))
    const espanol = await screen.findByRole('menuitemradio', { name: /Español/i })
    fireEvent.keyDown(espanol, { key: 'Tab' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('click fuera (mousedown) cierra el popover', async () => {
    render(<LanguageToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Elegir idioma' }))
    await screen.findByRole('menu')

    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('reproduce playSello cuando el idioma activo cambia (estampado)', async () => {
    const { rerender } = render(<LanguageToggle />)
    expect(sound.play).not.toHaveBeenCalled()

    i18nState.resolvedLanguage = 'ja'
    rerender(<LanguageToggle />)

    await waitFor(() => expect(sound.play).toHaveBeenCalledWith('playSello'))
    // el live region anuncia el nuevo idioma
    expect(screen.getByRole('status')).toHaveTextContent('日本語')
  })

  it('elegir por click encadena changeLanguage → estampado (playSello) y anuncio', async () => {
    // Happy-path completo del usuario: el mock realista muta el idioma; tras el
    // rerender, el guard de render detecta el cambio y dispara el estampado.
    const { rerender } = render(<LanguageToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Elegir idioma' }))
    const japones = await screen.findByRole('menuitemradio', { name: /日本語/i })
    fireEvent.click(japones)

    expect(i18nState.changeLanguage).toHaveBeenCalledWith('ja')
    rerender(<LanguageToggle />)
    await waitFor(() => expect(sound.play).toHaveBeenCalledWith('playSello'))
    expect(screen.getByRole('status')).toHaveTextContent('日本語')
  })

  it('Space sobre un item elige el idioma y devuelve foco al trigger', async () => {
    render(<LanguageToggle />)
    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    fireEvent.click(trigger)
    const japones = await screen.findByRole('menuitemradio', { name: /日本語/i })
    fireEvent.keyDown(japones, { key: ' ' })

    expect(i18nState.changeLanguage).toHaveBeenCalledWith('ja')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Enter en el trigger abre el popover y enfoca el idioma activo', async () => {
    render(<LanguageToggle />)
    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    fireEvent.keyDown(trigger, { key: 'Enter' })

    const espanol = await screen.findByRole('menuitemradio', { name: /Español/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(espanol).toHaveFocus())
  })

  it('Space en el trigger abre el popover y enfoca el idioma activo', async () => {
    render(<LanguageToggle />)
    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    fireEvent.keyDown(trigger, { key: ' ' })

    const espanol = await screen.findByRole('menuitemradio', { name: /Español/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(espanol).toHaveFocus())
  })

  it('Escape sobre el propio trigger (con el menú abierto) cierra sin propagar', async () => {
    render(<LanguageToggle />)
    const trigger = screen.getByRole('button', { name: 'Elegir idioma' })
    fireEvent.click(trigger)
    await screen.findByRole('menu')

    const documentEscape = vi.fn()
    document.addEventListener('keydown', documentEscape)
    try {
      fireEvent.keyDown(trigger, { key: 'Escape' })
      expect(documentEscape).not.toHaveBeenCalled()
      expect(trigger).toHaveFocus()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    } finally {
      document.removeEventListener('keydown', documentEscape)
    }
  })
})
