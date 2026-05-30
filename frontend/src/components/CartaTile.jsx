import PersonajeImg from './PersonajeImg'

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
function CartaTile({ carta, eager = false }) {
  const {
    personajeSlug,
    personajeNombre,
    anime,
    colorDominante,
    rareza,
    poseida,
    cantidad,
  } = carta

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

  const esEspecial = rareza === 'ESPECIAL'

  return (
    <article className="as-ssr-card relative overflow-hidden rounded-2xl [--aura-color:rgb(197_161_90_/_0.55)]">
      <PersonajeImg
        slug={personajeSlug}
        alt={personajeNombre}
        nombre={personajeNombre}
        colorDominante={colorDominante}
        loading={eager ? 'eager' : 'lazy'}
        className="aspect-[2/3] w-full object-cover"
      />
      {esEspecial && (
        <span className="absolute right-2 top-2 inline-flex items-center rounded-md border border-rarity-legendary/50 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wide text-rarity-legendary backdrop-blur-sm">
          Especial
        </span>
      )}
      {cantidad > 1 && (
        <span
          className="absolute bottom-[3.6rem] right-2 inline-flex items-center rounded-md border border-gold/45 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-gold backdrop-blur-sm"
          title={`Tienes ${cantidad} copias`}
        >
          ×{cantidad}
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3.5 pt-10">
        <h3 className="line-clamp-1 text-sm font-bold text-fg-strong">{personajeNombre}</h3>
        <p className="line-clamp-1 text-[12px] text-fg-muted">{anime}</p>
      </div>
    </article>
  )
}

export default CartaTile
