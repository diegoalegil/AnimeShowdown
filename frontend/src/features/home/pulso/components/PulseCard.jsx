function PulseCard({ tono = 'accent', children, ...rest }) {
  const tonos = {
    accent: {
      border: 'border-accent/34 hover:border-accent/70',
      glow: 'rgb(159 29 44 / 0.24)',
    },
    emerald: {
      border: 'border-success/34 hover:border-success/70',
      glow: 'rgb(16 185 129 / 0.22)',
    },
    amber: {
      border: 'border-gold/34 hover:border-gold/70',
      glow: 'rgb(245 158 11 / 0.24)',
    },
    cyan: {
      border: 'border-electric/34 hover:border-electric/70',
      glow: 'rgb(6 182 212 / 0.22)',
    },
    rose: {
      border: 'border-danger/34 hover:border-danger/70',
      glow: 'rgb(244 63 94 / 0.23)',
    },
    violet: {
      border: 'border-rarity-epic/34 hover:border-rarity-epic/70',
      glow: 'rgb(139 92 246 / 0.23)',
    },
  }
  const tone = tonos[tono] ?? tonos.accent

  return (
    <div
      className={`as-card-lift group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-surface/88 p-4 backdrop-blur-md sm:p-5 ${tone.border}`}
      style={{
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.055), 0 24px 80px -54px ${tone.glow}`,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at 88% 0%, ${tone.glow}, transparent 13rem), linear-gradient(180deg, rgb(255 255 255 / 0.035), transparent 42%)`,
        }}
      />
      {/* Las pulse-cards ya tienen identidad con tone + glow + backdrop-blur;
          no necesitan glyph japonés decorativo encima. */}
      {children}
    </div>
  )
}

export default PulseCard
