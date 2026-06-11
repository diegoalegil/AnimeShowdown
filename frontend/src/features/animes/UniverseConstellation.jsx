/* ============================================================================
   UniverseConstellation — vista constelación de los universos anime.

   Decisiones clave (del diseño original del canvas, adaptado al app):
   - Distribución DETERMINISTA por seed (mulberry32): el mismo seed produce
     exactamente el mismo cielo en cada render. Nada de Math.random().
   - Virtualización simple de tooltips: solo existe en el DOM el tooltip del
     nodo activo (hover/focus). ~100 nodos → 1 tooltip como máximo.
   - 60 fps: todas las transiciones son transform/opacity (stroke-opacity en
     líneas). El pan usa scrollLeft nativo + inercia rAF solo en desktop;
     en táctil manda el scroll nativo con inercia del sistema (sin zoom).
   - prefers-reduced-motion: sin twinkle, sin inercia, sin transiciones.
   - Tokens: exclusivamente var(--color-*) / var(--font-*). Sin hex literales.
   - framer-motion no hace falta aquí: todo el movimiento es CSS
     transform/opacity, más barato que montar 100 motion.div.

   Adaptaciones vs el canvas: datos REALES vía props (constelacion-grupos),
   emblema = symbol del banco de marca, click navega a /animes/<slug>, y la
   vista vive en su propia ruta (el toggle Lista⇄Constelación son Links).
   ========================================================================= */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { brandAssetUrl } from '../../lib/brand-assets'
import { W, H, buildLayout } from './constelacion-layout'

/* Estilos que no pueden ser inline (pseudo-estados, keyframes, media
   queries), con prefijo uc- propio. Cero hex: todo vía tokens. */
const CSS = `
.uc-scroller{scrollbar-width:none;-webkit-overflow-scrolling:touch;user-select:none;-webkit-user-select:none;cursor:grab;}
.uc-scroller::-webkit-scrollbar{display:none}
.uc-scroller.uc-grabbing{cursor:grabbing}
.uc-node{position:absolute;display:flex;align-items:center;justify-content:center;border:0;padding:0;background:transparent;cursor:pointer;transform:translate(-50%,-50%);transition:transform .18s ease;will-change:transform;-webkit-tap-highlight-color:transparent;}
.uc-node:hover,.uc-node:focus-visible{transform:translate(-50%,-50%) scale(1.14);z-index:4}
.uc-node:focus-visible{outline:2px solid var(--color-electric);outline-offset:4px;border-radius:16px}
.uc-tile{position:relative;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid;background:var(--color-surface);overflow:hidden}
.uc-line{transition:stroke-opacity .22s ease}
.uc-tip{animation:uc-fade .16s ease both}
@keyframes uc-fade{from{opacity:0}to{opacity:1}}
@keyframes uc-twinkle{0%,100%{opacity:.1}50%{opacity:.5}}
.uc-tw{animation:uc-twinkle 5.5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){
  .uc-node,.uc-line{transition:none}
  .uc-tw{animation:none}
  .uc-tip{animation:none}
}
`

const MONO = 'var(--font-mono)'
const JP = 'var(--font-jp, serif)'
const TEXT_DIM = 'var(--color-fg-muted)'

/* Emblema: symbol real del banco de marca; mientras carga (o si el asset no
   resuelve) se ve la inicial tipográfica — placeholder honesto. */
function Emblem({ slug, name, top, size, radius }) {
  const src = brandAssetUrl(`${slug}-symbol-01`, 480)
  return (
    <span
      className="uc-tile"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderColor: top
          ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)'
          : 'color-mix(in srgb, var(--color-gold) 22%, transparent)',
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontFamily: JP, fontWeight: 700, fontSize: size * 0.42, color: 'var(--color-gold)', opacity: 0.85 }}
      >
        {name.charAt(0)}
      </span>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </span>
  )
}

/* Nodo del cielo. memo: en cada hover solo re-renderizan los nodos cuyo
   estado cambia, no los ~100. */
const Node = memo(function Node({ n, i, onEnter, onLeave, onOpen }) {
  const size = n.top ? 64 : 48
  return (
    <button
      type="button"
      className="uc-node"
      aria-label={`${n.name}, ${n.chars} personajes`}
      style={{ left: n.x, top: n.y, width: size, height: size, zIndex: n.top ? 2 : 1 }}
      onMouseEnter={() => onEnter(i)}
      onMouseLeave={onLeave}
      onFocus={() => onEnter(i)}
      onBlur={onLeave}
      onClick={() => onOpen(n.slug)}
    >
      {n.top && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -size * 0.8,
            borderRadius: '50%',
            background:
              'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 26%, transparent), transparent 72%)',
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        />
      )}
      <Emblem slug={n.slug} name={n.name} top={n.top} size={size} radius={12} />
    </button>
  )
})

