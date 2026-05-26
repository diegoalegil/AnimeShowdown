import { useMemo, useState } from 'react'
import { useImagenesPersonaje } from '../hooks/useImagenesPersonaje'

/**
 * Strip horizontal de thumbnails con la imagen principal del catálogo
 * + las imágenes oficiales adicionales que devuelve Jikan
 * (/characters/{mal_id}/pictures). Click en una thumbnail la sube como
 * imagen activa de la ficha vía onSelect.
 *
 * <p>12 step 1 — primer eslabón del stack de visualización
 * enriquecida del personaje (multi-imagen → recorte+parallax → aura
 * shader → Live Portrait top tier).
 *
 * <p>No renderiza nada si:
 *   - Jikan no devuelve extras (catálogo ya pinta la principal grande).
 *   - el hook está loading o ha errorizado.
 *
 * <p>Props:
 *   - slug: para llamar al endpoint
 *   - principalUrl: URL del catálogo (siempre primera del strip, label "Principal")
 *   - imagenActiva: URL actualmente mostrada arriba (para resaltar thumbnail)
 *   - onSelect: callback al hacer click en una thumbnail
 */
function PersonajeGaleria({ slug, principalUrl, imagenActiva, onSelect }) {
  const { data: extras, isLoading } = useImagenesPersonaje(slug)
  const [urlsFallidas, setUrlsFallidas] = useState(() => new Set())

  const items = useMemo(() => {
    const arr = [{ url: principalUrl, label: 'Principal', esPrincipal: true }]
    const extrasUrls = Array.isArray(extras) ? extras : []
    extrasUrls
      .filter((u) => u && u !== principalUrl)
      .forEach((u, i) => arr.push({ url: u, label: `Vista ${i + 2}` }))
    return arr
  }, [principalUrl, extras])

  const itemsVisibles = useMemo(
    () => items.filter((item) => item.esPrincipal || !urlsFallidas.has(item.url)),
    [items, urlsFallidas],
  )

  if (isLoading) return null
  if (itemsVisibles.length <= 1) return null

  return (
    <details
      aria-label="Galería de imágenes del personaje"
      className="mt-5 rounded-xl border border-white/10 bg-surface/70 p-3 backdrop-blur-sm"
    >
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 marker:hidden">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Galería · {itemsVisibles.length} imágenes
        </h3>
        <span className="text-[10px] text-fg-muted">
          Fuente: MyAnimeList vía Jikan
        </span>
      </summary>
      <div
        className="scroll-x-affordance scroll-x-fade mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] [scroll-snap-type:x_mandatory]"
        style={{ scrollPaddingLeft: '8px' }}
      >
        {itemsVisibles.map((item) => {
          const activa = item.url === imagenActiva
          return (
            <button
              key={item.url}
              type="button"
              onClick={() => onSelect?.(item.url)}
              aria-label={`Ver ${item.label}`}
              aria-pressed={activa}
              className={`relative shrink-0 overflow-hidden rounded-lg border-2 transition-all [scroll-snap-align:start] ${
                activa
                  ? 'border-accent shadow-[0_0_0_3px_rgb(255_46_99_/_0.18)]'
                  : 'border-border hover:border-fg-muted'
              }`}
              style={{ width: '64px', height: '96px' }}
            >
              <img
                src={item.url}
                alt={item.label}
                width={64}
                height={96}
                loading="lazy"
                // Defensa extra para imagenes externas de MyAnimeList. Las URLs
                // se normalizan en backend al CDN permitido por CSP; no-referrer
                // evita que hotlink protections puntuales rompan la galeria.
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Si una extra falla, la retiramos del strip para que no se
                  // pueda seleccionar y dejar el hero apuntando a una URL rota.
                  e.currentTarget.style.opacity = '0'
                  if (!item.esPrincipal) {
                    setUrlsFallidas((prev) => {
                      if (prev.has(item.url)) return prev
                      const next = new Set(prev)
                      next.add(item.url)
                      return next
                    })
                  }
                }}
              />
            </button>
          )
        })}
      </div>
    </details>
  )
}

export default PersonajeGaleria
