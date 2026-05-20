import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * Badge de debug visual — se activa con `?debug=visual` en cualquier URL.
 *
 * Pinta una etiqueta flotante sobre cada componente que pase un `visual`
 * a VisualPageShell o EditorialCover, mostrando:
 *   - slug del visual (e.g. 'cowboy-bebop', 'home-pulse')
 *   - type (anime / tournament / event / brand / game)
 *   - objectPosition (center, top, etc.)
 *   - path real que se esta cargando
 *
 * Click → copia el slug al clipboard para reportarlo rapidamente
 * ("oye, este slug X esta mal recortado").
 *
 * En produccion sin `?debug=visual` no renderiza nada — coste cero.
 */
export default function VisualDebugBadge({ visual, where, className = '' }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const checkActive = () => {
      const qs = new URLSearchParams(window.location.search)
      const onByQuery = qs.get('debug') === 'visual'
      const onByStorage =
        typeof window.localStorage !== 'undefined' &&
        window.localStorage.getItem('debug') === 'visual'
      setActive(onByQuery || onByStorage)
    }
    checkActive()
    window.addEventListener('popstate', checkActive)
    return () => window.removeEventListener('popstate', checkActive)
  }, [])

  if (!active || !visual) return null

  const slug = visual.slug ?? '<no-slug>'
  const type = visual.type ?? '<no-type>'
  const objectPosition = visual.objectPosition ?? 'center'
  const path = visual.image || visual.expectedPath || visual.fallbackImage || '<no-path>'
  const fromFallback = !visual.image && visual.fallbackImage

  const handleClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const info = `slug=${slug}\ntype=${type}\nobjectPosition=${objectPosition}\npath=${path}${where ? `\nwhere=${where}` : ''}`
    try {
      navigator.clipboard?.writeText(info)
      toast.success(`Copiado: ${slug}`, { duration: 1500 })
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`pointer-events-auto absolute left-2 top-2 z-[60] flex flex-col items-start gap-0.5 rounded-md border border-amber-400/60 bg-amber-950/95 px-2 py-1.5 text-left font-mono text-[10px] text-amber-100 shadow-lg backdrop-blur-sm hover:bg-amber-900/95 ${className}`}
      title="Click para copiar info del visual"
      aria-label={`Debug visual ${slug}`}
    >
      <span className="font-bold text-amber-200">
        {slug}
        {fromFallback && <span className="ml-1 text-rose-300">(fallback)</span>}
      </span>
      <span className="opacity-80">{type} · {objectPosition}</span>
      <span className="max-w-[260px] truncate opacity-60" title={path}>
        {path}
      </span>
      {where && <span className="opacity-50">@ {where}</span>}
    </button>
  )
}
