import PersonajeImg from './PersonajeImg'
import { ocultaImgRota } from '../lib/imgFallback'

function CharacterStrip({
  personajes = [],
  total = personajes.length,
  max = 5,
  className = '',
  imageClassName = '',
}) {
  const visibles = personajes.slice(0, max)
  const extra = Math.max(0, total - visibles.length)

  return (
    <div className={`as-image-strip h-36 rounded-lg ${className}`}>
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: `repeat(${Math.max(visibles.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {visibles.map((p, i) =>
          p.imagenUrl ? (
            <img
              key={`${p.slug}-${i}`}
              src={p.imagenUrl}
              alt=""
              loading="lazy"
              onError={ocultaImgRota}
              className={`h-full w-full object-cover object-top ${imageClassName}`}
            />
          ) : (
            <PersonajeImg
              key={`${p.slug}-${i}`}
              slug={p.slug}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover object-top ${imageClassName}`}
            />
          ),
        )}
        {visibles.length === 0 && (
          <div className="h-full w-full bg-surface-alt" aria-hidden="true" />
        )}
      </div>
      {extra > 0 && (
        <span className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 font-mono text-xs font-extrabold text-white shadow-lg backdrop-blur-md">
          +{extra}
        </span>
      )}
    </div>
  )
}

export default CharacterStrip