function UniverseConstellation({ grupos, seed = 7 }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(null)
  const layout = useMemo(() => buildLayout(grupos, seed), [grupos, seed])
  const scrollerRef = useRef(null)
  const movedRef = useRef(0)

  // Arrancar con el cielo centrado.
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [seed])

  // Pan con inercia en desktop (rAF sobre scrollLeft). En táctil no se
  // intercepta nada: scroll nativo horizontal con la inercia del sistema.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    let down = false
    let lastX = 0
    let lastT = 0
    let vel = 0
    let raf = 0
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const onDown = (e) => {
      if (e.pointerType === 'touch') return
      down = true
      movedRef.current = 0
      lastX = e.clientX
      lastT = performance.now()
      vel = 0
      cancelAnimationFrame(raf)
      el.classList.add('uc-grabbing')
    }
    const onMove = (e) => {
      if (!down) return
      const t = performance.now()
      const dx = e.clientX - lastX
      movedRef.current += Math.abs(dx)
      el.scrollLeft -= dx
      vel = (dx / Math.max(1, t - lastT)) * 16
      lastX = e.clientX
      lastT = t
    }
    const end = () => {
      if (!down) return
      down = false
      el.classList.remove('uc-grabbing')
      if (reduced()) return
      const step = () => {
        vel *= 0.94
        if (Math.abs(vel) < 0.35) return
        el.scrollLeft -= vel
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  // Si hubo arrastre real, el click que lo sigue no debe abrir un universo.
  const onClickCapture = (e) => {
    if (movedRef.current > 8) {
      e.stopPropagation()
      e.preventDefault()
      movedRef.current = 0
    }
  }

  const enter = useCallback((i) => setHover(i), [])
  const leave = useCallback(() => setHover(null), [])
  const abrir = useCallback((slug) => navigate(`/animes/${slug}`), [navigate])

  const hov = hover != null ? layout.nodes[hover] : null

  return (
    <div style={{ position: 'relative' }}>
      <style>{CSS}</style>
      <div
        ref={scrollerRef}
        className="uc-scroller"
        onClickCapture={onClickCapture}
        aria-label="Mapa de constelaciones de universos; desplázate horizontalmente"
        style={{
          height: 'calc(100vh - 4.5rem)',
          minHeight: 640,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', width: W, height: H, flex: '0 0 auto', margin: '0 auto' }}>
          <svg width={W} height={H} aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
            {layout.stars.map((s, i) => (
              <circle
                key={`s${i}`}
                className={s.tw ? 'uc-tw' : undefined}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill="var(--color-gold)"
                opacity={s.o}
                style={s.tw ? { animationDelay: `${s.d}s` } : undefined}
              />
            ))}
            {layout.edges.map((e, i) => {
              const A = layout.nodes[e.a]
              const B = layout.nodes[e.b]
              const lit = hover != null && (e.a === hover || e.b === hover)
              const warm = hov != null && hov.g === e.g
              return (
                <line
                  key={`e${i}`}
                  className="uc-line"
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke="var(--color-gold)"
                  strokeWidth="1"
                  strokeOpacity={lit ? 0.55 : warm ? 0.26 : 0.1}
                />
              )
            })}
          </svg>

          {layout.labels.map((L, i) => (
            <div
              key={`l${i}`}
              aria-hidden="true"
              lang="ja"
              style={{
                position: 'absolute',
                left: L.x,
                top: L.y,
                transform: 'translate(-50%,-50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontFamily: JP, fontWeight: 700, fontSize: 96, lineHeight: 1, color: 'var(--color-gold)', opacity: 0.07 }}>
                {L.k}
              </div>
              <div lang="es" style={{ fontFamily: MONO, fontSize: 10, marginTop: 6, color: TEXT_DIM, opacity: 0.7 }}>
                {L.name}
              </div>
            </div>
          ))}

          {layout.nodes.map((n, i) => (
            <Node key={n.slug} n={n} i={i} onEnter={enter} onLeave={leave} onOpen={abrir} />
          ))}

          {/* Virtualización simple: solo el tooltip del nodo activo existe. */}
          {hov && (
            <div
              className="uc-tip"
              role="status"
              style={{
                position: 'absolute',
                left: Math.max(130, Math.min(W - 130, hov.x)),
                top: hov.y < 140 ? hov.y + (hov.top ? 32 : 24) + 12 : hov.y - (hov.top ? 32 : 24) - 12,
                transform: hov.y < 140 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 13px',
                background: 'var(--color-surface)',
                border: '1px solid color-mix(in srgb, var(--color-gold) 28%, transparent)',
                borderRadius: 8,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 6,
              }}
            >
              <span aria-hidden="true" lang="ja" style={{ fontFamily: JP, fontWeight: 700, fontSize: 18, lineHeight: 1, color: 'var(--color-gold)' }}>
                {layout.labels[hov.g]?.k}
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-fg-strong)' }}>{hov.name}</span>
                <span style={{ display: 'block', marginTop: 2, fontFamily: MONO, fontSize: 11, color: 'var(--color-gold)' }}>
                  {hov.chars} personajes
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 16,
          bottom: 14,
          fontFamily: MONO,
          fontSize: 11,
          color: TEXT_DIM,
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      >
        ← arrastra para explorar →
      </div>
    </div>
  )
}

export default UniverseConstellation
