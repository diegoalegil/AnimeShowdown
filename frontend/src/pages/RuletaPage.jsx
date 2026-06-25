import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import GameCatalogLoading from '../components/GameCatalogLoading'
import { VisualPageShell } from '../components/VisualSystem'
import { getGameVisual } from '../data/visual-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import DestinyDrum from '../components/DestinyDrum'

const SEO_IMAGE = getGameVisual('/games/ruleta', 'La ruleta del destino').image

// Roster mínimo razonable del tambor: el wrap renderiza 3 copias (handoff §1).
const ROSTER_MINIMO = 3
// Tope del carrete: el tambor pinta 3× el roster. Con el catálogo entero
// (~1000 personajes) serían 3000 <img> montados. Recortamos a una muestra
// generosa pero acotada; el motor sortea SOBRE ese roster activo, así que el
// elegido siempre pertenece a lo que el tambor monta (contrato anti-trampa).
const ROSTER_MAX = 60

/**
 * La ruleta del destino — `/games/ruleta`.
 *
 * <p>MOTOR del juego (es la dueña del estado). El tambor `DestinyDrum` es
 * puramente presentacional y JAMÁS re-sortea: aquí decidimos el resultado
 * aleatorio ANTES de girar y lo subimos como `{ slug, spinId }` con un
 * spinId nuevo y monotónico. El tambor coreografía hacia ese slug y la
 * física garantiza que el elegido cae bajo el visor (garantía matemática
 * del handoff). `Math.random` vive SOLO en el handler `pedirGiro`, nunca
 * en render.
 */
function RuletaPage() {
  useSeo({
    title: 'La ruleta del destino · Ruleta',
    description:
      'Gira el tambor del festival y deja que el destino elija un personaje de anime al azar. Vota con él o abre su ficha en AnimeShowdown.',
    canonical: 'https://animeshowdown.dev/games/ruleta',
    image: SEO_IMAGE,
    // Juego sin contenido indexable propio (RNG por giro): como otros juegos
    // endless, evitamos competir con las páginas de personaje en el índice.
    noindex: true,
  })

  const navigate = useNavigate()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()

  // Roster activo: personajes con slug válido, recortado a un tope. Identidad
  // ESTABLE durante un giro (memoizado): cambiarlo a mitad cancela la
  // coreografía (handoff §1). El roster no cambia mientras se gira porque no
  // exponemos filtro dinámico.
  const roster = useMemo(
    () =>
      catalogoPersonajes
        .filter((p) => p?.slug && p?.nombre)
        .slice(0, ROSTER_MAX),
    [catalogoPersonajes],
  )

  // Resultado decidido por el MOTOR: { slug, spinId }. null hasta el primer giro.
  const [resultado, setResultado] = useState(null)

  // Botón → el motor elige (Math.random SOLO aquí, nunca en render) → sube
  // resultado con un spinId NUEVO. El tambor no re-sortea: solo coreografía.
  const pedirGiro = useCallback(() => {
    if (roster.length < ROSTER_MINIMO) return
    const idx = Math.floor(Math.random() * roster.length)
    const elegido = roster[idx]
    setResultado((prev) => ({
      slug: elegido.slug,
      spinId: (prev?.spinId ?? 0) + 1,
    }))
  }, [roster])

  // CTA «Ver ficha» → ficha del personaje. Navegación normal: el retrato del
  // tambor es decorativo (aria-hidden), sin elemento estable que morfear hacia
  // el hero — el morph se reserva para orígenes con holder propio (cards).
  const verFicha = useCallback(
    (personaje) => {
      if (personaje?.slug) navigate(`/personajes/${personaje.slug}`)
    },
    [navigate],
  )

  // CTA «Votar con {nombre}» → arena de votación CON el personaje sorteado
  // (?personaje=slug lo lee useFixedDuelParams para fijar el duelo). Antes
  // navegaba a /votar a secas, ignorando lo que cayó bajo el visor.
  const votar = useCallback(() => {
    if (resultado?.slug) {
      navigate(`/votar?personaje=${encodeURIComponent(resultado.slug)}`)
    } else {
      navigate('/votar')
    }
  }, [navigate, resultado])

  if (roster.length < ROSTER_MINIMO) {
    return (
      <GameCatalogLoading
        kanji="運"
        title="Preparando la ruleta"
        description="Cargando el roster de personajes para montar el tambor del destino."
      />
    )
  }

  return (
    <VisualPageShell
      visual={getGameVisual('/games/ruleta', 'La ruleta del destino')}
      contentClassName="mx-auto max-w-3xl"
      lateralKanji={{ left: '運', right: '祭' }}
      atmosphere="ritual"
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Juegos', path: '/games' },
          { label: 'La ruleta del destino', path: '/games/ruleta' },
        ])}
      />
      <div className="mx-auto max-w-2xl">
        <Link
          to="/games"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub de juegos
        </Link>

        <header className="mb-8 flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <Sparkles className="h-3 w-3" />
            <span lang="ja">運命</span> · Ruleta
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            La ruleta del destino
          </h1>
          <p className="text-[13px] text-fg-muted">
            Gira el tambor del festival y deja que el azar elija a tu campeón.
            El elegido cae bajo el visor — vota con él o abre su ficha. Gira
            seguido para calentar el tambor.
          </p>
        </header>

        <div className="flex justify-center">
          <DestinyDrum
            roster={roster}
            resultado={resultado}
            onPedirGiro={pedirGiro}
            onVerFicha={verFicha}
            onVotar={votar}
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-fg-muted">
          Sin límite diario ·{' '}
          <Link to="/games" className="hover:text-gold hover:underline">
            Juegos del día
          </Link>
        </p>
      </div>
    </VisualPageShell>
  )
}

export default RuletaPage
