import { personajes } from '../data/personajes'

const dobles = [...personajes, ...personajes]

function NombresMarquee() {
  return (
    <section
      aria-hidden="true"
      className="relative overflow-hidden border-y border-border bg-surface/30 py-6"
      style={{
        maskImage:
          'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
      }}
    >
      <div className="flex min-w-max items-center gap-10 whitespace-nowrap animate-marquee">
        {dobles.map((p, i) => (
          <div key={`${p.slug}-${i}`} className="flex items-center gap-4">
            <span className="text-2xl font-extrabold tracking-tight text-fg-muted/30 transition-colors hover:text-fg-strong sm:text-3xl">
              {p.nombre}
            </span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default NombresMarquee
