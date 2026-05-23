import { useMemo } from 'react'
import { getPopularidad } from '../lib/personajes-core'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'

// antes [...personajes, ...personajes] = 1460
// spans + 1460 dots (~2920 nodos) en el marquee. Decorativo, no de
// browsing. Cap a 80 nombres seleccionados por popularidad — la
// rotación visual del marquee no se nota distinta y el DOM baja a
// 160 nodos (~95% menos). El sort se hace una vez al import.
const TOP_NOMBRES = 80

function NombresMarquee() {
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const dobles = useMemo(() => {
    const sample = [...catalogoPersonajes]
      .sort((a, b) => getPopularidad(b.slug) - getPopularidad(a.slug))
      .slice(0, TOP_NOMBRES)
    return [...sample, ...sample]
  }, [catalogoPersonajes])

  if (dobles.length === 0) return null

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
      <div className="flex min-w-max items-center gap-10 whitespace-nowrap animate-marquee motion-reduce:animate-none">
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
