import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * TvKatanaCut — transición de "corte katana" entre vistas del Modo TV.
 *
 * Tratamiento de retransmisión deportiva japonesa: al cambiar `viewKey`,
 * la vista SALIENTE se duplica en dos mitades con clip-path ESTÁTICO en
 * diagonal a 12° que se separan deslizándose (solo transform/opacity),
 * mientras una hairline dorada de 2px cruza la pantalla en 240ms.
 *
 * Reglas de perf del proyecto que respeta:
 * - El clip-path NUNCA se anima: se calcula una vez por corte y queda fijo.
 * - Solo se animan transform y opacity (60fps, sin layout/paint thrash).
 * - Cero blur()/backdrop-blur/SVG filters (jank de WebKit).
 * - prefers-reduced-motion ⇒ crossfade simple.
 *
 * Uso:
 *   <TvKatanaCut viewKey={vista} render={(key) => <Vista key={key} id={key} />} />
 *
 * `render(key)` debe devolver la vista COMPLETA (incluido su fondo/scene):
 * las mitades duplicadas necesitan llevar su propio fondo para que el corte
 * lea como un fotograma rebanado y no como dos capas transparentes.
 */

const ANGULO_CORTE = 12 // grados sobre la horizontal

/** Polígonos de las dos mitades para una diagonal a 12° por el centro. */
function clipsDelCorte(ratio) {
  const d = Math.tan((ANGULO_CORTE * Math.PI) / 180) * ratio * 50 // % de alto
  const y1 = (50 - d).toFixed(2)
  const y2 = (50 + d).toFixed(2)
  return {
    sup: `polygon(0% 0%, 100% 0%, 100% ${y1}%, 0% ${y2}%)`,
    inf: `polygon(0% ${y2}%, 100% ${y1}%, 100% 100%, 0% 100%)`,
  }
}

const EASE_MITADES = [0.22, 0.61, 0.36, 1]
const EASE_HOJA = [0.7, 0, 0.3, 1]

function TvKatanaCut({ viewKey, render, duracionMs = 700, className = '' }) {
  const reducido = useReducedMotion()
  const contRef = useRef(null)
  const prevKey = useRef(viewKey)
  // { saliente, fade } | { saliente, sup, inf } | null
  const [corte, setCorte] = useState(null)

  useEffect(() => {
    if (viewKey === prevKey.current) return undefined
    const saliente = prevKey.current
    prevKey.current = viewKey

    // setState diferido a microtask: el effect reacciona al cambio de vista
    // (regla react-hooks/set-state-in-effect, patrón del proyecto).
    queueMicrotask(() => {
      if (reducido) {
        setCorte({ saliente, fade: true })
      } else {
        const el = contRef.current
        const ratio = el ? el.clientWidth / Math.max(1, el.clientHeight) : 16 / 9
        setCorte({ saliente, ...clipsDelCorte(ratio) })
      }
    })
    const t = setTimeout(() => setCorte(null), duracionMs + 150)
    return () => clearTimeout(t)
  }, [viewKey, reducido, duracionMs])

  const seg = duracionMs / 1000

  return (
    // OJO: sin `relative` propio — el CALLER posiciona (el shell pasa
    // absolute inset-0). Dos clases de position en un className las decide
    // el orden del stylesheet de Tailwind, no el className (gotcha real del
    // proyecto: el EmptyState scene colapsaba EditorialCover a 48px por esto;
    // aquí colapsaba el corte entero a altura 0 bajo overflow-hidden).
    <div ref={contRef} className={`overflow-hidden bg-bg ${className}`}>
      {/* Vista entrante: ya montada debajo; el corte la revela */}
      <div className="absolute inset-0">{render(viewKey)}</div>

      {/* prefers-reduced-motion ⇒ crossfade sobrio */}
      {corte?.fade && (
        <motion.div
          className="absolute inset-0 z-10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.48, ease: 'easeOut' }}
        >
          {render(corte.saliente)}
        </motion.div>
      )}

      {corte && !corte.fade && (
        <>
          {/* Mitad superior — clip ESTÁTICO, desliza a lo largo de la diagonal */}
          <motion.div
            className="absolute inset-0 z-10 will-change-transform"
            style={{ clipPath: corte.sup }}
            initial={{ x: '0%', y: '0%', opacity: 1 }}
            animate={{ x: '9%', y: '-6%', opacity: 0 }}
            transition={{
              x: { delay: 0.13, duration: seg * 0.8, ease: EASE_MITADES },
              y: { delay: 0.13, duration: seg * 0.8, ease: EASE_MITADES },
              opacity: { delay: 0.23, duration: seg * 0.66, ease: 'easeOut' },
            }}
          >
            {render(corte.saliente)}
          </motion.div>

          {/* Mitad inferior — opuesta */}
          <motion.div
            className="absolute inset-0 z-10 will-change-transform"
            style={{ clipPath: corte.inf }}
            initial={{ x: '0%', y: '0%', opacity: 1 }}
            animate={{ x: '-9%', y: '6%', opacity: 0 }}
            transition={{
              x: { delay: 0.13, duration: seg * 0.8, ease: EASE_MITADES },
              y: { delay: 0.13, duration: seg * 0.8, ease: EASE_MITADES },
              opacity: { delay: 0.23, duration: seg * 0.66, ease: 'easeOut' },
            }}
          >
            {render(corte.saliente)}
          </motion.div>

          {/* Hairline dorada: 2px, recorre la diagonal en 240ms */}
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-0 w-0 -rotate-12">
              <motion.div
                className="absolute -top-px h-0.5 w-[60vw] will-change-transform"
                style={{
                  left: '-160vw',
                  background:
                    'linear-gradient(90deg, transparent, var(--color-gold-bright) 30%, var(--color-gold-pale) 50%, var(--color-gold-bright) 70%, transparent)',
                  boxShadow: '0 0 22px 2px var(--color-gold-aura)',
                }}
                initial={{ x: '0vw', opacity: 1 }}
                animate={{ x: '310vw' }}
                transition={{ duration: 0.24, ease: EASE_HOJA }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TvKatanaCut
