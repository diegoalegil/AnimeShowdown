import { memo } from 'react'
import { brandImage } from '../../../lib/brand-assets'
import { lacaPorIndice } from './library-core'

/**
 * BookSpine — un universo como TOMO lacado en vertical dentro de la estantería.
 * Lomo con kanji de universo grabado, título vertical y un tejuelo (franja del
 * arte de marca recortada, brandImage(`${slug}-scene-01`)). El deslizamiento de
 * hover/focus (14px) y la caída de canto de entrada son 100% CSS (library.css)
 * — aquí solo se pinta el contenido y se reportan toggles.
 *
 * Es un `button` (aria-expanded ligado a su fly-leaf). El tejuelo y el ELO son
 * aria-hidden: toda la información vive en el texto accesible del botón.
 *
 * @param {Object} props
 * @param {import('./library-core').Universo} props.universo  Datos del universo.
 * @param {string} props.kanji         Kanji de universo (1 glifo) grabado en el lomo.
 * @param {number} props.indiceGlobal  Índice global (stagger de la caída de canto).
 * @param {boolean} props.expanded     ¿Su fly-leaf está abierto?
 * @param {boolean} props.match        ¿Casa con la búsqueda activa? (atenúa si no).
 * @param {(slug:string)=>void} props.onToggle  Abre/cierra su fly-leaf.
 * @param {(el:HTMLButtonElement|null)=>void} [props.registerRef]  Registra el nodo (devolver foco al cerrar).
 * @param {React.ReactNode} [props.children]  El FlyLeaf, anclado al tomo cuando está abierto.
 */
function BookSpineImpl({
  universo,
  kanji,
  indiceGlobal,
  expanded,
  match,
  onToggle,
  registerRef,
  children,
}) {
  const { anime, slug, eloMedio, eloSintetico } = universo
  const scene = brandImage(`${slug}-scene-01`)
  // Variación visual determinista por índice (nunca Math.random/Date.now en render).
  const laca = lacaPorIndice(indiceGlobal)
  // Rotación de entrada alternada izq/der, determinista por paridad.
  const dropRot = indiceGlobal % 2 === 0 ? '4deg' : '-4deg'

  return (
    <li
      className="lib-book"
      data-match={match ? '1' : '0'}
      data-open={expanded ? '1' : '0'}
      style={{ '--i': indiceGlobal, '--drop-rot': dropRot }}
    >
      <button
        ref={registerRef}
        type="button"
        className="book-spine"
        data-laca={laca}
        aria-expanded={expanded}
        onClick={() => onToggle(slug)}
      >
        <span className="book-spine__kanji" aria-hidden="true" lang="ja">
          {kanji}
        </span>
        <span className="book-spine__rule" aria-hidden="true" />
        <span className="book-spine__title">{anime}</span>
        {scene ? (
          <span className="book-spine__tejuelo" aria-hidden="true">
            <img
              src={scene.src}
              srcSet={scene.srcSet}
              sizes="64px"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
        ) : (
          <span
            className="book-spine__tejuelo book-spine__tejuelo--bare"
            aria-hidden="true"
          />
        )}
        <span className="book-spine__elo" aria-hidden="true">
          {eloMedio}
          {eloSintetico ? '·b' : ''}
        </span>
      </button>
      {children}
    </li>
  )
}

/**
 * Memo: el grid no debe re-renderizar todos los tomos en cada keystroke del
 * buscador. Solo cambian `match`/`expanded`; el resto de props son estables.
 */
const BookSpine = memo(BookSpineImpl)
export default BookSpine
