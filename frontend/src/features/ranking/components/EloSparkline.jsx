function EloSparkline({ points, className = '' }) {
  const values = Array.isArray(points)
    ? points.map((p) => Number(p.votosAcumulados ?? p.elo ?? 0))
    : []
  if (values.length < 2) {
    return (
      <svg
        viewBox="0 0 60 20"
        role="img"
        aria-label="Sin tendencia suficiente"
        className={`h-5 w-[60px] text-fg-muted/50 ${className}`}
      >
        <line x1="2" y1="10" x2="58" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const step = 56 / (values.length - 1)
  const polyline = values
    .map((value, index) => {
      const x = 2 + index * step
      const y = 18 - ((value - min) / range) * 16
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const trend = values[values.length - 1] - values[0]
  const color =
    trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-fg-muted'
  const label =
    trend > 0
      ? `Tendencia positiva de ${trend} votos`
      : trend < 0
        ? `Tendencia negativa de ${Math.abs(trend)} votos`
        : 'Tendencia plana'
  return (
    <svg
      viewBox="0 0 60 20"
      role="img"
      aria-label={label}
      className={`h-5 w-[60px] ${color} ${className}`}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default EloSparkline
