import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Search } from 'lucide-react'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { OPEN_COMMAND_PALETTE_EVENT } from '../components/CommandPaletteLazyMount'
import { suggestPersonaje } from './lost-path-suggest'
import './lost-path.css'

function abrirPaleta() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
}

/**
 * LostPath — 404 del recinto (pieza 100). Peso pluma, SIN imágenes: el kanji 迷
 * (perdido) grande, tres faroles de piedra apagados que marcan una senda que
 * se difumina en la niebla, copy honesto y DOS salidas — el hogar y el
 * buscador (abre la paleta de mando directamente). Si la URL parece un
 * personaje mal escrito (/personajes/<slug>), ofrece "¿Quizás buscabas?" con
 * el match más cercano del catálogo YA cargado (heurística en
 * lost-path-suggest.js, umbral de confianza alta documentado).
 *
 * <p>Coreografía 100% CSS (animation-delay): el 迷 entra al montar, los
 * faroles en stagger 120ms, y el corte de tinta de la sugerencia a t+600ms —
 * sin estado de coreografía → compatible con React 19 + Compiler. La niebla
 * es UNA capa de gradiente estático (cero animación). prefers-reduced-motion
 * deja todo estático. Cero loops infinitos → nada que pausar.
 *
 * <p>Render-safe: el único cálculo es la sugerencia (useMemo puro sobre
 * pathname + catálogo). El kanji 迷 es decorativo (aria-hidden); el título
 * real es el h1. No usa KanjiStroke porque 迷 no está en KANJI_STROKES (se
 * vería plano igualmente); el glifo ya está en el subset de la fuente.
 */
function LostPath() {
  const { pathname } = useLocation()
  const { personajes } = usePersonajesCatalogo()
  const sugerencia = useMemo(
    () => suggestPersonaje(pathname, personajes),
    [pathname, personajes],
  )

  return (
    <section className="lost" aria-labelledby="lost-title">
      <div className="lost__fog" aria-hidden="true" />

      <div className="lost__scene" aria-hidden="true">
        <span className="lost__kanji" lang="ja">迷</span>
        <div className="lost__path">
          <span className="lost__lantern" />
          <span className="lost__lantern" />
          <span className="lost__lantern" />
        </div>
      </div>

      <div className="lost__content">
        <p className="lost__eyebrow" aria-hidden="true">迷 · senda perdida</p>
        <h1 id="lost-title" className="lost__title">
          Página no encontrada
        </h1>
        <p className="lost__lede">
          Esta senda no existe — o el cartel se lo llevó el viento. Vuelve al
          recinto o busca lo que querías ver.
        </p>

        {sugerencia ? (
          <Link to={`/personajes/${sugerencia.slug}`} className="lost__suggest">
            <span className="lost__suggest-label">¿Quizás buscabas?</span>
            <span className="lost__suggest-name">{sugerencia.nombre ?? sugerencia.slug}</span>
          </Link>
        ) : null}

        <div className="lost__exits">
          <Link to="/" className="lost__exit lost__exit--primary">
            <Home className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>
          <button type="button" className="lost__exit" onClick={abrirPaleta}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Buscar en el recinto
          </button>
        </div>
      </div>
    </section>
  )
}

export default LostPath
