function EditorialCover({
  visual,
  title,
  eyebrow,
  meta,
  children,
  className = '',
  contentClassName = '',
  imageClassName = '',
  compact = false,
}) {
  const cover = visual ?? {}
  const image = cover.image || cover.fallbackImage || '/img/stage/home-pulse.webp'
  const accentRgb = cover.accentRgb ?? '159 29 44'
  const glowRgb = cover.glowRgb ?? '197 161 90'
  const kanji = cover.kanji ?? '戦'
  const objectPosition = cover.objectPosition ?? 'center'

  return (
    <div
      data-editorial-cover="true"
      data-visual-type={cover.type}
      data-visual-slug={cover.slug}
      className={`group/cover relative isolate overflow-hidden rounded-xl border border-white/10 bg-bg ${className}`}
      style={{
        '--cover-accent': accentRgb,
        '--cover-glow': glowRgb,
      }}
    >
      <div
        className={`absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/cover:scale-[1.04] ${imageClassName}`}
        style={{
          backgroundImage: `url("${image}")`,
          backgroundPosition: objectPosition,
        }}
        aria-hidden="true"
      />
      {/* Audit visual (2026-05-20): el overlay anterior aplicaba un gradient
          horizontal 94%->22% sobre la imagen completa Y encima un tinte
          accent radial al 30%. Resultado: Naruto se veia amarillo opaco,
          One Piece quedaba apagado, y la silueta de los personajes
          desaparecia detras de capas oscuras. Nuevo enfoque: vignette
          SOLO en el bottom (donde va el texto) + glow accent muy sutil
          en esquinas para identidad sin tintar la imagen. La imagen real
          ahora ocupa el 60% superior visible. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, transparent 38%, rgb(5 8 14 / 0.55) 70%, rgb(5 8 14 / 0.92) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            `radial-gradient(circle at 8% 100%, rgb(var(--cover-accent) / 0.22), transparent 18rem), ` +
            `radial-gradient(circle at 92% 0%, rgb(var(--cover-glow) / 0.10), transparent 14rem)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.09]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.14) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, black, transparent 50%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 select-none font-mono text-[6rem] font-black leading-none opacity-[0.055] sm:text-[8.5rem] sm:opacity-[0.06]"
        style={{
          color: `rgb(${glowRgb} / 1)`,
          textShadow: `0 0 60px rgb(${accentRgb} / 0.35)`,
        }}
      >
        {kanji}
      </span>
      <div
        className={`relative flex h-full flex-col justify-end ${
          compact ? 'p-4' : 'p-5 sm:p-6'
        } ${contentClassName}`}
      >
        {eyebrow && (
          <p
            className="mb-2 w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
            style={{
              borderColor: `rgb(${accentRgb} / 0.46)`,
              background: `rgb(${accentRgb} / 0.16)`,
              color: `rgb(${glowRgb} / 1)`,
            }}
          >
            {eyebrow}
          </p>
        )}
        {title && (
          <h3 className="line-clamp-2 text-xl font-black leading-tight text-fg-strong drop-shadow sm:text-2xl">
            {title}
          </h3>
        )}
        {meta && <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">{meta}</p>}
        {children}
      </div>
    </div>
  )
}

export default EditorialCover
