import { Fragment, useEffect, useRef, useState } from 'react'
import { brandImage } from '../../../lib/brand-assets'
import { AppLink } from '../../../components/AppLink'
import AnimeSceneMorph from '../../../components/AnimeSceneMorph'
import PersonajeCutImg from '../../../components/PersonajeCutImg'

/**
 * FlyLeaf — la "guarda" del tomo: overlay anclado que se despliega (scaleY
 * origin-top) cuando un universo se abre. Arte de escena a sangre con scrim,
 * stats del universo en mono, top 3 con retratos mini y CTA "entrar al
 * universo".
 *
 * El CTA es un AppLink a /animes/:slug enganchado al morph scene → hero
 * existente: la escena de la guarda viaja envuelta en AnimeSceneMorph
 * kind="card" (origen del morph), y onViewTransitionStart marca esa escena
 * vía markAnimeScene antes de navegar (mismos guards que la card del catálogo).
 *
 * Keyed por anime abierto (montar/desmontar por slug). Es un `region` con
 * aria-label del universo; Esc lo cierra devolviendo el foco al tomo. El
 * despliegue/colapso lo gobierna el data-state vía CSS (library.css).
 *
 * @param {Object} props
 * @param {import('./library-core').Universo} props.universo  Universo abierto.
 * @param {string} props.kanji        Kanji de universo (marca de la escena).
 * @param {'left'|'right'} props.anchor  Lado de anclaje (evita desbordes a la derecha).
 * @param {boolean} props.closing     ¿Está animando el cierre? (timing 250ms).
 * @param {(slug:string)=>string} props.hrefUniverso  /animes/:slug del universo.
 * @param {()=>void} props.onClose    Cierra y devuelve el foco al tomo.
 * @param {(slug:string)=>void} [props.onEnter]  Marca el origen del morph. Va
 *   SOLO en onViewTransitionStart (no en onClick): en un click modificado
 *   —cmd/ctrl/nueva pestaña— no corre transición que limpie la marca, y
 *   markAnimeScene dejaría un view-transition-name fantasma (mismo guard que la
 *   card del catálogo original).
 * @param {()=>void} [props.onWhoosh]  Sonido al navegar (sí va en onClick).
 */
export default function FlyLeaf({
  universo,
  kanji,
  anchor = 'left',
  closing = false,
  hrefUniverso,
  onClose,
  onEnter,
  onWhoosh,
}) {
  const rootRef = useRef(null)
  const { anime, slug, numPersonajes, eloMedio, eloSintetico, top3 = [] } = universo
  const scene = brandImage(`${slug}-scene-01`)

  // Despliegue real: montamos en data-open="0" y pasamos a "1" en el siguiente
  // frame, para que la transición scaleY tenga un fotograma inicial (si naciera
  // ya abierto no animaría). setState en callback de rAF es legal en React 19.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Esc cierra y el foco vuelve al tomo (lo gestiona el padre vía onClose).
  // Listener en el documento: el fly-leaf es un overlay, el foco puede estar
  // dentro (CTA/cerrar) o haber vuelto al tomo. addEventListener en effect es
  // legal; nada de setState síncrono en cuerpo de effect.
  //
  // Como el fly-leaf actúa de diálogo (role="dialog" aria-modal — y en móvil es
  // un bottom-sheet fixed sobre el carrusel), también atrapamos Tab/Shift+Tab
  // dentro de la hoja: el foco cicla entre sus focusables (cerrar + CTA) y no se
  // escapa hacia los tomos de detrás, que quedarían visualmente ocultos.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = rootRef.current
      if (!root) return
      const focusables = root.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]
      const activo = document.activeElement
      // Si el foco está fuera de la hoja (p.ej. quedó en el tomo), lo traemos.
      if (!root.contains(activo)) {
        e.preventDefault()
        primero.focus()
        return
      }
      if (e.shiftKey && activo === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Al abrir, llevar el foco al botón de cerrar (entrada de teclado coherente).
  useEffect(() => {
    const node = rootRef.current?.querySelector('.fly-leaf__close')
    if (node && typeof node.focus === 'function') node.focus()
  }, [])

  return (
    <Fragment>
      {/* Backdrop del bottom-sheet móvil: oscurece el carrusel de detrás y
          cierra al tocar. En escritorio queda inerte (CSS lo oculta). */}
      <div
        className="fly-leaf__backdrop"
        data-closing={closing ? '1' : '0'}
        aria-hidden="true"
        onClick={onClose}
      />
    <section
      ref={rootRef}
      className="fly-leaf"
      data-anchor={anchor}
      data-open={closing ? '0' : entered ? '1' : '0'}
      data-closing={closing ? '1' : '0'}
      role="dialog"
      aria-modal="true"
      aria-label={`Universo ${anime}`}
    >
      <button
        type="button"
        className="fly-leaf__close"
        aria-label={`Cerrar ${anime}`}
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="fly-leaf__scene">
        {/* Solo la imagen viaja en el snapshot del morph (kind="card"): scrim,
            kanji y título quedan fuera del wrapper para un cross-fade limpio,
            igual que EditorialCover/CoverMedia. */}
        <AnimeSceneMorph slug={slug} kind="card" className="fly-leaf__scene-media">
          {scene ? (
            <img
              src={scene.src}
              srcSet={scene.srcSet}
              sizes="(max-width: 30rem) 80vw, 336px"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="fly-leaf__scene--bare" aria-hidden="true">
              <span className="fly-leaf__scene-kanji" lang="ja">
                {kanji}
              </span>
            </div>
          )}
        </AnimeSceneMorph>
        <span className="fly-leaf__scrim" aria-hidden="true" />
        <span className="fly-leaf__scene-kanji-mark" aria-hidden="true" lang="ja">
          {kanji}
        </span>
        <h2 className="fly-leaf__scene-title">{anime}</h2>
      </div>

      <div className="fly-leaf__body">
        <dl className="fly-leaf__stats">
          <div className="fly-leaf__stat fly-leaf__stat--chars">
            <dt>Personajes</dt>
            <dd>{numPersonajes}</dd>
          </div>
          <div className="fly-leaf__stat">
            <dt>ELO base medio</dt>
            <dd>
              {eloMedio}
              {eloSintetico ? <span className="fly-leaf__synthetic"> ·b</span> : null}
            </dd>
          </div>
        </dl>

        {top3.length > 0 && (
          <>
            <p className="fly-leaf__top-label">Top del universo · ELO base</p>
            <ul className="fly-leaf__top">
              {top3.slice(0, 3).map((p, i) => (
                <li className="fly-leaf__fighter" key={p.slug}>
                  <span className="fly-leaf__rank">{i + 1}.</span>
                  <span className="fly-leaf__portrait" aria-hidden="true">
                    <PersonajeCutImg
                      slug={p.slug}
                      alt=""
                      className="h-full w-full"
                      imgClassName="object-cover object-top"
                    />
                  </span>
                  <span className="fly-leaf__fighter-name">{p.nombre}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <AppLink
          to={hrefUniverso(slug)}
          className="fly-leaf__cta"
          onClick={() => onWhoosh?.()}
          onViewTransitionStart={() => onEnter?.(slug)}
        >
          Entrar al universo
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </AppLink>
      </div>
    </section>
    </Fragment>
  )
}
