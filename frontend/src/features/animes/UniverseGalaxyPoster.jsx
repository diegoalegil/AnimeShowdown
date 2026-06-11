/**
 * UniverseGalaxyPoster.jsx — fallback estático de la galaxia (sin WebGL):
 * la misma espiral proyectada a 2D. Cero canvas, cero motion salvo el hover.
 * Tokens vía clases Tailwind + var(--color-*).
 */

import { useMemo, useState } from 'react'
import { buildGalaxyLayout, glyphFor, mulberry32 } from './galaxy/galaxy-layout.js'

export default function UniverseGalaxyPoster({
  universes,
  getSymbolUrl,
  hrefFor = (u) => `/animes/${u.slug}`,
  onSelect,
  className = '',
}) {
  const [raised, setRaised] = useState(null) // slug elevado por hover (z-index)

  const items = useMemo(() => {
    const layout = buildGalaxyLayout(universes)
    // proyección isométrica suave: x → izquierda/derecha, z (+ algo de y) → arriba/abajo
    const projected = layout.map((l) => ({
      ...l,
      px: 50 + (l.x / 36) * 46,
      py: 50 + ((l.z * 0.92 + l.y * 0.42) / 36) * 46,
    }))
    const ys = projected.map((p) => p.py)
    const min = Math.min(...ys)
    const max = Math.max(...ys)
    return projected.map((p) => {
      const depth = (p.py - min) / (max - min || 1) // 1 = más cerca (abajo)
      return {
        ...p,
        depth,
        sizePct: p.scale * (p.top ? 3.2 : 3.0) * (0.72 + 0.55 * depth),
        opacity: 0.55 + 0.45 * depth,
        z: 10 + Math.round(depth * 80),
      }
    })
  }, [universes])

  const stars = useMemo(() => {
    const rand = mulberry32(11)
    return Array.from({ length: 90 }, (_, i) => ({
      id: i,
      left: rand() * 100,
      top: rand() * 100,
      size: rand() < 0.85 ? 1 : 2,
      opacity: 0.12 + rand() * 0.5,
    }))
  }, [])

  const handleClick = (u) => (e) => {
    if (!onSelect) return // navegación normal por href
    e.preventDefault()
    onSelect(u)
  }

  return (
    <section className={`relative w-full overflow-hidden bg-bg px-4 py-8 sm:px-8 ${className}`}>
      {/* nebulosa fingida en CSS: dos radiales tenues carmesí/cian */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[90%] -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 14%, transparent), transparent 72%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[68%] top-[30%] h-[45%] w-[42%] -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--color-electric) 9%, transparent), transparent 70%)' }}
      />

      <div
        className="relative mx-auto aspect-square w-full max-w-205 sm:aspect-4/3"
        style={{ containerType: 'size' }}
      >
        {/* polvo de estrellas */}
        {stars.map((s) => (
          <span
            key={s.id}
            aria-hidden="true"
            className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: s.opacity }}
          />
        ))}

        {items.map((it) => {
          const u = it.universe
          const url = getSymbolUrl ? getSymbolUrl(u) : null
          return (
            <a
              key={u.slug}
              href={hrefFor(u)}
              onClick={handleClick(u)}
              onMouseEnter={() => setRaised(u.slug)}
              onMouseLeave={() => setRaised(null)}
              className="group absolute block -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${it.px}%`,
                top: `${it.py}%`,
                width: `${it.sizePct}%`,
                opacity: it.opacity,
                zIndex: raised === u.slug ? 99 : it.z,
              }}
            >
              <span
                className={`relative block aspect-square w-full overflow-hidden rounded-xl border bg-surface transition-transform duration-200 motion-safe:group-hover:scale-110 ${
                  it.top ? 'border-gold/60' : 'border-white/10'
                }`}
                style={it.top ? { boxShadow: '0 0 22px 2px color-mix(in oklab, var(--color-gold) 32%, transparent)' } : undefined}
              >
                {/* glifo placeholder (queda debajo si el webp carga) */}
                <span className="absolute inset-0 grid place-items-center">
                  <span
                    className={it.top ? 'text-gold' : 'text-white/85'}
                    style={{ fontFamily: 'var(--font-jp)', fontSize: `${it.sizePct * 0.46}cqw`, lineHeight: 1 }}
                  >
                    {glyphFor(u)}
                  </span>
                </span>
                {url && (
                  <img
                    src={url}
                    alt={u.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
              </span>

              {/* ficha al hover (solo dispositivos con puntero fino) */}
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-max max-w-56 -translate-x-1/2 rounded-lg border border-gold/30 bg-surface/95 px-3 py-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:block">
                <span className="block text-sm font-semibold leading-tight text-white">{u.name}</span>
                {u.characters?.length ? (
                  <span className="mt-1 block font-mono text-[11px] leading-snug text-gold">{u.characters.join(' · ')}</span>
                ) : null}
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
