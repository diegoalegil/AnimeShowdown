import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// el splash añadía 1.1s fijos + 0.5s fade en CADA
// navegación directa, dando sensación de lentitud incluso cuando la app
// ya estaba lista. Cambios:
//  - Solo se muestra en la primera entrada de la pestaña (sessionStorage):
//    si el usuario navega entre rutas de la SPA sin recargar, el splash
//    ya no vuelve a aparecer y los reloads frecuentes dentro de la misma
//    sesión tampoco lo disparan.
//  - Duración reducida 1100→600 ms (mantiene branding sin penalizar TTI).
//  - prefers-reduced-motion: skip total — usuarios con animaciones
//    reducidas no esperan splash, va directo a la app.
const SHOWN_KEY = 'animeshowdown.splash.shown'
const SHOW_MS = 600

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

  // antes el effect tenía [visible] en deps. Cuando
  // setVisible(false) disparaba, el effect re-ejecutaba con el guard
  // `if (!visible) return` — innecesario y propenso a confusión. El
  // effect solo necesita correr UNA vez al mount, sin deps.
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
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-20 blur-3xl" />
          </div>
          <motion.div
            className="relative z-10 flex flex-col items-center gap-5"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <motion.img
              src="/logo.webp"
              alt=""
              width={140}
              height={140}
              className="h-32 w-32 object-contain"
              style={{ filter: 'drop-shadow(0 0 40px rgb(159 29 44 / 0.55))' }}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-2xl font-extrabold tracking-tight text-fg-strong">
              AnimeShowdown
            </span>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-accent"
                  animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Splash
