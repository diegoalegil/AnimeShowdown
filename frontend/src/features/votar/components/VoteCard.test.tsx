import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import VoteCard from './VoteCard'

vi.mock('../../../contexts/SoundContext', () => ({
  useSound: () => ({ play: vi.fn(), warm: vi.fn() }),
}))

vi.mock('../../../lib/cuts', () => ({
  hasCut: (slug: string) => slug === 'luffy',
}))

vi.mock('../../../components/PersonajeCutImg', () => ({
  default: ({
    alt,
    className,
    imgClassName,
  }: {
    alt?: string
    className?: string
    imgClassName?: string
  }) => (
    <span
      role="img"
      aria-label={alt}
      data-testid="personaje-cut-img"
      data-img-class-name={imgClassName}
      className={className}
    />
  ),
}))

vi.mock('../../../components/PersonajeImg', () => ({
  default: ({
    alt,
    className,
    nombre,
  }: {
    alt?: string
    className?: string
    nombre?: string
  }) => (
    <span
      role="img"
      aria-label={alt}
      data-testid="personaje-img"
      data-nombre={nombre}
      className={className}
    />
  ),
}))

afterEach(() => cleanup())

const personaje = {
  id: 1,
  slug: 'luffy',
  nombre: 'Monkey D. Luffy',
  anime: 'One Piece',
  imagenUrl: '/img/luffy.webp',
  imagenColorDominante: 'var(--color-surface)',
}

function renderVoteCard(overrides = {}) {
  const onClick = vi.fn()
  render(
    <MemoryRouter>
      <VoteCard
        personaje={personaje}
        onClick={onClick}
        disabled={false}
        isVoted={false}
        isLoser={false}
        showResult={false}
        side="left"
        anonymousLimited={false}
        voteResult={null}
        {...overrides}
      />
    </MemoryRouter>,
  )
  return { onClick }
}

describe('VoteCard blind mode', () => {
  it('oculta identidad y accesibilidad antes de votar', () => {
    renderVoteCard({ blindMode: true })

    expect(screen.queryByText('Monkey D. Luffy')).not.toBeInTheDocument()
    expect(screen.queryByText('One Piece')).not.toBeInTheDocument()
    expect(screen.getByText('Opción izquierda')).toBeInTheDocument()
    expect(screen.getByText('Identidad oculta')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /votar a ciegas por la opción izquierda/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('personaje-cut-img')).toHaveAttribute(
      'data-img-class-name',
      expect.stringContaining('brightness-0'),
    )
  })

  it('no filtra el nombre en el voto invitado a ciegas', () => {
    renderVoteCard({
      blindMode: true,
      anonymousLimited: true,
      side: 'right',
    })

    expect(
      screen.getByRole('button', {
        name: /votar como invitado a ciegas por la opción derecha/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Monkey D. Luffy')).not.toBeInTheDocument()
    expect(screen.queryByText('One Piece')).not.toBeInTheDocument()
  })

  it('revela personaje y ficha despues de votar', () => {
    renderVoteCard({
      blindMode: true,
      isVoted: true,
      showResult: true,
    })

    expect(screen.getByText('Monkey D. Luffy')).toBeInTheDocument()
    expect(screen.getByText('One Piece')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /votar por monkey d\. luffy de one piece/i,
      }),
    ).toBeDisabled()
    expect(screen.getByRole('link', { name: /ver ficha/i })).toHaveAttribute(
      'href',
      '/personajes/luffy',
    )
  })

  it('mantiene identidad oculta tambien cuando no hay recorte', () => {
    renderVoteCard({
      blindMode: true,
      personaje: {
        ...personaje,
        slug: 'sin-recorte',
      },
    })

    expect(screen.queryByText('Monkey D. Luffy')).not.toBeInTheDocument()
    expect(screen.getByTestId('personaje-img')).toHaveAttribute(
      'data-nombre',
      'Opción izquierda',
    )
    expect(screen.getByTestId('personaje-img').className).toContain('brightness-0')
  })
})
