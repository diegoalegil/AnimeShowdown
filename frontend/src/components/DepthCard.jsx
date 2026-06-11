import { useEffect, useRef, useState } from 'react'

/**
 * DepthCard — carta 2.5D de personaje con profundidad por capas.
 *
 * Capas (atrás → delante):
 *   1. fondo   : escena desenfocada (la imagen normal del personaje, blur),
 *                parallax INVERTIDO (±tiltBg)
 *   2. media   : marco de la carta dibujado en CSS con tokens (kanji del
 *                universo, hairline interior, placa de legibilidad, tics)
 *   3. frontal : el RECORTE del personaje (frontend/img/cuts) que SOBRESALE
 *                del marco por arriba —rompe el marco— (±tiltFront) + glare
 *                diagonal enmascarado a la silueta del recorte
 *
 * Motor: rAF coalescado, mismo patrón que PersonajeCardHolo/TiltCard — los
 * eventos solo escriben el target; un único rAF interpola y escribe
 * transform/opacity vía refs. Nada de width/top por frame.
 * Reposo: respiración de la capa frontal (scale 1↔1.008, 4 s, keyframe
 * as-depth-breathe en index.css).
 * prefers-reduced-motion: carta estática — sin listeners, sin respiración,
 * sin glare.
 * Móvil: DeviceOrientation; en iOS un chip discreto pide el permiso.
 */

const ACCENTS = {
  crimson: 'var(--color-accent)',
  gold: 'var(--color-gold)',
  electric: 'var(--color-electric)',
}

const RADIO = 18 // radio de la carta (px)
const PLACA = '21%' // alto de la placa inferior

const clamp1 = (v) => Math.max(-1, Math.min(1, v))

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cb = (e) => setReduced(e.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])
  return reduced
}

