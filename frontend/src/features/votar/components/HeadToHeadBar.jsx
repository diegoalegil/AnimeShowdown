/**
 * Barra split cabeza-a-cabeza con porcentajes: resalta mayoría (ganador)
 * y minoría (perdedor). Se muestra solo cuando el backend devuelve ambos
 * totales de votos.
 */
function HeadToHeadBar({ ganadorNombre, perdedorNombre, votosGanador, votosPerdedor }) {
  const total = votosGanador + votosPerdedor
  if (total <= 0) return null
  const pctGanador = Math.round((votosGanador / total) * 100)
  const pctPerdedor = 100 - pctGanador
  const esCercano = pctGanador < 60 // consideramos "polémico" si el ganador tiene < 60%
  return (
    <div className="mt-2 w-full">
      <div className="mb-1 flex justify-between text-[11px] font-black">
        <span className="text-fg-strong">{ganadorNombre}</span>
        <span className="text-fg-muted">{perdedorNombre}</span>
      </div>
      <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-l-full bg-accent transition-all duration-500"
          style={{ width: `${pctGanador}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold">
        <span className="text-danger">{pctGanador}%</span>
        {esCercano && (
          <span className="text-center text-[10px] font-bold text-fg-muted">
            ¡Duelo reñido!
          </span>
        )}
        <span className="text-fg-muted">{pctPerdedor}%</span>
      </div>
    </div>
  )
}

export default HeadToHeadBar
