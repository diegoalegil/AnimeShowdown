import { useLayoutEffect, useRef } from 'react'
import { mountSceneCard, mountSceneHero } from '../lib/animeSceneMorph'

/**
 * Wrapper del lienzo visual compartido del morph scene → hero. Envuelve SOLO
 * las capas que deben viajar en el snapshot (imagen + scrim, y en el hero el
 * kanji): texto, badges y medallón quedan fuera para que el cross-fade sea
 * limpio. No posee position propia: la decide el caller vía className (las
 * capas hijas son absolute y se anclan a este nodo).
 *
 * kind="card" · cover del catálogo. Origen de la ida; destino de la vuelta
 *               si tras el scroll-reset sigue lo bastante visible.
 * kind="hero" · scene del detalle. Adopta el nombre de forma estable:
 *               destino de la ida y origen de la vuelta.
 */
function AnimeSceneMorph({ slug, kind, className, children }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    return kind === 'hero' ? mountSceneHero(el, slug) : mountSceneCard(el, slug)
  }, [slug, kind])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export default AnimeSceneMorph
