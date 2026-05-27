import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { EDITORIAL_RANKING_PAGES } from '../../../data/editorial-rankings'

function EditorialRankingsStrip() {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            Rankings por intención
          </p>
          <h2 className="text-xl font-black text-fg-strong">
            Entra directo al top que buscabas
          </h2>
        </div>
        <Link
          to="/rankings/mejores-personajes-anime"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg/45 px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
        >
          Ver top global
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {EDITORIAL_RANKING_PAGES.map((page) => (
          <Link
            key={page.slug}
            to={`/rankings/${page.slug}`}
            className="group rounded-xl border border-border bg-bg/45 p-3 transition-all hover:-translate-y-0.5 hover:border-accent/45"
          >
            <p className="line-clamp-2 text-sm font-black text-fg-strong group-hover:text-gold">
              {page.title}
            </p>
            <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {page.intent}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default EditorialRankingsStrip
