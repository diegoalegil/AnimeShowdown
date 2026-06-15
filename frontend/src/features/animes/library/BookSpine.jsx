import { memo, useCallback, useLayoutEffect, useRef } from 'react'
import { brandImage } from '../../../lib/brand-assets'
import { mountSceneCard } from '../../../lib/animeSceneMorph'
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
 * @param {string} [props.kanjiSignificado]  Significado editorial del kanji (tooltip nativo del lomo).
 * @param {number} props.indiceGlobal  Índice global (stagger de la caída de canto).
 * @param {boolean} props.expanded     ¿Su fly-leaf está abierto?
 * @param {boolean} props.match        ¿Casa con la búsqueda activa? (atenúa si no).
 * @param {(slug:string)=>void} props.onToggle  Abre/cierra su fly-leaf.
 * @param {(slug:string, el:HTMLButtonElement|null)=>void} [props.registerRef]  Registra el nodo (devolver foco al cerrar).
 * @param {React.ReactNode} [props.children]  El FlyLeaf, anclado al tomo cuando está abierto.
 */
function BookSpineImpl({
  universo,
  kanji,
  kanjiSignificado,
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

  // registerRef es estable y recibe (slug, node): lo curramos aquí (estable por
  // slug vía useCallback) para el ref del botón sin anular el memo del padre.
  const handleButtonRef = useCallback(
    (node) => registerRef?.(slug, node),
    [registerRef, slug],
  )

  // Morph de VUELTA (detalle → catálogo): registramos el tejuelo como cover del
  // morph anime-scene SOLO cuando el fly-leaf NO está abierto. Así, al volver de
  // la ficha (sin tomo abierto), mountSceneCard ya tiene un destino visible y la
  // vuelta contrae el hero hacia el tejuelo (con sus propios guards de
  // heldAtCapture/coverVisible); cuando el tomo SÍ está abierto, es el FlyLeaf
  // quien registra la escena grande (origen de la IDA), evitando un duplicado de
  // view-transition-name y conservando el morph de ida intacto.
  const tejueloRef = useRef(null)
  useLayoutEffect(() => {
    const el = tejueloRef.current
    if (!el || expanded) return undefined
    return mountSceneCard(el, slug)
  }, [slug, expanded])

  return (
    <li
      className="lib-book"
      data-match={match ? '1' : '0'}
      data-open={expanded ? '1' : '0'}
      style={{ '--i': indiceGlobal, '--drop-rot': dropRot }}
    >
      <button
        ref={handleButtonRef}
        type="button"
        className="book-spine"
        data-laca={laca}
        aria-expanded={expanded}
        onClick={() => onToggle(slug)}
      >
        <span
          className="book-spine__kanji"
          aria-hidden="true"
          lang="ja"
          title={kanjiSignificado ? `${kanji} — ${kanjiSignificado}` : undefined}
        >
          {kanji}
        </span>
        <span className="book-spine__rule" aria-hidden="true" />
        <span className="book-spine__title">{anime}</span>
        {scene ? (
          <span ref={tejueloRef} className="book-spine__tejuelo" aria-hidden="true">
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
