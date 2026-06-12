import { memo, useRef } from 'react'
import { useSound } from '../../../contexts/SoundContext'
import { AppLink } from '../../../components/AppLink'
import PersonajeImg from '../../../components/PersonajeImg'
import { getStatsPersonaje } from '../../../lib/personajes-core'
import { markPersonajeHero } from '../../../lib/viewTransitions'
import './catalogo-archivo.css'

/**
 * Ficha de archivador del catálogo /personajes — evolución de
 * PersonajeCard con pestaña de archivador (slug en mono sobre hairline)
 * y coreografía de primer paint.
 *
 * <p><b>Contrato anti-re-animación (LEY)</b>: la entrada en stagger solo
 * ocurre cuando {@code entradaIndex != null}. La página asigna índices
 * (0..23) ÚNICAMENTE en el primer paint del catálogo; la paginación y
 * cualquier re-render posterior pasan {@code null} → la ficha pinta
 * directo, sin animación.
 *
 * <p>La pestaña está SIEMPRE en el layout (alto fijo 22px) → CLS 0.
 * El lift de hover es transform-only; la sombra de contacto es una capa
 * pre-horneada ({@code .cat-ficha__sombra}) que solo cruza opacity —
 * box-shadow no se anima jamás (regla de la casa).
 *
 * @param {object} props
 * @param {string} props.slug                Slug canónico del personaje (se muestra en la pestaña).
 * @param {string} props.nombre              Nombre visible.
 * @param {string} props.anime               Universo de origen.
 * @param {number} [props.rank]              Posición por ELO base; badge #N solo si <= 10.
 * @param {number} [props.elo]               ELO base estimado; si falta, cae a getStatsPersonaje (sufijo "·b" obligatorio).
 * @param {string} [props.imagen]            Path de imagen (variantes -300/-600 vía PersonajeImg).
 * @param {string} [props.imagenUrl]         URL de imagen ya normalizada (prioritaria sobre imagen).
 * @param {string} [props.imagenColorDominante] Color de placeholder mientras carga el arte.
 * @param {?number} [props.entradaIndex=null] Índice de stagger del PRIMER paint (0..23) o null
 *                                            (paint directo) — responsabilidad de la página.
 */
function CatalogCard({
  slug,
  nombre,
  anime,
  rank,
  elo: eloProp,
  imagen,
  imagenUrl,
  imagenColorDominante,
  entradaIndex = null,
}) {
  const { play } = useSound()
  const cardRef = useRef(null)

  // Solo ELO base (estimado por popularidad) — los W/L sintéticos se
  // ocultan (misma decisión que PersonajeCard).
  const elo = eloProp ?? getStatsPersonaje(slug).elo
  const eagerImage = Boolean(rank && rank <= 12)
  const imageLoading = eagerImage ? 'eager' : 'lazy'
  const imageFetchPriority = rank && rank <= 6 ? 'high' : 'auto'
  const imageSrc = imagenUrl ?? imagen
  const entra = entradaIndex != null

  return (
    <AppLink
      to={`/personajes/${slug}`}
      onClick={() => play('playWhoosh')}
      onViewTransitionStart={() => markPersonajeHero(cardRef.current)}
      className={`cat-ficha group block${entra ? ' cat-ficha-entrada' : ''}`}
      style={entra ? { '--entrada-i': entradaIndex } : undefined}
    >
      {/* Sombra de contacto pre-horneada: vive FUERA del nodo
          transformado para que el lift abra hueco real con el suelo. */}
      <span className="cat-ficha__sombra" aria-hidden="true"></span>
      <span className="cat-ficha__cuerpo block">
        {/* Pestaña de archivador — siempre en el layout (CLS 0). */}
        <span className="cat-ficha__tab">
          <span className="cat-ficha__lengueta">{slug}</span>
        </span>
        {/* contentVisibility: el navegador se salta layout/paint fuera de
            viewport y el alto intrínseco evita huecos blancos. El intrinsic
            sube 22px respecto a PersonajeCard: la pestaña. */}
        <article
          ref={cardRef}
          className="cat-ficha__arte as-ssr-card group-hover:border-gold/45 [--aura-color:var(--color-gold-aura)]"
          style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 322px' }}
        >
          <PersonajeImg
            slug={slug}
            src={imageSrc}
            alt={nombre}
            colorDominante={imagenColorDominante ?? 'var(--color-surface)'}
            loading={imageLoading}
            fetchPriority={imageFetchPriority}
            className="aspect-[2/3] w-full object-cover"
          />
          <CatalogCardBadges rank={rank} elo={elo} nombre={nombre} anime={anime} />
        </article>
      </span>
    </AppLink>
  )
}

function CatalogCardBadges({ rank, elo, nombre, anime }) {
  return (
    <>
      {rank && rank <= 10 && (
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md border border-medal-gold/50 bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-medal-gold"
          title="Posición en el ranking del catálogo por ELO base estimado. El ranking competitivo real se mueve con votos en /ranking."
        >
          #{rank}
        </span>
      )}
      <span
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-gold"
        title="ELO base estimado por popularidad. El ranking competitivo real está en /ranking."
        aria-label={`${elo} ELO base estimado`}
      >
        {elo}
        <span className="ml-0.5 text-[8px] font-bold text-gold">·b</span>
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3.5 pt-10">
        <h3 className="line-clamp-1 text-sm font-bold text-fg-strong">{nombre}</h3>
        <p className="line-clamp-1 text-[12px] text-fg-muted">{anime}</p>
      </div>
    </>
  )
}

// memo con props primitivas (+ entradaIndex, también primitiva): la
// comparación shallow corta el re-render cuando la página re-renderiza
// por filtros/orden — y cuando entradaIndex pasa de N a null tras el
// primer paint, el re-render es inocuo: la animación ya terminó y el
// estado final coincide con el estilo base.
export default memo(CatalogCard)
