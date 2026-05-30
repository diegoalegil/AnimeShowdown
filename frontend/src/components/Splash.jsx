import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Splash de marca. Solo en la PRIMERA entrada a la pestaña (sessionStorage) y
// nunca con prefers-reduced-motion → no penaliza reloads ni navegación SPA, y
// respeta a quien reduce animaciones. Reproduce UNA vez la animación del logo
// nuevo (el enso se dibuja, el 滅 entra en tinta, caen pétalos y el wordmark
// sube) y se desvanece. Va por ENCIMA de la app (no bloquea su carga): es el
// momento de marca de la primera visita.
const SHOWN_KEY = 'animeshowdown.splash.shown'
const SHOW_MS = 2000

// Animación del emblema portada del logo de marca. Colores del logo (rojo
// bermellón propio del sello, distinto del carmesí de la web) declarados como
// custom properties scopeadas para no esparcir hex por el JSX.
const SPLASH_CSS = `
.as-splash{--as-red:#d62b2b;--as-red-br:#f0463a;--as-cream:#f1e7d3}
.as-splash-emblem{position:relative;width:148px;height:148px;display:grid;place-items:center;animation:asGlow 2.6s ease-in-out infinite}
.as-splash-ring{stroke-dasharray:240 26;stroke-dashoffset:266;animation:asDraw 1.3s cubic-bezier(.2,.7,.2,1) forwards}
.as-splash-ring2{stroke-dasharray:186 22;stroke-dashoffset:208;opacity:.72;animation:asDraw2 1.5s cubic-bezier(.2,.7,.2,1) forwards}
.as-splash-k{position:absolute;inset:0;display:grid;place-items:center;font-family:"Shippori Mincho","Hiragino Mincho ProN",serif;font-weight:800;font-size:76px;color:var(--as-red-br);text-shadow:0 0 16px rgb(214 43 43 / .7);filter:url(#asInk);opacity:0;transform:scale(.8);animation:asInk .8s ease-out .5s forwards}
.as-splash-petal{position:absolute;width:11px;height:13px;background:var(--as-red);border-radius:100% 8% 100% 8%;opacity:0;animation:asFall .8s ease-out forwards}
.as-splash-wm span{display:block;font-weight:800;letter-spacing:-.01em;line-height:.92}
.as-splash-a{font-size:46px;color:var(--as-cream);opacity:0;transform:translateY(12px);animation:asRise .7s ease-out .85s forwards}
.as-splash-s{font-size:46px;background:linear-gradient(180deg,#e0b25e,#f1e7d3);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;transform:translateY(12px);animation:asRise .7s ease-out 1s forwards}
.as-splash-jp{font-size:14px;font-weight:500;letter-spacing:.34em;color:var(--as-red-br);margin-top:9px;opacity:0;animation:asRise .7s ease-out 1.15s forwards}
@keyframes asDraw{to{stroke-dashoffset:26}}
@keyframes asDraw2{to{stroke-dashoffset:22}}
@keyframes asInk{to{opacity:1;transform:scale(1)}}
@keyframes asFall{from{opacity:0;transform:translate(-6px,-10px) rotate(0)}to{opacity:.9;transform:translate(0,0) rotate(40deg)}}
@keyframes asRise{to{opacity:1;transform:translateY(0)}}
@keyframes asGlow{0%,100%{filter:drop-shadow(0 0 12px rgb(214 43 43 / .5))}50%{filter:drop-shadow(0 0 22px rgb(214 43 43 / .85))}}
`

function Splash() {
  const [visible, setVisible] = useState(() => {
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

  useEffect(() => {
    if (!visible) return
    try { sessionStorage.setItem(SHOWN_KEY, 'true') } catch { /* SSR/privacy */ }
    const t = setTimeout(() => setVisible(false), SHOW_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-bg"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <style>{SPLASH_CSS}</style>
          {/* Filtro de tinta (displacement) que da el trazo de pincel al 滅. */}
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Splash
