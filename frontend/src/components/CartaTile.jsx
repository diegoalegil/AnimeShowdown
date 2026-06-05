import { Download, Lock } from 'lucide-react'
import CartaFace from '../features/cartas/CartaFace'
import PersonajeImg from './PersonajeImg'

/**
 * Una carta en el grid de la colección. Reutiliza el lenguaje visual de la
 * carta SSR existente (`.as-ssr-card`, que ya pinta la etiqueta "SSR" dorada
 * vía ::before) y muestra el arte + universo del personaje (regla #7: nada
 * genérico).
 *
 * - Poseída: carta a todo color con su arte, anime y, si hay duplicados, ×N.
 * - Sin descubrir: teaser difuminado del personaje (imagen real con blur +
 *   opacidad baja) con candado — genera deseo sin revelar el arte especial
 *   finito (usa la imagen del personaje, no el arteUrl). `loading="lazy"`
 *   acota el coste: solo cargan las cartas que entran en viewport.
 */
function CartaTile({ carta, eager = false, onDownload, downloading = false }) {
  const { poseida, personajeNombre } = carta
  const puedeDescargar = poseida && typeof onDownload === 'function'

  if (!poseida) {
    return (
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-surface/40">
        <PersonajeImg
          slug={carta.personajeSlug}
          nombre={personajeNombre}
          colorDominante={carta.colorDominante}
          alt=""
          aria-hidden="true"
          fit="cover"
          position="center"
          loading="lazy"
          sizes="(min-width: 1024px) 200px, 40vw"
          className="h-full w-full scale-110 opacity-40 blur-md saturate-50"
        />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Lock className="h-7 w-7 text-fg-strong/55" aria-hidden="true" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2.5 pt-8">
          <p className="line-clamp-1 text-[11px] font-medium text-fg-muted/70">Sin descubrir</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <CartaFace carta={carta} eager={eager} />
      {puedeDescargar && (
        <button
          type="button"
          onClick={() => onDownload(carta)}
          disabled={downloading}
          aria-label={`Descargar carta de ${personajeNombre}`}
          title="Descargar"
          className="absolute left-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-fg-strong backdrop-blur-sm transition-colors hover:border-gold/55 hover:text-gold disabled:cursor-wait disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default CartaTile
