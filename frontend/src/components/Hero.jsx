function Hero() {
  return (
    <section
      className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% 0%, var(--color-accent-soft), transparent 60%)',
      }}
    >
      <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
        <img
          src="/logo.webp"
          alt=""
          width={240}
          height={240}
          className="h-44 w-44 object-contain sm:h-56 sm:w-56"
          style={{ filter: 'drop-shadow(0 0 50px rgb(255 46 99 / 0.4))' }}
        />
        <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
          Beta · 96 personajes
        </span>
        <h1 className="text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] tracking-tight">
          Vota a tus personajes de <span className="text-accent">anime</span> favoritos
        </h1>
        <p className="max-w-xl text-[clamp(0.9375rem,1.6vw,1.125rem)] leading-relaxed text-fg-muted">
          Torneos cara a cara, brackets visuales y rankings ELO en vivo. Quédate con el campeón del próximo bracket.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <a
            href="#"
            className="inline-flex items-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            Explora torneos
          </a>
          <a
            href="#"
            className="inline-flex items-center rounded-lg border border-border bg-transparent px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
          >
            Ver ranking
          </a>
        </div>
      </div>
    </section>
  )
}

export default Hero
