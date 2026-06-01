import { Link } from 'react-router-dom'
import { Crown, Sparkles } from 'lucide-react'
import CartaFace from './CartaFace'
import { cartaShowcaseSlotLabel } from './carta-showcase-slots'

function CartaShowcaseRail({
  showcases,
  title = 'Cartas destacadas',
  actionTo,
  actionLabel = 'Editar',
  showEmpty = false,
}) {
  const items = Array.isArray(showcases) ? showcases.filter((item) => item?.carta) : []

  if (items.length === 0 && !showEmpty) return null

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-gold">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            Escaparate
          </p>
          <h2 className="mt-1 text-lg font-black text-fg-strong">{title}</h2>
        </div>
        {actionTo && (
          <Link
            to={actionTo}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-3.5 py-2 text-[12px] font-black text-gold transition-colors hover:border-gold"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {actionLabel}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] text-fg-muted">
          Aun no hay cartas fijadas.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.slice(0, 6).map((item) => (
            <Link
              key={`${item.slot}-${item.carta.id}`}
              to={`/cartas/${item.carta.id}`}
              className="group min-w-0"
            >
              <div className="relative">
                <CartaFace carta={item.carta} />
                <span className="absolute left-2 top-2 rounded-lg border border-gold/40 bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-gold backdrop-blur-sm">
                  {cartaShowcaseSlotLabel(item.slot)}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-[12px] font-bold text-fg-strong group-hover:text-gold">
                {item.carta.personajeNombre}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default CartaShowcaseRail
