import { useState } from 'react'

/**
 * Pétalos de sakura cayendo en la home (Plan v2 §13.7).
 *
 * <p>Se activa automáticamente entre el <strong>15 de marzo y el 15 de
 * abril</strong> (hanami japonés). Fuera de esa ventana queda apagado
 * para no convertir el sitio en un weeb perpetuo.
 *
 * <p>Overrides vía localStorage:
 * <ul>
 *   <li>{@code animeshowdown.sakura = 'on'} fuerza pétalos siempre.</li>
 *   <li>{@code animeshowdown.sakura = 'off'} los desactiva incluso en hanami.</li>
 * </ul>
 *
 * <p>A11y: respeta {@code prefers-reduced-motion} (igual que el confetti
 * de badges). Sin canvas/WebGL — todo SVG + CSS animations para que
 * funcione sin overhead en background tabs.
 *
 * <p>Sin librerías externas: tsParticles añadiría ~30KB gzip por este
 * efecto estacional, no compensa.
 */
const NUM_PETALOS = 16

function dentroDeHanami(date = new Date()) {
  const m = date.getMonth() // 0-indexed
  const d = date.getDate()
  // 15 marzo (m=2, d>=15) ... 15 abril (m=3, d<=15)
  if (m === 2 && d >= 15) return true
  if (m === 3 && d <= 15) return true
  return false
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

function deberiaPintar() {
  if (typeof window === 'undefined') return false
  if (prefersReducedMotion()) return false
  const override = (() => {
    try {
      return localStorage.getItem('animeshowdown.sakura')
    } catch {
      return null
    }
  })()
  if (override === 'on') return true
  if (override === 'off') return false
  return dentroDeHanami()
}

function generarPetalos() {
  return Array.from({ length: NUM_PETALOS }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 10,
    duration: 8 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 80,
    rotateStart: Math.random() * 360,
    rotateEnd: 360 + Math.random() * 360,
    scale: 0.6 + Math.random() * 0.7,
    opacityMax: 0.35 + Math.random() * 0.35,
  }))
}

function SakuraPetals() {
  // useState con initializer en lugar de useMemo: React Compiler exige
  // que useMemo sea puro (sin Math.random). useState lazy init solo se
  // ejecuta una vez por instancia y es la API idiomática para datos
  // aleatorios que persisten durante la vida del componente.
  const [petalos] = useState(() => generarPetalos())

  // AnimeShowdown es SPA pura sin SSR (Bloque 3.1 aplazado), así que
  // window y localStorage están disponibles en el primer render. No
  // hace falta state de "mounted" + useEffect.
  if (!deberiaPintar()) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {petalos.map((p) => (
        <span
          key={p.id}
          className="sakura-petal absolute"
          style={{
            left: `${p.left}%`,
            top: '-30px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // Custom props para que la animation use estos valores.
            '--drift': `${p.drift}px`,
            '--rot-start': `${p.rotateStart}deg`,
            '--rot-end': `${p.rotateEnd}deg`,
            '--scale': p.scale,
            '--opacity-max': p.opacityMax,
          }}
        >
          {/* SVG inline: pétalo simple en gradient pastel. Mantiene
              renderizado consistente cross-browser y no depende de fonts. */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 1.5 C 14 5, 18 7, 18 12 C 18 17, 13 20, 11 20.5 C 9 20, 4 17, 4 12 C 4 7, 8 5, 11 1.5 Z"
              fill="url(#petal-grad)"
            />
            <defs>
              <linearGradient id="petal-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffcce6" />
                <stop offset="100%" stopColor="#d6b36a" />
              </linearGradient>
            </defs>
          </svg>
        </span>
      ))}
    </div>
  )
}

export default SakuraPetals
