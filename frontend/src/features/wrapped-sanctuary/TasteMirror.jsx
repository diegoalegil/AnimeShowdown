// ============================================================================
// TasteMirror.jsx — escenografia de la Sala 05. Tu universo mas votado como
// escena A SANGRE (arte real de marca via brandImage) con scrim de
// legibilidad solo donde vive el texto, y tu % de sesgo en odometro mono.
// Sin blur: el scrim es opacidad plana. Imagen lazy por sala.
// ============================================================================

import { useRef } from 'react'
import { brandImage } from '../../lib/brand-assets'
import { slugifyAnime } from '../../lib/animes'
import { useCountUp } from './sanctuary-core'

/**
 * @typedef {object} TasteMirrorProps
 * @property {{anime:string, slug:string, pct:number}} universoTop universo dominante
 * @property {boolean} awake true cuando la sala desperto (dispara el odometro)
 * @property {boolean} [reduced] respeta prefers-reduced-motion (valor final ya)
 */

/**
 * Escena A SANGRE del espejo (aria-hidden). Va en el slot `scenery` de
 * SanctuaryRoom (absolute inset-0 de la <section>), por eso es full-bleed; si
 * fuera children quedaría recortada a la columna de texto.
 * @param {{ universoTop:{anime:string} }} props
 */
export function TasteMirrorScene({ universoTop }) {
  // brandImage indexa por slug de ANIME (no de personaje): resolvemos el slug
  // desde el nombre del anime, idéntico a como WrappedPage construye sceneUrl.
  const scene = universoTop?.anime ? brandImage(`${slugifyAnime(universoTop.anime)}-scene-01`) : null
  return (
    <div className="sanctuary-scene absolute inset-0" aria-hidden="true">
      {scene ? (
        <img
          src={scene.src}
          srcSet={scene.srcSet}
          sizes="100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-canvas" />
      )}
      {/* Scrim: oscurecimiento inferior para el texto (opacidad plana, sin blur). */}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-bg/80 to-transparent" />
    </div>
  )
}

/**
 * Espejo del gusto — contenido textual (el padre coloca {@link TasteMirrorScene}
 * como `scenery`).
 * @param {TasteMirrorProps} props
 */
function TasteMirror({ universoTop, awake, reduced = false }) {
  const pctRef = useRef(null)
  const pct = Number(universoTop?.pct ?? 0)
  useCountUp(pctRef, pct, awake, { durationMs: 1200, suffix: '%', reduced })

  return (
    <div className="relative z-[2] mx-auto w-full max-w-[760px] px-6 pb-16 text-left">
        <p className="sanctuary-rise m-0 text-[clamp(1rem,3.2vw,1.4rem)] text-fg" style={{ '--pd': '0.08s' }}>
          Un universo defendiste más que ningún otro
        </p>
        <p
          className="sanctuary-rise m-0 text-balance text-[clamp(2.2rem,8vw,4.4rem)] font-extrabold leading-none tracking-tight text-fg-strong"
          style={{ '--pd': '0.14s' }}
        >
          {universoTop?.anime}
        </p>
        <div className="mt-5 flex items-baseline gap-3">
          <span
            ref={pctRef}
            className="sanctuary-odo font-mono text-[clamp(2.4rem,9vw,4.6rem)] font-extrabold leading-none tabular-nums text-gold"
          >
            {pct}%
          </span>
          <span className="max-w-[22ch] text-[15px] text-fg-muted">
            de tus personajes favoritos salen de este universo
          </span>
        </div>
        <div className="mt-[18px] h-2 max-w-[420px] overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
          <div
            className="sanctuary-rise h-full rounded-full bg-gradient-to-r from-accent to-gold"
            style={{ '--pd': '0.3s', width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
        <span className="sr-only">{`${pct}% de tus personajes favoritos salen de ${universoTop?.anime}.`}</span>
    </div>
  )
}

export default TasteMirror
