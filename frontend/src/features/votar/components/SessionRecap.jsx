import { Link } from 'react-router-dom'
import { Share2 } from 'lucide-react'

function SessionRecap({ stats, onShare }) {
  const top = Object.values(stats.bySlug || {})
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <section className="rounded-xl border border-gold/35 bg-gold-soft p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
            Recap de sesión
          </p>
          <h2 className="mt-1 text-xl font-black text-fg-strong">
            {stats.total} votos lanzados. El ranking ya notó tu mano.
          </h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            {stats.closeDuels > 0
              ? `${stats.closeDuels} duelos quedaron ajustados por 1 voto o menos.`
              : 'Sigue votando para encontrar duelos más polémicos.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/mi-ranking"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-bg/60 px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
          >
            Ver mi ranking
          </Link>
          <Link
            to="/mi-top5"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent-soft px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-accent hover:text-gold"
          >
            Crear mi Top 5
          </Link>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold/45 bg-gold px-4 py-2 text-[13px] font-black text-bg transition-transform hover:scale-[1.01]"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartir recap
          </button>
        </div>
      </div>
      {top.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {top.map((item) => (
            <span
              key={item.nombre}
              className="inline-flex rounded-full border border-border bg-bg/60 px-3 py-1 text-[12px] font-semibold text-fg-muted"
            >
              {item.nombre} · x{item.count}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

export default SessionRecap
