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
// La carta holo es el LCP de la ficha y cargaba siempre el original
// (p.ej. zoro 723px/301KB) existiendo la variante -600 (148KB) generada
// para TODO el catálogo. Igual que en PersonajeImg, el original queda
// FUERA del srcset: en pantallas 2x-3x el navegador lo elegiría siempre
// por un extra de nitidez imperceptible (la carta renderiza a ≤448px CSS)
// pagando el doble de bytes en el LCP. Solo aplica a paths locales
// /img/*.webp — las URLs externas (MAL) no tienen variantes.
function buildVariantSrcSet(src) {
  if (!src || !/^\/img\/.+\.webp$/i.test(src)) return null
  const base = src.replace(/(?:-(?:300|600|1024))?\.webp$/i, '')
  return `${base}-300.webp 300w, ${base}-600.webp 600w`
}

function PersonajeCardHolo({ src, alt, className = '', fallbackSrc }) {
  const rootRef = useRef(null)
  const rafRef = useRef(0)
  const pendingRef = useRef(null)
  const [failedSources, setFailedSources] = useState(() => new Set())
  // Srcs cuya variante -600 falló: se reintentan sin srcset (solo el
  // original) antes de declarar el src entero como roto.
  const [variantFailures, setVariantFailures] = useState(() => new Set())
  const shouldUseFallback = failedSources.has(src) && fallbackSrc && !failedSources.has(fallbackSrc)
  const currentSrc = shouldUseFallback ? fallbackSrc : src
  const imageFailed = failedSources.has(currentSrc)
  const variantSrcSet = buildVariantSrcSet(currentSrc)
  const useVariants = Boolean(variantSrcSet) && !variantFailures.has(currentSrc)

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
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_20%,rgb(197_161_90_/_0.14),transparent_15rem),linear-gradient(180deg,rgb(255_255_255_/_0.04),rgb(255_255_255_/_0.01)),var(--color-surface)] px-6 text-center">
          <span className="rounded-full border border-gold/35 bg-gold-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gold">
            Carta pendiente
          </span>
          <span className="text-xl font-black text-fg-strong">{alt}</span>
          <span className="max-w-44 text-xs leading-5 text-fg-muted">
            El asset principal no cargo. Se mantiene la ficha y las acciones.
          </span>
        </div>
      ) : (
        <img
          src={currentSrc}
          srcSet={useVariants ? variantSrcSet : undefined}
          // La carta ocupa max-w-sm en móvil (limitada por max-h-55vh) y
          // max-w-md (28rem) en desktop → la variante 600w basta hasta 2x.
          sizes={useVariants ? '(min-width: 768px) 28rem, 85vw' : undefined}
          alt={alt}
          width={600}
          height={900}
          // LCP de la ficha: prioridad alta para que el navegador no la
          // encole detrás de chunks/img del grid de relacionados.
          fetchPriority="high"
          // ReferrerPolicy no-referrer como defensa extra para imagenes
          // externas de MyAnimeList. Si aun asi fallan, volvemos a la imagen
          // local del catalogo para no dejar la ficha en blanco.
          referrerPolicy="no-referrer"
          className="card-holo__img h-full w-full object-cover"
          draggable={false}
          onError={() => {
            if (useVariants) {
              // Pudo fallar solo la variante -600: reintento sin srcset.
              setVariantFailures((prev) => {
                if (prev.has(currentSrc)) return prev
                const next = new Set(prev)
                next.add(currentSrc)
                return next
              })
              return
            }
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
