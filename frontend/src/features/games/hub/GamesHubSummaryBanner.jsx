import { Link } from 'react-router-dom'
import { Share2 } from 'lucide-react'

function GamesHubSummaryBanner({ completadosHoy, totalDaily, onShare }) {
  if (completadosHoy <= 0) return null

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-fg-strong">
          Hoy completaste {completadosHoy}/{totalDaily} daily trials.
        </p>
        <p className="text-[12px] text-fg-muted">
          Guarda el ritual: comparte el resumen o salta a votar para cerrar la misión.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[13px] font-black text-emerald-100 transition-colors hover:bg-emerald-500/25"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir resumen
        </button>
        <Link
          to="/votar"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-bold text-fg-strong transition-colors hover:border-accent hover:text-gold"
        >
          Votar duelos
        </Link>
      </div>
    </div>
  )
}

export default GamesHubSummaryBanner
