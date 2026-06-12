import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import VotarTopBar from './VotarTopBar'

afterEach(() => cleanup())

function renderTopBar(props: Record<string, unknown> = {}) {
  const handlers = {
    onChallenge: vi.fn(),
    onToggleFastMode: vi.fn(),
    onToggleBlindMode: vi.fn(),
    onNext: vi.fn(),
  }
  render(
    <VotarTopBar
      arenaStatusLabel="Duelo en juego · En vivo"
      showChallenge
      fastMode={false}
      blindMode={false}
      controlsDisabled={false}
      votedFor={null}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('VotarTopBar', () => {
  it('muestra el badge de estado y despacha cada accion', () => {
    const handlers = renderTopBar()
    expect(screen.getByText('Duelo en juego · En vivo')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Reta a un amigo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Modo rápido/ }))
    fireEvent.click(screen.getByRole('button', { name: /Voto a ciegas/ }))
    fireEvent.click(screen.getByRole('button', { name: /Saltar duelo/ }))

    expect(handlers.onChallenge).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleFastMode).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleBlindMode).toHaveBeenCalledTimes(1)
    expect(handlers.onNext).toHaveBeenCalledTimes(1)
  })

  it('tras votar el skip pasa a "Siguiente duelo" y oculta el reto', () => {
    renderTopBar({ votedFor: 'luffy', showChallenge: false })
    expect(screen.getByRole('button', { name: /Siguiente duelo/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reta a un amigo/ })).toBeNull()
  })

  it('los toggles exponen su estado con aria-pressed', () => {
    renderTopBar({ fastMode: true, blindMode: true })
    expect(screen.getByRole('button', { name: /Modo rápido/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Voto a ciegas/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('mantiene acciones icon-first en movil y texto visible desde sm', () => {
    // Checks de clases responsive heredados de VotarPage.mobile.test.ts al
    // extraer el top bar (los 4 botones icon-first viven aquí ahora).
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/votar/components/VotarTopBar.jsx'),
      'utf8',
    )
    expect(source).toContain('className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"')
    expect(source.match(/sr-only sm:not-sr-only/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(source.match(/min-h-11 w-11 shrink-0/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(source.match(/sm:w-auto sm:px-3\.5/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(source).toContain('<ArrowRight className="hidden h-3 w-3 sm:block" />')
  })
})
