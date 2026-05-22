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
  ...imgProps
}) {
  const [failed, setFailed] = useState(false)
  const canUseCut = hasCut(slug) && !failed
  const cutSrc = canUseCut ? cutUrl(slug) : null
  const cutBase = cutSrc?.replace(/\.webp$/i, '')
  const cutSrcSetWebp = cutBase
    ? `${cutBase}-300.webp 300w, ${cutBase}-600.webp 600w, ${cutBase}-1024.webp 1024w`
    : undefined
  const sizesAttr = imgProps.sizes ?? '(min-width: 1024px) 360px, (min-width: 640px) 280px, 220px'

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
      <picture className="contents">
        <source type="image/webp" srcSet={cutSrcSetWebp} sizes={sizesAttr} />
        <img
          src={cutSrc}
          alt={alt}
          loading={loading ?? 'lazy'}
          decoding={decoding ?? 'async'}
          className={`relative z-10 h-full w-full object-contain object-bottom drop-shadow-[0_18px_22px_rgb(0_0_0_/_0.55)] ${imgClassName}`.trim()}
          onError={() => setFailed(true)}
          {...imgProps}
        />
      </picture>
    </div>
  )
}

export default PersonajeCutImg
