import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

function RankingTechnicalTable({ rankedElo }) {
  const top10 = rankedElo.slice(0, 10)
  return (
    <details className="group mt-6 rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Datos técnicos
          </h2>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Tabla en formato estándar para copia rápida o referencia.
          </p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180 [details[open]_&]:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">
        <div
          className="scroll-x-affordance scroll-x-fade-mobile overflow-x-auto"
          aria-label="Tabla técnica del ranking ELO"
        >
          <table className="min-w-[36rem] border-collapse text-[13px] sm:w-full">
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Rank
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Personaje
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Anime
                </th>
                <th
                  scope="col"
                  className="py-2 pr-3 text-right font-mono font-semibold tabular-nums"
                >
                  ELO
                </th>
                <th
                  scope="col"
                  className="hidden py-2 pr-3 text-right font-semibold sm:table-cell"
                >
                  W/L
                </th>
              </tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr
                  key={p.slug}
                  className="border-b border-border/60 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 font-mono font-semibold text-fg-strong tabular-nums"
                  >
                    {i + 1}
                  </th>
                  <td className="py-2 pr-3 text-fg-strong">
                    <Link
                      to={`/personajes/${p.slug}`}
                      className="hover:text-gold hover:underline"
                    >
                      {p.nombre}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-fg-muted">{p.anime}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-gold">
                    {p.elo}
                  </td>
                  <td className="hidden py-2 pr-3 text-right font-mono text-fg-muted tabular-nums sm:table-cell">
                    {p.wins}/{p.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

export default RankingTechnicalTable
