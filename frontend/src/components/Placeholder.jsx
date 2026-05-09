function Placeholder({ titulo, descripcion, eyebrow = 'Próximamente' }) {
  return (
    <section className="flex flex-1 items-center justify-center px-5 py-20 sm:px-8 sm:py-24">
      <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
          {eyebrow}
        </span>
        <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
          {titulo}
        </h1>
        <p className="text-base leading-relaxed text-fg-muted">
          {descripcion}
        </p>
      </div>
    </section>
  )
}

export default Placeholder
