import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PackOpening from './PackOpening'
import ForgeCharge from './forge/ForgeCharge'

const playMock = vi.fn()
const warmMock = vi.fn()

vi.mock('../../contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock, warm: warmMock }),
}))

vi.mock('../../components/PersonajeImg', () => ({
  default: ({ alt, className = '' }) => (
    <span role="img" aria-label={alt} className={className} />
  ),
}))

// useReducedMotion controlable: por defecto false (ritual completo de la
// fragua). El test del fast-path lo pone en true.
let reduceMotion = false
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => reduceMotion }
})

const baseCarta = {
  colorDominante: 'var(--color-surface)',
  poseida: true,
  cantidad: 1,
  elo: 1200,
}

const fastTiming = {
  peel: 1,
  rip: 1,
  autoFlipNormal: 1,
  autoCollectNormal: 1,
  revealDingDelay: 1,
  collect: 1,
  nextDelay: 1,
  flash: 1,
  flashSpecial: 1,
}

const revealEspecial = {
  especial: true,
  saldoRestante: 50,
  monedasDuplicados: 10,
  cartas: [
    {
      posicion: 1,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: { ...baseCarta, id: 1, personajeSlug: 'naruto', personajeNombre: 'Naruto Uzumaki', anime: 'Naruto', rareza: 'SSR' },
    },
    {
      posicion: 2,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: { ...baseCarta, id: 2, personajeSlug: 'luffy', personajeNombre: 'Monkey D. Luffy', anime: 'One Piece', rareza: 'SSR' },
    },
    {
      posicion: 3,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: { ...baseCarta, id: 3, personajeSlug: 'goku', personajeNombre: 'Goku', anime: 'Dragon Ball', rareza: 'SSR' },
    },
    {
      posicion: 4,
      nueva: true,
      recompensaDuplicado: 0,
      climax: 'NORMAL',
      carta: { ...baseCarta, id: 4, personajeSlug: 'frieren', personajeNombre: 'Frieren', anime: 'Frieren', rareza: 'SSR' },
    },
    {
      posicion: 5,
      nueva: false,
      recompensaDuplicado: 10,
      climax: 'ESPECIAL',
      carta: {
        ...baseCarta,
        id: 5,
        personajeSlug: 'satoru_gojo',
        personajeNombre: 'Satoru Gojo',
        anime: 'Jujutsu Kaisen',
        rareza: 'ESPECIAL',
        especialCurada: true,
        arteUrl: '/assets/cartas-especiales/satoru_gojo.webp',
      },
    },
  ],
}

