/**
 * EmaWall — muro de tablillas ema votivas para /apoya.
 *
 * Razonamiento de diseño (Kessen):
 * - Cada vía de apoyo es una tablilla de madera colgada con cordón carmesí de
 *   un travesaño, como las ema de un santuario. El kanji 願 (deseo) va grabado
 *   en la madera — kanji con significado, nunca relleno.
 * - Madera = gradientes sobre tokens (gold/accent sobre surface-alt) + veta
 *   con repeating-linear-gradient. Cero texturas externas, cero hex en JSX.
 * - Hover/focus: la tablilla oscila ±2° con transform-origin en el clavo del
 *   travesaño. Solo transform/opacity (compositor-only); la animación corre
 *   UNA vez por hover, no en bucle. prefers-reduced-motion = todo estático.
 * - Entrada escalonada en CSS puro (opacity/translateY, fill backwards, una
 *   pasada al montar): cero JS de animación, cero coste fuera del compositor.
 * - Las vías gratuitas cuelgan del mismo travesaño y con el mismo peso visual
 *   que las donaciones: voz de federación agradecida, no paywall.
 * - Cordones de longitudes desiguales (CUERDA) + reposo rotado (REPOSO):
 *   el muro respira como uno real, no como un grid de cards.
 *
 * Uso: <EmaWall /> dentro de ApoyaPage, junto a <SupportCandle />.
 * Keyframes en ema-wall.css (feature css bundleado — la CSP veta <style>).
 */

import { EMA_VIAS } from './ema-vias'
import './ema-wall.css'

/* Longitud del cordón (px) y rotación de reposo por tablilla. Desiguales a
   propósito: un muro de ema real nunca cuelga en línea recta. */
const CUERDA = [22, 50, 32, 60]
const REPOSO = ['-1.4deg', '1deg', '-0.9deg', '1.6deg']

/* Tono de madera: gradiente sobre tokens (sin hex). "calida" = lacada con
   reflejo de oro; "sobria" = casi al raso, deja mandar al carmesí del cordón. */
const MADERA = {
  calida: 'from-gold/40 via-gold/15 to-accent/10',
  sobria: 'from-gold/15 via-surface-alt/60 to-accent/5',
}


function EmaTablilla({ via, index, tone }) {
  const cuerda = CUERDA[index % CUERDA.length]
  const reposo = REPOSO[index % REPOSO.length]
  const destacada = via.tipo === 'ofrenda'
  return (
    <li className="ema-cell relative">
      {/* Travesaño: cada celda lleva su tramo; en fila se leen como una viga */}
      <div
        aria-hidden="true"
        className="inset-shadow-hairline relative h-2 w-full rounded-full bg-gradient-to-b from-gold/35 to-surface-alt"
      >
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-aura-sm"></span>
      </div>

      {/* La entrada (opacity/y) vive en un wrapper aparte para no pisar el
          rotate del cordón. */}
      <div className="ema-drop" style={{ '--ema-i': index }}>
        <div className="ema-hang relative w-full" style={{ '--ema-rest': reposo }}>
          {/* Cordón carmesí: cruza el tejadillo y entra por el agujero */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-0 z-10 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-accent-hover to-accent"
            style={{ height: cuerda + 30 }}
          ></span>
          <span
            aria-hidden="true"
            className="absolute left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent-hover"
            style={{ top: cuerda + 26 }}
          ></span>

          <a
            href={via.href}
            target="_blank"
            rel="noreferrer"
            className="drop-shadow-figure group mx-auto block w-full max-w-[240px] rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            style={{ marginTop: cuerda }}
          >
            {/* Marco: el gradiente exterior hace de borde bajo el clip */}
            <span
              className={`block bg-gradient-to-b p-[1.5px] [clip-path:var(--ema-clip)] ${
                destacada ? 'from-border-gold via-border to-accent/35' : 'from-border via-border to-border/60'
              }`}
            >
              <span
                className={`relative flex min-h-[250px] flex-col items-center gap-1.5 bg-surface-alt bg-gradient-to-b px-3.5 pb-4 pt-14 text-center [clip-path:var(--ema-clip)] sm:min-h-[270px] sm:px-4 ${MADERA[tone] ?? MADERA.calida}`}
              >
                {/* Veta de la madera */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(94deg,transparent_0_5px,var(--color-canvas)_5px_6px)] opacity-10"
                ></span>
                {/* Agujero del cordón */}
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-[9%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-canvas ring-1 ring-gold/40"
                ></span>

                <span
                  aria-hidden="true"
                  className={`ema-kanji font-kanji-serif text-[2.6rem] leading-none ${
                    destacada ? 'text-gold/45' : 'text-canvas/60'
                  }`}
                >
                  願
                </span>
                <p className="font-mono text-2xs text-fg-muted">{via.plataforma}</p>
                <h3 className="font-display text-base font-bold leading-snug text-fg-strong">{via.titulo}</h3>
                <p className="relative text-2xs leading-relaxed text-fg-muted">{via.texto}</p>
                <span
                  className={`mt-auto inline-flex items-center gap-1 pt-2 text-2xs font-semibold transition-colors ${
                    destacada ? 'text-gold' : 'text-fg-muted group-hover:text-fg-strong'
                  }`}
                >
                  {via.cta}
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </span>
            </span>
          </a>
        </div>
      </div>
    </li>
  )
}

function EmaWall({ vias = EMA_VIAS, tone = 'calida' }) {
  return (
    <div>
      <ul role="list" className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        {vias.map((via, i) => (
          <EmaTablilla key={via.id} via={via} index={i} tone={tone} />
        ))}
      </ul>
    </div>
  )
}

export default EmaWall
