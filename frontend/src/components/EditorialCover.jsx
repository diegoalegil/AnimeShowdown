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
        className={`absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/cover:scale-[1.035] ${imageClassName}`}
        style={{
          backgroundImage: `url("${image}")`,
          backgroundPosition: objectPosition,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, rgb(5 8 14 / 0.94), rgb(5 8 14 / 0.58) 46%, rgb(5 8 14 / 0.22) 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-90"
        aria-hidden="true"
        style={{
          background:
            `radial-gradient(circle at 18% 20%, rgb(var(--cover-accent) / 0.30), transparent 23rem), ` +
            `radial-gradient(circle at 82% 16%, rgb(var(--cover-glow) / 0.18), transparent 22rem), ` +
            'linear-gradient(180deg, transparent 0%, rgb(5 8 14 / 0.74) 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.18]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.16) 1px, transparent 0)',
          backgroundSize: '34px 34px',
          maskImage: 'linear-gradient(to bottom, black, transparent 78%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-7 select-none font-mono text-[7rem] font-black leading-none opacity-[0.085] sm:text-[10rem]"
        style={{
          color: `rgb(${glowRgb} / 1)`,
          textShadow: `0 0 70px rgb(${accentRgb} / 0.45)`,
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