function renderPack() {
  return render(
    <PackOpening
      reveal={revealEspecial}
      puedeAbrirOtro
      abriendo={false}
      onAbrirOtro={() => {}}
      onCerrar={() => {}}
      timing={fastTiming}
    />,
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Tras la rotura del lingote: cadena de revelado existente -> resumen + footer.
// Asume que ya estamos en (o llegando a) la fase 'reveal'. NO debilita las
// aserciones de revelado/resumen del test original.
async function avanzarRevelar() {
  await waitFor(
    () => {
      expect(screen.getAllByText('Naruto Uzumaki').length).toBeGreaterThan(0)
    },
    { timeout: 12000 },
  )

  const climaxButton = await screen.findByRole('button', { name: 'Revelar carta 5' }, { timeout: 12000 })
  fireEvent.click(climaxButton)
  fireEvent.click(await screen.findByRole('button', { name: 'Ver resumen' }, { timeout: 12000 }))

  await waitFor(
    () => {
      expect(screen.getByText('Resumen del sobre')).toBeInTheDocument()
    },
    { timeout: 12000 },
  )
  expect(screen.getByAltText('Satoru Gojo')).toBeInTheDocument()
  expect(screen.getByText('Duplicada +10')).toBeInTheDocument()
  expect(playMock).toHaveBeenCalledWith('playPackRevealSpecial')
}

describe('PackOpening — ritual de la fragua + revelado existente', () => {
  afterEach(async () => {
    // Drena timers de 1ms con window aún vivo (igual que el test original).
    await new Promise((resolve) => setTimeout(resolve, 60))
    cleanup() // globals:false => sin auto-cleanup de RTL; lo hacemos a mano.
    reduceMotion = false
  })

  beforeEach(() => {
    playMock.mockClear()
    warmMock.mockClear()
    reduceMotion = false
  })

  it('muestra el lingote en el yunque (golpe 1 de 5 por sobre ESPECIAL)', async () => {
    renderPack()
    expect(screen.queryByText('Resumen del sobre')).not.toBeInTheDocument()
    // El sobre ESPECIAL (5 cartas con clímax ESPECIAL) => 5 golpes.
    expect(
      await screen.findByRole('button', { name: 'golpear el lingote (golpe 1 de 5)' }, { timeout: 12000 }),
    ).toBeInTheDocument()
    // La llegada usa playAcunado (no el viejo playPackCharge).
    expect(playMock).toHaveBeenCalledWith('playAcunado')
  }, 15000)

  it('los N golpes rompen el lingote y ceden al revelado, terminando en resumen', async () => {
    renderPack()

    // El lingote solo es golpeable tras la fase de llegada (~450ms): esperamos
    // al prompt de "striking" antes del 1er golpe (un click durante la llegada
    // se ignora a propósito).
    await screen.findByText('Golpea el lingote para forjarlo', undefined, { timeout: 12000 })

    // Encadena los 5 golpes; entre golpes esperamos a que el lock anti-doble-tap
    // (120ms normal / 250ms penúltimo) expire en tiempo real.
    let golpe = await screen.findByRole('button', { name: 'golpear el lingote (golpe 1 de 5)' }, { timeout: 12000 })
    fireEvent.click(golpe)
    for (let n = 2; n <= 5; n += 1) {
      await wait(300)
      golpe = await screen.findByRole('button', { name: `golpear el lingote (golpe ${n} de 5)` }, { timeout: 12000 })
      fireEvent.click(golpe)
    }

    // El golpe metálico suena (playYunque) y la rotura emite playPackTear.
    expect(playMock).toHaveBeenCalledWith('playYunque', expect.any(Number))
    await waitFor(() => expect(playMock).toHaveBeenCalledWith('playPackTear'), { timeout: 12000 })

    await avanzarRevelar()
  }, 30000)

  it('"Abrir directo" salta el ritual y cede directo al revelado', async () => {
    renderPack()
    const directo = await screen.findByRole('button', { name: 'Abrir directo' }, { timeout: 12000 })
    fireEvent.click(directo)
    await waitFor(() => expect(playMock).toHaveBeenCalledWith('playPackTear'), { timeout: 12000 })
    await avanzarRevelar()
  }, 30000)

  it('reduced-motion: respeta el fast-path -> directo al resumen (sin forja)', async () => {
    reduceMotion = true
    renderPack()
    // No hay yunque/lingote: el fast-path del repo va directo al resumen.
    expect(screen.queryByRole('button', { name: /golpear el lingote/ })).not.toBeInTheDocument()
    expect(await screen.findByText('Resumen del sobre', undefined, { timeout: 12000 })).toBeInTheDocument()
    expect(screen.getByAltText('Satoru Gojo')).toBeInTheDocument()
    expect(screen.getByText('Duplicada +10')).toBeInTheDocument()
  }, 15000)
})

describe('ForgeCharge — camino seco (reduced-motion) en aislamiento', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    playMock.mockClear()
    warmMock.mockClear()
  })

  it('en seco arranca golpeable (sin fase de llegada) y los golpes rompen -> onBreak', async () => {
    const onBreak = vi.fn()
    render(<ForgeCharge blows={2} level="top" reduceMotion onBreak={onBreak} />)

    // En seco no hay "el lingote llega al yunque…"; está ya golpeable y sin
    // lock entre golpes (lock = now + 0), así que los golpes encadenan al vuelo.
    expect(screen.queryByText('el lingote llega al yunque…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'golpear el lingote (golpe 1 de 2)' }))
    fireEvent.click(screen.getByRole('button', { name: 'golpear el lingote (golpe 2 de 2)' }))

    expect(playMock).toHaveBeenCalledWith('playYunque', expect.any(Number))
    // La rotura (playPackTear) y onBreak se agendan en un timer (later 1ms).
    await waitFor(() => expect(playMock).toHaveBeenCalledWith('playPackTear'), { timeout: 12000 })
    await waitFor(() => expect(onBreak).toHaveBeenCalledTimes(1), { timeout: 12000 })
  }, 15000)
})
