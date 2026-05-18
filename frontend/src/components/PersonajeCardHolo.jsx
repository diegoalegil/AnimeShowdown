import { useEffect, useRef, useState } from 'react'

/**
 * Card holográfica estilo TCG (Pokémon holo / Yu-Gi-Oh prismatic).
 *
 * <p>Recibe una imagen ya curada (las cards SSR del catálogo) y aplica:
 * <ul>
 *   <li>tilt 3D mouse-tracked (rotateY/X según delta del cursor al centro);</li>
 *   <li>specular highlight (radial gradient blanco) que sigue al cursor;</li>
 *   <li>arcoiris holográfico (conic gradient cromático con
 *       mix-blend-mode: color-dodge) que rota según la posición horizontal
 *       del cursor — efecto "tarjeta inclinándose bajo la luz".</li>
 * </ul>
 *
 * <p>Implementación zero-lib: CSS custom properties actualizadas vía ref
 * con {@code style.setProperty} en {@code mousemove}. Evita re-renders
 * de React (60fps sin pagar reconciliación). Bundle ~2KB.
 *
 * <p>Respeta {@code prefers-reduced-motion}: si está activo, el holo no
 * monta listeners ni overlays — solo renderiza la imagen plana.
 *
 * <p>Soporta input táctil: en pointer:coarse el efecto se aplica con la
 * orientación del device (alpha/beta del DeviceOrientationEvent si está
 * disponible), aunque por simplicidad inicial dejamos solo mouse — en
 * touch el holo queda en idle (no molesta) y la imagen sigue legible.
 */
function PersonajeCardHolo({ src, alt, className = '', fallbackSrc }) {
  const rootRef = useRef(null)
  const rafRef = useRef(0)
  const pendingRef = useRef(null)
  const [failedSources, setFailedSources] = useState(() => new Set())
  const shouldUseFallback = failedSources.has(src) && fallbackSrc && !failedSources.has(fallbackSrc)
  const currentSrc = shouldUseFallback ? fallbackSrc : src
  const imageFailed = failedSources.has(currentSrc)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    // mousemove se llama varias veces por frame. Coalescemos con
    // requestAnimationFrame: solo aplicamos la última posición al style
    // antes del siguiente paint. Sin esto el browser hace layout/paint
    // por cada evento → jank en dispositivos lentos.
    function onMove(e) {
      const rect = el.getBoundingClientRect()
      pendingRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      }
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const { x, y } = pendingRef.current
        el.style.setProperty('--mx', x.toFixed(3))
        el.style.setProperty('--my', y.toFixed(3))
        el.style.setProperty('--active', '1')
      })
    }
    function onLeave() {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      el.style.setProperty('--mx', '0.5')
      el.style.setProperty('--my', '0.5')
      el.style.setProperty('--active', '0')
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={`card-holo ${className}`.trim()}
      style={{
        '--mx': '0.5',
        '--my': '0.5',
        '--active': '0',
      }}
    >
      {imageFailed ? (
        <div className="card-holo__img flex h-full w-full flex-col items-center justify-center gap-2 bg-surface px-6 text-center">
          <span className="text-lg font-semibold text-fg-strong">{alt}</span>
          <span className="text-xs text-fg-muted">Imagen no disponible</span>
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          // ReferrerPolicy no-referrer como defensa extra para imagenes
          // externas de MyAnimeList. Si aun asi fallan, volvemos a la imagen
          // local del catalogo para no dejar la ficha en blanco.
          referrerPolicy="no-referrer"
          className="card-holo__img h-full w-full object-cover"
          draggable={false}
          onError={() => {
            setFailedSources((prev) => {
              if (prev.has(currentSrc)) return prev
              const next = new Set(prev)
              next.add(currentSrc)
              return next
            })
          }}
        />
      )}
      <div className="card-holo__shine" aria-hidden="true" />
      <div className="card-holo__rainbow" aria-hidden="true" />
    </div>
  )
}

export default PersonajeCardHolo
