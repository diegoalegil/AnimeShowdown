import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PersonajeCard from './PersonajeCard'

function CarouselRow({ titulo, personajes, eyebrow }) {
  const scrollRef = useRef(null)

  const scroll = (dir) => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  return (
    <section className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {eyebrow && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                {eyebrow}
              </span>
            )}
            <h2 className="text-xl font-bold tracking-tight text-fg-strong sm:text-2xl">
              {titulo}
            </h2>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Anterior"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-accent hover:text-gold"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Siguiente"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-accent hover:text-gold"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          ref={scrollRef}
          aria-label={`${titulo}: lista desplazable`}
          className="scrollbar-hide scroll-x-affordance scroll-x-fade -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 scroll-smooth sm:-mx-8 sm:px-8"
        >
          {personajes.map((p) => (
            <div
              key={p.slug}
              className="w-[140px] flex-none snap-start sm:w-[160px] lg:w-[180px]"
            >
              <PersonajeCard {...p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CarouselRow
