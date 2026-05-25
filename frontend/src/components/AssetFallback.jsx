import { useEffect, useRef } from 'react'
import { trackAssetFallback } from '../lib/asset-tracking'

const GLYPHS = {
  character: (
    <>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  anime: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m8 3 2 3" />
      <path d="m16 3-2 3" />
      <path d="M8 12h.01" />
      <path d="M16 12h.01" />
    </>
  ),
  tournament: (
    <>
      <path d="M8 5h8v3a4 4 0 0 1-8 0V5Z" />
      <path d="M12 12v4" />
      <path d="M8 21h8" />
      <path d="M10 16h4" />
      <path d="M5 7H3a4 4 0 0 0 4 4" />
      <path d="M19 7h2a4 4 0 0 1-4 4" />
    </>
  ),
}

function readableInitial(value) {
  return String(value || '?')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, 1)
    .toUpperCase()
}

function AssetFallback({
  slug,
  anime,
  dominantColor = 'var(--color-accent)',
  kind = 'character',
  className = '',
  label,
  style,
}) {
  const trackedRef = useRef(false)
  const glyph = GLYPHS[kind] ?? GLYPHS.character
  const initial = readableInitial(label ?? slug ?? anime)
  const fallbackStyle = style
    ? { '--asset-dominant': dominantColor, ...style }
    : { '--asset-dominant': dominantColor }

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true
    trackAssetFallback(kind)
  }, [kind])

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--asset-dominant,theme(colors.aurora))] to-transparent text-fg-strong ${className}`}
      style={fallbackStyle}
      role="img"
      aria-label={label ?? slug ?? anime ?? 'Arte no disponible'}
    >
      <div className="absolute inset-0 bg-surface/30" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-bg/30 text-gold backdrop-blur">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            {glyph}
          </svg>
        </span>
        <span className="font-mono text-2xl font-black text-fg-strong">
          {initial}
        </span>
        {anime && (
          <span className="max-w-32 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
            {anime}
          </span>
        )}
      </div>
    </div>
  )
}

export default AssetFallback
