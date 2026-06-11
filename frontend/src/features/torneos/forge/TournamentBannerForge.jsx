import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BANNER_W, BANNER_H, paintBanner, readTheme } from './banner-painter'

/**
 * TournamentBannerForge — panel de preview de la forja del torneo.
 *
 * El cartel se pinta en un canvas offscreen compartido (banner-painter) con
 * los DATOS REALES del formulario de CrearTorneoPage (nombre en vivo,
 * organizador = usuario logueado, tamaño del cuadro elegido, fecha de hoy)
 * y se re-sube como CanvasTexture con debounce: ves tu torneo izarse
 * mientras lo escribes.
 *
 * Solo es el estandarte: el formulario vive en la página (el export del
 * canvas traía uno propio con campos inventados — fuera).
 *
 * Fallbacks: desktop + WebGL + sin reduced-motion → tela 3D (chunk three
 * lazy, solo se descarga si va a montar); el resto ve el MISMO canvas como
 * cartel estático 2D (que de paso es la composición de una futura OG).
 */

const BannerClothScene = lazy(() => import('./BannerClothScene'))

const PAINT_DEBOUNCE_MS = 170

/** desktop + WebGL + sin reduced-motion, decidido una vez en el primer
 *  render (lazy initializer — mismo patrón que useReducedMotion del
 *  proyecto; evita el setState-en-effect que veta el compilador). */
function useCanHostCloth() {
  const reduced = useReducedMotion()
  const [capable] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) return false
    try {
      const probe = document.createElement('canvas')
      return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
    } catch {
      return false
    }
  })
  return capable && !reduced
}

export default function TournamentBannerForge({ nombre, organizador, fecha, bracketSize }) {
  const [texVersion, setTexVersion] = useState(0) // bump → CanvasTexture.needsUpdate
  const cloth = useCanHostCloth()

  // Canvas offscreen compartido: textura del plano Y cartel estático.
  const texCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = BANNER_W
    c.height = BANNER_H
    return c
  }, [])
  const staticRef = useRef(null)
  const debRef = useRef(0)
  const firstPaint = useRef(true)

  const repaint = useCallback(
    (data) => {
      paintBanner(texCanvas, data, readTheme())
      const staticCtx = staticRef.current?.getContext('2d')
      if (staticCtx) staticCtx.drawImage(texCanvas, 0, 0)
      setTexVersion((v) => v + 1)
    },
    [texCanvas],
  )

  // Primer pintado inmediato; después, debounce al teclear.
  useEffect(() => {
    const data = { name: nombre, organizer: organizador, date: fecha, bracketSize }
    if (firstPaint.current) {
      firstPaint.current = false
      repaint(data)
      return undefined
    }
    window.clearTimeout(debRef.current)
    debRef.current = window.setTimeout(() => repaint(data), PAINT_DEBOUNCE_MS)
    return () => window.clearTimeout(debRef.current)
  }, [nombre, organizador, fecha, bracketSize, repaint])

  return (
    <section className="flex flex-col items-center gap-3" aria-label="Estandarte del torneo">
      {cloth ? (
        <Suspense fallback={<div className="h-[38rem] w-full max-w-xl" aria-hidden="true" />}>
          <div className="relative w-full max-w-xl">
            {/* barra de la que cuelga la tela */}
            <div className="absolute inset-x-[8%] top-[28px] z-10 flex h-4 items-center" aria-hidden="true">
              <div className="size-4 rounded-full bg-gold/60" />
              <div className="-mx-1 h-2 flex-1 rounded-full bg-gradient-to-b from-gold to-gold/40" />
              <div className="size-4 rounded-full bg-gold/60" />
            </div>
            <BannerClothScene
              textureCanvas={texCanvas}
              textureVersion={texVersion}
              className="block h-[38rem] w-full"
            />
          </div>
        </Suspense>
      ) : (
        <canvas
          ref={staticRef}
          width={BANNER_W}
          height={BANNER_H}
          aria-label="Cartel del torneo"
          className="block w-full max-w-sm rounded-xl border border-border"
        />
      )}
      <p className="font-mono text-xs text-fg-muted">
        {cloth ? 'tela en vivo · la textura se reteje al teclear' : 'cartel del torneo'}
      </p>
    </section>
  )
}
