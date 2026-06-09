import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

/**
 * Tabla técnica extraíble para crawlers. Expone SOLO datos
 * reales: top por votos de la comunidad desde el backend. Antes mostraba el
 * ELO base sintético + W/L estimadas, que se leían como ranking competitivo
 * real — ahora nunca exponemos dato sintético aquí.
 */
function RankingTechnicalTable({ items }) {
  const top = Array.isArray(items) ? items.slice(0, 10) : []
  return (
    <details className="group mt-6 rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-fg-muted">
            Datos técnicos
          </h2>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Top por votos reales de la comunidad, en formato estándar para copia
            rápida o referencia.
          </p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180 [details[open]_&]:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">
        {top.length === 0 ? (
          <p className="text-[13px] text-fg-muted">
            Aún no hay votos suficientes para publicar una tabla competitiva.
            Vuelve cuando la comunidad haya resuelto más duelos.
          </p>
        ) : (
          <div
            className="scroll-x-affordance scroll-x-fade-mobile overflow-x-auto"
            aria-label="Tabla técnica del ranking por votos"
          >
            <table className="min-w-[32rem] border-collapse text-[13px] sm:w-full">
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
                    Votos
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((item, i) => (
                  <tr
                    key={item.personaje.slug}
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
                        to={`/personajes/${item.personaje.slug}`}
                        className="hover:text-gold hover:underline"
                      >
                        {item.personaje.nombre}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-fg-muted">
                      {item.personaje.anime}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-gold">
                      {item.votos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}

export default RankingTechnicalTable
