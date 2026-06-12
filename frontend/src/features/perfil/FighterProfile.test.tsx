import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — componente .jsx sin tipos
import FighterProfile from './FighterProfile'

const play = vi.fn()
vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('../../components/Avatar', () => ({
  default: ({ user }: { user: { username: string } }) => (
    <img alt={`Avatar de ${user.username}`} />
  ),
}))

vi.mock('../../components/CountUp', () => ({
  default: ({ target }: { target: number }) => <>{target}</>,
}))

afterEach(() => {
  cleanup()
  play.mockClear()
})

const PERFIL = {
  username: 'yuki',
  avatarUrl: '/a.webp',
  marcoAvatar: 'oro',
  bannerUrl: null,
  bio: 'Shōnen de corazón.',
  fechaRegistro: '2025-03-10T10:00:00',
  seguidores: 12,
  seguidos: 4,
  esMismoUsuario: false,
  stats: {
    votosTotales: 321,
    badgesDesbloqueados: 7,
    eloPvp: 1180,
    pvpPartidos: 9,
  },
  top: [
    { slug: 'luffy', nombre: 'Luffy', imagenUrl: '/img/l.webp', anime: 'One Piece', votos: 30 },
    { slug: 'zoro', nombre: 'Zoro', imagenUrl: '/img/z.webp', anime: 'One Piece', votos: 20 },
  ],
  logros: [
    { id: 1, codigo: 'a', nombre: 'Primer voto', rareza: 1, desbloqueadoEn: '2026-06-01T10:00:00' },
    { id: 2, codigo: 'b', nombre: 'Leyenda', rareza: 4, desbloqueadoEn: '2026-06-10T10:00:00' },
    { id: 3, codigo: 'c', nombre: 'Bloqueado', rareza: 2, desbloqueadoEn: null },
  ],
}

function renderFicha(props = {}) {
  return render(
    <MemoryRouter>
      <FighterProfile
        perfil={PERFIL}
        esPropio={false}
        hrefPersonaje={(slug: string) => `/personajes/${slug}`}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('FighterProfile', () => {
  it('pinta la ficha: h1, meta de comunidad, KPIs reales y banner fallback del favorito', () => {
    const { container } = renderFicha()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('yuki')
    expect(screen.getByText(/seguidores/)).toBeInTheDocument()
    expect(screen.getByText('Shōnen de corazón.')).toBeInTheDocument()
    expect(screen.getByText('Votos emitidos')).toBeInTheDocument()
    expect(screen.getByText('321')).toBeInTheDocument()
    expect(screen.getByText('ELO duelo')).toBeInTheDocument()
    expect(screen.getByText('1180')).toBeInTheDocument()
    // sin banner subido → arte del favorito (top[0])
    expect(container.querySelector('.fp-banner-media')).toHaveAttribute('src', '/img/l.webp')
  })

  it('ELO duelo sin partidos enseña “—” (no el seed por defecto)', () => {
    renderFicha({
      perfil: { ...PERFIL, stats: { ...PERFIL.stats, eloPvp: 1000, pvpPartidos: 0 } },
    })
    const kpi = screen.getByText('ELO duelo').closest('.fp-kpi')
    expect(kpi).toHaveTextContent('—')
  })

  it('vitrina: top5 navegable con numerales y medallas por rareza (solo desbloqueados, recientes primero)', () => {
    const { container } = renderFicha()
    const links = Array.from(container.querySelectorAll('.fp-mini-link')).map((a) =>
      a.getAttribute('href'),
    )
    expect(links).toEqual(['/personajes/luffy', '/personajes/zoro'])
    const medallas = Array.from(container.querySelectorAll('.fp-medal'))
    expect(medallas).toHaveLength(2)
    expect(medallas[0]).toHaveAttribute('title', 'Leyenda')
    expect(medallas[0]).toHaveTextContent('王')
    expect(medallas[1]).toHaveTextContent('印')
  })

  it('ajeno sin carta destacada: el bloque se omite; propio: tile informativo', () => {
    renderFicha()
    expect(screen.queryByText('Carta destacada')).toBeNull()
    cleanup()
    renderFicha({ esPropio: true })
    expect(screen.getByText('Carta destacada')).toBeInTheDocument()
    expect(screen.getByText(/carta que te representa/)).toBeInTheDocument()
  })

  it('perfil recién creado y ajeno: líneas discretas sin CTAs', () => {
    renderFicha({
      perfil: { ...PERFIL, top: [], logros: [] },
    })
    expect(screen.getByText(/aún no ha acuñado su top 5/)).toBeInTheDocument()
    expect(screen.getByText(/Sin logros estampados/)).toBeInTheDocument()
    expect(screen.queryByText('Empezar a votar')).toBeNull()
  })

  it('el slot de acción principal se renderiza en la cabecera', () => {
    renderFicha({ accionPrincipal: <button type="button">Seguir</button> })
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument()
  })
})
