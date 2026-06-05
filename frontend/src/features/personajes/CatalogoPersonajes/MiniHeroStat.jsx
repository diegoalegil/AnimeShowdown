function MiniHeroStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <p className="text-[10px] font-black text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-black text-gold tabular-nums">
        {Number(value).toLocaleString('es-ES')}
      </p>
    </div>
  )
}

export default MiniHeroStat
