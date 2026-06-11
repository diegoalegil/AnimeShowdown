import { Suspense, lazy, useEffect, useState } from 'react'
import { KanjiBackdrop } from '../../../components/VisualSystem'
import { supportsWebGL } from '../../animes/galaxy/galaxy-layout'

// El canvas arrastra el chunk de three/@react-three (mismo trato que
// UniverseGalaxy): solo se importa cuando va a montarse de verdad.
const KanjiInkAssembly = lazy(() => import('./KanjiInkAssembly'))

// Puntero fino + viewport ≥640px + sin reduced-motion: en móvil/táctil el
// splash no justifica descargar three para un backdrop decorativo, y con
// reduced-motion el resultado final sería un kanji estático — que es
// exactamente el fallback. Suscripción matchMedia viva (patrón FloatingCards).
const SPLASH_QUERY =
  '(min-width: 640px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

function useSplashCapaz() {
  const [capaz, setCapaz] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(SPLASH_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia(SPLASH_QUERY)
    const update = () => setCapaz(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return capaz
}

/**
 * Splash de tinta del hero del hub: las partículas se ensamblan en el kanji
 * del reto del día y se rearman cuando este cambia (al completar un reto, el
 * plan recalcula el destacado). Fallback en TODOS los demás casos —sin WebGL,
 * móvil/táctil, reduced-motion, chunk aún en vuelo o contexto perdido—: el
 * KanjiBackdrop estático de siempre, mismo box, cero CLS.
 */
function KanjiInkSplash({ kanji, visual }) {
  const capaz = useSplashCapaz()
  const [webgl, setWebgl] = useState(supportsWebGL)

  const estatico = (
    <KanjiBackdrop kanji={kanji} visual={visual} className="top-1/2 -translate-y-1/2" />
  )

  if (!capaz || !webgl) return estatico

  return (
    <Suspense fallback={estatico}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-1/2 h-[15rem] w-[15rem] -translate-y-1/2 select-none sm:h-[21rem] sm:w-[21rem]"
      >
        <KanjiInkAssembly
          kanji={kanji}
          className="!absolute !inset-0"
          onUnsupported={() => setWebgl(false)}
        />
      </div>
    </Suspense>
  )
}

export default KanjiInkSplash
