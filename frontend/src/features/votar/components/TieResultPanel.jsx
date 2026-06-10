import { Scale } from 'lucide-react'
import { formatVoteScore } from '../vote-format'
import HeadToHeadBar from './HeadToHeadBar'

/**
 * Panel de resultado de EMPATE: región live para lectores de pantalla con
 * el reparto ½ + ½ y la barra cabeza-a-cabeza si el backend devolvió totales.
 */
function TieResultPanel({ a, b, voteResult }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-gold/30 bg-gold-soft px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1"
      >
        <p className="text-sm font-black text-fg-strong">
          No pudiste decidir entre {a.nombre} y {b.nombre}.
        </p>
        <p className="text-[12px] text-fg-muted">
          {voteResult?.votosGanador != null && voteResult?.votosPerdedor != null
            ? `Medio voto para cada lado · ${formatVoteScore(voteResult.votosGanador)} vs ${formatVoteScore(voteResult.votosPerdedor)}`
            : 'Empate neutral registrado. No mueve el ELO del duelo.'}
        </p>
        {voteResult?.votosGanador != null && voteResult?.votosPerdedor != null && (
          <HeadToHeadBar
            ganadorNombre={a.nombre}
            perdedorNombre={b.nombre}
            votosGanador={voteResult.votosGanador}
            votosPerdedor={voteResult.votosPerdedor}
          />
        )}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-bg/60 px-3 py-2 text-[12px] font-black text-gold">
        <Scale className="h-3.5 w-3.5" />
        ½ + ½
      </span>
    </div>
  )
}

export default TieResultPanel