function DepthCard({
  bgSrc = '',
  cutoutSrc,
  name = '—',
  anime = '',
  kanji = '界',
  kanjiMeaning = '',
  rarity = 'crimson',
  tiltFront = 14,
  tiltMid = 6,
  tiltBg = 3,
  glare = 0.35,
  breathe = true,
  width = 340,
  // La placa muestra el nombre con esta etiqueta (p.ej. 'h1' cuando la carta
  // es el titular de la página, como en Descubre).
  nameTag: NameTag = 'p',
  className = '',
}) {
  const accent = ACCENTS[rarity] ?? ACCENTS.crimson

  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const bgRef = useRef(null)
  const midRef = useRef(null)
  const frontRef = useRef(null)
  const glareWrapRef = useRef(null)
  const glareBarRef = useRef(null)
  // iOS exige un gesto explícito para DeviceOrientation: si hace falta
  // permiso se muestra el chip. Evaluable al montar (estado de entorno).
  const [gyroNeeded, setGyroNeeded] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    const DOE = window.DeviceOrientationEvent
    return Boolean(
      DOE &&
        typeof DOE.requestPermission === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
    )
  })
  const gyroAttach = useRef(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return undefined
    const root = rootRef.current
    if (!root) return undefined

    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0 // target / current, normalizados [-1, 1]
    let gT = 0
    let gC = 0 // glare target / current
    let raf = 0
    let dead = false

    const apply = () => {
      const st = stageRef.current
      const bg = bgRef.current
      const mid = midRef.current
      const fr = frontRef.current
      const gw = glareWrapRef.current
      const gb = glareBarRef.current
      if (!st) return
      st.style.transform = `rotateX(${-cy * 3.2}deg) rotateY(${cx * 3.2}deg)`
      if (bg) bg.style.transform = `translate3d(${-cx * tiltBg}px, ${-cy * tiltBg}px, 0) scale(1.12)`
      if (mid) mid.style.transform = `translate3d(${cx * tiltMid}px, ${cy * tiltMid}px, 0)`
      if (fr) fr.style.transform = `translate3d(${cx * tiltFront}px, ${cy * tiltFront}px, 0)`
      if (gw) gw.style.opacity = String(gC * glare)
      if (gb) gb.style.transform = `translateX(${cx * 260}%) rotate(18deg)`
    }

    const tick = () => {
      raf = 0
      if (dead) return
      cx += (tx - cx) * 0.12
      cy += (ty - cy) * 0.12
      gC += (gT - gC) * 0.1
      apply()
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 || Math.abs(gT - gC) > 0.004) {
        schedule()
      }
    }
    const schedule = () => {
      if (!raf && !dead) raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      const r = root.getBoundingClientRect()
      tx = clamp1(((e.clientX - r.left) / (r.width || 1)) * 2 - 1)
      ty = clamp1(((e.clientY - r.top) / (r.height || 1)) * 2 - 1)
      gT = 1
      schedule()
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      gT = 0
      schedule()
    }

    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)

    // giroscopio en táctil: gamma/beta → mismo canal normalizado del puntero
    const onOri = (e) => {
      if (e.gamma == null || e.beta == null) return
      tx = clamp1(e.gamma / 26)
      ty = clamp1((e.beta - 48) / 26)
      gT = 0.85
      schedule()
    }
    const DOE = window.DeviceOrientationEvent
    const coarse =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    let oriOn = false
    const attachOri = () => {
      if (oriOn) return
      window.addEventListener('deviceorientation', onOri)
      oriOn = true
    }
    gyroAttach.current = attachOri
    // Sin ceremonia de permiso (Android/desktop táctil): escuchar directamente.
    // El caso iOS lo cubre el chip (gyroNeeded, decidido al montar).
    if (coarse && DOE && typeof DOE.requestPermission !== 'function') {
      attachOri()
    }

    return () => {
      dead = true
      if (raf) cancelAnimationFrame(raf)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      if (oriOn) window.removeEventListener('deviceorientation', onOri)
    }
  }, [tiltFront, tiltMid, tiltBg, glare, reduced])

  const askGyro = () => {
    const DOE = window.DeviceOrientationEvent
    if (DOE && typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((estado) => {
          if (estado === 'granted' && gyroAttach.current) {
            gyroAttach.current()
            setGyroNeeded(false)
          }
        })
        .catch(() => {})
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative max-w-full ${className}`}
      style={{ width, aspectRatio: '2 / 3', perspective: '1100px' }}
    >
      <div
        ref={stageRef}
        className="absolute inset-0 shadow-elev-3 will-change-transform"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          borderRadius: RADIO,
        }}
      >
        {/* ── capa 1 · FONDO (escena desenfocada, parallax invertido) ── */}
        <div
          className="absolute inset-0 overflow-hidden bg-surface"
          style={{ borderRadius: RADIO }}
        >
          <div ref={bgRef} className="absolute inset-0 scale-[1.12] will-change-transform">
            {bgSrc ? (
              <img
                src={bgSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                loading="eager"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover blur-[9px] brightness-[0.82] saturate-[0.92]"
              />
            ) : null}
          </div>
          {/* viñeta de legibilidad sobre la escena (mismo gesto que CinematicHero) */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 30%, transparent 55%, color-mix(in srgb, black 55%, transparent) 100%)',
            }}
          />
        </div>

        {/* ── capa 2 · MEDIA (marco CSS con tokens) ── */}
        <div ref={midRef} className="absolute inset-0 will-change-transform">
          {/* kanji del universo, detrás del personaje */}
          <div
            aria-hidden="true"
            lang="ja"
            className="absolute right-[5%] top-[4%] select-none font-bold leading-none"
            style={{
              fontFamily: 'var(--font-jp, serif)',
              fontSize: Math.round(width * 0.4),
              color: `color-mix(in oklab, ${accent} 34%, transparent)`,
            }}
          >
            {kanji}
          </div>
          {/* hairline interior */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[9px] border border-white/[0.07]"
            style={{ borderRadius: RADIO - 8 }}
          />
          {/* placa inferior con scrim de legibilidad */}
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col justify-end gap-1 px-4 pb-3.5"
            style={{
              height: PLACA,
              borderRadius: `0 0 ${RADIO}px ${RADIO}px`,
              background:
                'linear-gradient(to top, color-mix(in srgb, var(--color-bg) 94%, transparent) 30%, color-mix(in srgb, var(--color-bg) 72%, transparent) 68%, transparent)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] flex-none rotate-45"
                style={{ background: accent }}
              />
              <span lang="ja" className="font-mono text-[11px] text-fg-muted">
                {kanji}
                {kanjiMeaning ? ` · ${kanjiMeaning}` : ''}
              </span>
            </div>
            <NameTag
              className="font-bold leading-[1.15] tracking-tight text-fg-strong"
              style={{ fontSize: Math.max(17, Math.round(width * 0.055)) }}
            >
              {name}
            </NameTag>
            <p className="font-mono text-[11.5px] text-fg-muted/70">{anime}</p>
          </div>
          {/* borde del marco */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: RADIO,
              border: `1px solid color-mix(in oklab, ${accent} 50%, transparent)`,
              boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 6%, transparent)',
            }}
          />
          {/* tics de esquina superiores (lenguaje de marco TCG, como CartaFace) */}
          <div
            aria-hidden="true"
            className="absolute -top-px left-3.5 h-[2px] w-[26px] opacity-90"
            style={{ background: accent }}
          />
          <div
            aria-hidden="true"
            className="absolute -top-px right-3.5 h-[2px] w-[26px] opacity-90"
            style={{ background: accent }}
          />
        </div>

        {/* ── capa 3 · FRONTAL (recorte que rompe el marco + glare) ── */}
        <div
          className="pointer-events-none absolute inset-x-0 overflow-hidden"
          style={{ top: '-18%', bottom: PLACA }}
        >
          <div ref={frontRef} className="absolute inset-0 will-change-transform">
            <div
              className="absolute left-[2%] w-[96%] origin-bottom will-change-transform"
              style={{
                bottom: '-6%',
                aspectRatio: '2 / 3',
                animation: breathe && !reduced ? 'as-depth-breathe 4s ease-in-out infinite' : 'none',
              }}
            >
              <img
                src={cutoutSrc}
                alt={name}
                draggable={false}
                loading="eager"
                decoding="async"
                className="absolute inset-0 h-full w-full object-contain object-bottom"
                style={{ filter: 'drop-shadow(0 16px 26px color-mix(in srgb, black 55%, transparent))' }}
              />
              {/* glare diagonal, enmascarado a la silueta del recorte */}
              {!reduced ? (
                <div
                  ref={glareWrapRef}
                  aria-hidden="true"
                  className="absolute inset-0 overflow-hidden opacity-0 mix-blend-screen will-change-[opacity]"
                  style={{
                    WebkitMaskImage: `url("${cutoutSrc}")`,
                    maskImage: `url("${cutoutSrc}")`,
                    WebkitMaskSize: '100% 100%',
                    maskSize: '100% 100%',
                  }}
                >
                  <div
                    ref={glareBarRef}
                    className="absolute left-[22%] top-[-55%] h-[210%] w-[52%] rotate-[18deg] will-change-transform"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, color-mix(in srgb, white 50%, transparent) 50%, transparent)',
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* chip discreto de permiso de giroscopio (solo iOS; sin reduced-motion) */}
      {gyroNeeded && !reduced ? (
        <button
          type="button"
          onClick={askGyro}
          className="absolute right-2.5 z-10 inline-flex min-h-11 items-center rounded-full border bg-bg/80 px-3.5 font-mono text-[11.5px] text-fg backdrop-blur transition-colors hover:text-fg-strong"
          style={{
            bottom: `calc(${PLACA} + 10px)`,
            borderColor: `color-mix(in oklab, ${accent} 60%, transparent)`,
          }}
        >
          activar giroscopio
        </button>
      ) : null}
    </div>
  )
}

export default DepthCard
