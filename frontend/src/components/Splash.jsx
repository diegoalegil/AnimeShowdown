import { useEffect, useState } from 'react'

// Splash de marca. Solo en la PRIMERA entrada a la pestaña (sessionStorage) y
// nunca con prefers-reduced-motion → no penaliza reloads ni navegación SPA, y
// respeta a quien reduce animaciones. Reproduce UNA vez la animación del logo
// nuevo (el enso se dibuja, el 滅 entra en tinta, caen pétalos y el wordmark
// sube) y se desvanece. Va por ENCIMA de la app (no bloquea su carga): es el
// momento de marca de la primera visita.
const SHOWN_KEY = 'animeshowdown.splash.shown'
const SHOW_MS = 2000
const EXIT_MS = 400

function Splash() {
  const [mounted, setMounted] = useState(() => {
    try {
      if (typeof window === 'undefined') return false
      if (sessionStorage.getItem(SHOWN_KEY) === 'true') return false
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        sessionStorage.setItem(SHOWN_KEY, 'true')
        return false
      }
      return true
    } catch {
      return false
    }
  })
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!mounted) return
    try { sessionStorage.setItem(SHOWN_KEY, 'true') } catch { /* SSR/privacy */ }
    const closeId = setTimeout(() => setClosing(true), SHOW_MS)
    const removeId = setTimeout(() => setMounted(false), SHOW_MS + EXIT_MS)
    return () => {
      clearTimeout(closeId)
      clearTimeout(removeId)
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-bg ${closing ? 'as-splash-overlay-exit' : ''}`}
    >
      {/* Filtro de tinta (displacement) que da el trazo de pincel al 滅.
          Las clases .as-splash-* viven en index.css (stylesheet global). */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <filter id="asInk">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
          </filter>
        </defs>
      </svg>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-20 blur-3xl" />
      </div>

      <div
        className="as-splash relative z-10 flex flex-col items-center gap-6"
        role="status"
        aria-label="Cargando AnimeShowdown"
      >
        <div className="as-splash-emblem">
          <svg width="148" height="148" viewBox="0 0 100 100" aria-hidden="true">
            <circle
              className="as-splash-ring"
              cx="50" cy="50" r="40" fill="none"
              stroke="var(--as-red)" strokeWidth="4.4" strokeLinecap="round"
              transform="rotate(46 50 50)" filter="url(#asInk)"
            />
            <circle
              className="as-splash-ring2"
              cx="50" cy="50" r="33" fill="none"
              stroke="var(--as-red)" strokeWidth="1.6" strokeLinecap="round"
              transform="rotate(-150 50 50)" filter="url(#asInk)"
            />
          </svg>
          <div className="as-splash-k" aria-hidden="true">滅</div>
          <span className="as-splash-petal" style={{ top: 10, right: 14 }} />
          <span className="as-splash-petal" style={{ top: -2, right: -2, width: 8, height: 10, animationDelay: '.1s' }} />
          <span className="as-splash-petal" style={{ top: 28, right: 0, width: 7, height: 9, animationDelay: '.2s' }} />
        </div>
        <div className="as-splash-wm text-center">
          <span className="as-splash-a">Anime</span>
          <span className="as-splash-s">Showdown</span>
          <span className="as-splash-jp" lang="ja">アニメの戦い</span>
        </div>
      </div>
    </div>
  )
}

export default Splash
