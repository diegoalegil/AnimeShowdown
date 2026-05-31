import { Download } from 'lucide-react'
import CartaFace from '../features/cartas/CartaFace'

/**
 * Una carta en el grid de la colección. Reutiliza el lenguaje visual de la
 * carta SSR existente (`.as-ssr-card`, que ya pinta la etiqueta "SSR" dorada
 * vía ::before) y muestra el arte + universo del personaje (regla #7: nada
 * genérico).
 *
 * - Poseída: carta a todo color con su arte, anime y, si hay duplicados, ×N.
 * - Sin descubrir: silueta atenuada con "?" — incentiva coleccionar y evita
 *   cargar cientos de imágenes que el usuario aún no tiene.
 */
function CartaTile({ carta, eager = false, onDownload, downloading = false }) {
  const { poseida, personajeNombre } = carta
  const puedeDescargar = poseida && typeof onDownload === 'function'

  if (!poseida) {
    return (
      <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-surface/40">
        <span className="text-4xl font-black text-fg-muted/30" aria-hidden="true">
          ?
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8">
          <p className="line-clamp-1 text-[11px] text-fg-muted/60">Sin descubrir</p>
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
          className="absolute left-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-fg-strong backdrop-blur-sm transition-colors hover:border-gold/55 hover:text-gold disabled:cursor-wait disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default CartaTile
