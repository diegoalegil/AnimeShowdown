import { Link } from 'react-router-dom'
import { Sparkles, Trophy } from 'lucide-react'

function RankingImportPanel({ totalVotes, topNames, canImport, onImport }) {
  return (
    <section className="mb-5 rounded-xl border border-gold/30 bg-gradient-to-br from-gold/[0.12] via-surface to-accent/[0.08] p-4 sm:mb-8 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
            <Trophy className="h-3.5 w-3.5" />
            Desde tu ranking
          </p>
          <h2 className="mt-1 text-lg font-black text-fg-strong">
            {canImport ? 'Convierte tus votos en una imagen' : 'Tu Top 5 puede salir de tus votos'}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-fg-muted">
            {canImport
              ? `${totalVotes} voto${totalVotes === 1 ? '' : 's'} local${totalVotes === 1 ? '' : 'es'} detectado${totalVotes === 1 ? '' : 's'}. ${
                  topNames.length > 0
                    ? `Empieza con ${topNames.join(', ')}.`
                    : 'Rellena los primeros puestos con tus personajes más votados.'
                }`
              : 'Vota unos cuantos duelos y este generador podrá rellenarse con tu ranking personal.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onImport}
            disabled={!canImport}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-4 py-2 text-sm font-black text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Usar mi ranking
          </button>
          <Link
            to={canImport ? '/mi-ranking' : '/votar'}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg/50 px-4 py-2 text-sm font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
          >
            {canImport ? 'Ver ranking' : 'Votar primero'}
          </Link>
        </div>
      </div>
    </section>
  )
}

export default RankingImportPanel
