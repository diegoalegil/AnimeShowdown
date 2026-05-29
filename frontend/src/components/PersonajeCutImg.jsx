import { useState } from 'react'
import { cutUrl, hasCut } from '../lib/cuts'
import PersonajeImg from './PersonajeImg'

function PersonajeCutImg({
  slug,
  alt,
  fallback,
  className = '',
  imgClassName = '',
  loading,
  decoding,
  onLoad,
  onError,
  ...imgProps
}) {
  const [failedSrc, setFailedSrc] = useState(null)
  const availableCutSrc = hasCut(slug) ? cutUrl(slug) : null
  const canUseCut = Boolean(availableCutSrc) && failedSrc !== availableCutSrc
  const cutSrc = canUseCut ? availableCutSrc : null
  // NO emitimos srcset -300/-600/-1024 para los recortes: esas variantes son
  // copias idénticas del archivo base de baja resolución (225x350), así que el
  // srcset hacía creer al navegador que existían tamaños mayores y elegía una
  // "1024w" que en realidad es la misma imagen pequeña. Servimos el único
  // archivo real. La resolución se arregla regenerando el recorte (upscale IA,
  // ver scripts/regen-cuts.mjs), no con un srcset falso.

  if (!canUseCut) {
    if (!slug && fallback) {
      return (
        <img
          src={fallback}
          alt={alt}
          loading={loading ?? 'lazy'}
          decoding={decoding ?? 'async'}
          className={className}
          {...imgProps}
          onLoad={onLoad}
          onError={onError}
        />
      )
    }
    return (
      <PersonajeImg
        slug={slug}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={className}
        {...imgProps}
        onLoad={onLoad}
        onError={onError}
      />
    )
  }

  return (
    <div
      className={`relative overflow-hidden bg-bg ${className}`.trim()}
      style={{
        background:
          'radial-gradient(circle at 50% 28%, rgb(159 29 44 / 0.30), rgb(197 161 90 / 0.14) 34%, rgb(8 11 18 / 0.94) 70%)',
      }}
    >
      <div
        className="absolute inset-x-4 bottom-1 h-1/3 rounded-full bg-accent/25 blur-2xl"
        aria-hidden="true"
      />
      <img
        src={cutSrc}
        alt={alt}
        loading={loading ?? 'lazy'}
        decoding={decoding ?? 'async'}
        className={`relative z-10 h-full w-full object-contain object-bottom drop-shadow-figure ${imgClassName}`.trim()}
        {...imgProps}
        onLoad={onLoad}
        onError={(event) => {
          setFailedSrc(cutSrc)
          onError?.(event)
        }}
      />
    </div>
  )
}

export default PersonajeCutImg
