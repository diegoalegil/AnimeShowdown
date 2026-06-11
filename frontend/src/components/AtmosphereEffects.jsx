import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Efectos atmosfericos canvas para reforzar el feel cinematografico de
 * cada seccion del producto. Cada efecto:
 *
 * - Es solo decorativo: pointer-events-none + aria-hidden.
 * - Respeta prefers-reduced-motion: si el usuario lo tiene activado, el
 *   canvas queda en negro transparente sin animacion (cero coste CPU).
 * - Pausa cuando esta offscreen via IntersectionObserver — evita gastar
 *   GPU en heroes que ya no se ven.
 * - Cap de particulas por instancia para no fundir mobiles antiguos.
 * - Cleanup completo en unmount: cancel raf, observer.disconnect, ctx.
 *
 * Patron de uso (composable):
 *   <VisualPageShell visual={...}>
 *     <SakuraPetals density="normal" />
 *     <Embers tone="amber" />
 *     <MistDrift />
 *     ...
 *   </VisualPageShell>
 */

function useReducedMotion() {
  // Lazy initializer: computa el valor inicial DURANTE el primer render
  // (no via setState desde un useEffect, que dispara un re-render extra y
  // que ESLint marca como anti-patron en React 19 con la regla
  // react-hooks/set-state-in-effect).
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
  return reduced
}

function useVisible(ref) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}

function usePageVisible() {
  const [pageVisible, setPageVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState !== 'hidden'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const update = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return pageVisible
}

function useCanvasResize(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [canvasRef])
}

/**
 * Petalos de sakura cayendo con drift lateral + rotacion. Cada petalo
 * es una elipse rosa-carmesi con leve gradient para sensacion 3D.
 *
 * <p>density: 'low' (12 petalos) | 'normal' (24) | 'high' (40).
 * <p>tone: 'rose' (default carmesi anime), 'pink' (mas claro), 'gold'.
 */
export function SakuraPetals({ density = 'normal', tone = 'rose' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const reduced = useReducedMotion()
  const visible = useVisible(containerRef)
  const pageVisible = usePageVisible()
  useCanvasResize(canvasRef)

  const count = density === 'low' ? 12 : density === 'high' ? 40 : 24
  // useMemo para que el array de colores no cambie en cada render — sin
  // esto el useEffect de abajo recrea petalos cada render, perdiendo el
  // estado de animacion. ESLint react-hooks/exhaustive-deps lo flagea.
  const colors = useMemo(
    () =>
      ({
        rose: ['rgb(220 80 110)', 'rgb(180 50 80)', 'rgb(155 30 60)'],
        pink: ['rgb(244 114 182)', 'rgb(219 39 119)', 'rgb(190 24 93)'],
        gold: ['rgb(217 169 95)', 'rgb(180 130 60)', 'rgb(140 95 30)'],
      }[tone] ?? ['rgb(220 80 110)', 'rgb(180 50 80)', 'rgb(155 30 60)']),
    [tone],
  )

  useEffect(() => {
    if (reduced || !visible || !pageVisible) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const petals = Array.from({ length: count }).map(() => ({
      x: Math.random() * (canvas.clientWidth || 1),
      y: Math.random() * (canvas.clientHeight || 1) - (canvas.clientHeight || 0),
      r: 4 + Math.random() * 7,
      vy: 0.4 + Math.random() * 0.9,
      vx: -0.4 + Math.random() * 0.8,
      rot: Math.random() * Math.PI * 2,
      vrot: -0.02 + Math.random() * 0.04,
      color: colors[Math.floor(Math.random() * colors.length)],
      sway: Math.random() * Math.PI * 2,
      swayAmp: 0.6 + Math.random() * 0.9,
    }))

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 16.6667
      last = now
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      for (const p of petals) {
        p.sway += 0.02 * dt
        p.x += (p.vx + Math.sin(p.sway) * p.swayAmp * 0.3) * dt
        p.y += p.vy * dt
        p.rot += p.vrot * dt
        if (p.y > h + 20) {
          p.y = -20
          p.x = Math.random() * w
        }
        if (p.x < -30) p.x = w + 20
        if (p.x > w + 30) p.x = -20
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = 0.55
        ctx.fillStyle = p.color
        // Elipse rotada — forma de pétalo simple
        ctx.beginPath()
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduced, visible, pageVisible, count, colors])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

/**
 * Brasas/cenizas flotando hacia arriba con glow. Ideal para escenas
 * de fuego (Demon Slayer), forja (Fullmetal), batalla intensa.
 *
 * <p>tone: 'amber' (default brasas), 'crimson' (fuego rojo), 'violet' (curse JJK).
 * <p>density: 'low' | 'normal' | 'high'.
 */
export function Embers({ density = 'normal', tone = 'amber' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const reduced = useReducedMotion()
  const visible = useVisible(containerRef)
  const pageVisible = usePageVisible()
  useCanvasResize(canvasRef)

  const count = density === 'low' ? 20 : density === 'high' ? 60 : 38

  useEffect(() => {
    if (reduced || !visible || !pageVisible) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const palette = {
      amber: [
        { core: 'rgb(255 200 100)', halo: 'rgb(180 80 30)' },
        { core: 'rgb(255 170 70)', halo: 'rgb(160 60 20)' },
      ],
      crimson: [
        { core: 'rgb(255 120 90)', halo: 'rgb(180 30 20)' },
        { core: 'rgb(255 60 60)', halo: 'rgb(140 10 10)' },
      ],
      violet: [
        { core: 'rgb(190 130 255)', halo: 'rgb(100 40 180)' },
        { core: 'rgb(160 100 240)', halo: 'rgb(80 20 160)' },
      ],
      cyan: [
        { core: 'rgb(120 220 255)', halo: 'rgb(40 130 200)' },
        { core: 'rgb(160 240 255)', halo: 'rgb(60 150 220)' },
      ],
    }[tone] ?? [
      { core: 'rgb(255 200 100)', halo: 'rgb(180 80 30)' },
    ]

    const make = () => {
      const c = palette[Math.floor(Math.random() * palette.length)]
      return {
        x: Math.random() * canvas.clientWidth,
        y: canvas.clientHeight + Math.random() * 80,
        r: 1.3 + Math.random() * 2.6,
        vy: -0.5 - Math.random() * 1.2,
        vx: -0.25 + Math.random() * 0.5,
        sway: Math.random() * Math.PI * 2,
        life: 0,
        maxLife: 200 + Math.random() * 200,
        color: c,
      }
    }
    const embers = Array.from({ length: count }, make)

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 16.6667
      last = now
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < embers.length; i++) {
        const p = embers[i]
        p.life += dt
        p.sway += 0.03 * dt
        p.x += (p.vx + Math.sin(p.sway) * 0.3) * dt
        p.y += p.vy * dt
        if (p.y < -10 || p.life > p.maxLife) {
          embers[i] = make()
          continue
        }
        const fade = Math.min(1, p.life / 30) * Math.min(1, (p.maxLife - p.life) / 60)
        const a = 0.75 * fade
        // Halo exterior blurry
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
        gr.addColorStop(0, p.color.core)
        gr.addColorStop(0.4, p.color.halo)
        gr.addColorStop(1, 'rgb(0 0 0 / 0)')
        ctx.globalAlpha = a * 0.45
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
        ctx.fill()
        // Núcleo
        ctx.globalAlpha = a
        ctx.fillStyle = p.color.core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduced, visible, pageVisible, count, tone])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

/**
 * Niebla deslizandose lateralmente. SVG con feTurbulence + animacion
 * CSS — cero JS por frame. tone: 'cold' (azulado JJK) | 'warm' (calido).
 */
export function MistDrift({ tone = 'cold', intensity = 'normal' }) {
  const opacity = intensity === 'soft' ? 0.18 : intensity === 'strong' ? 0.42 : 0.28
  const color = tone === 'warm' ? 'rgb(180 100 60)' : 'rgb(120 140 200)'
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        className="absolute -left-[10%] top-0 h-full w-[120%]"
        preserveAspectRatio="none"
        viewBox="0 0 1200 600"
      >
        <defs>
          <filter id="as-mist-turbulence">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.022" numOctaves="2" seed="3" />
            <feColorMatrix
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0.7 0"
            />
          </filter>
          <radialGradient id="as-mist-fade" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="as-mist-drift" style={{ animation: 'as-mist-pan 28s linear infinite' }}>
          <rect
            x="-200"
            y="0"
            width="1600"
            height="600"
            fill="url(#as-mist-fade)"
            filter="url(#as-mist-turbulence)"
            opacity={opacity}
          />
        </g>
        <style>{`
          @keyframes as-mist-pan {
            0%   { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-200px, 0, 0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .as-mist-drift { animation: none !important; }
          }
        `}</style>
      </svg>
    </div>
  )
}

/**
 * Aurora de conic-gradient pre-horneada. Antes el conic llevaba un
 * filter blur(40-80px) permanente (bajo una clase de rotacion que no
 * existia): WebKit mantenia una capa filtrada a tamano de hero por
 * instancia — coste de raster puro sin movimiento. Los conics viven en
 * index.css (.as-aurora-conic-*) con paradas suaves que reproducen la
 * difusion del blur; la intensidad se mapea a opacity (composited).
 * El tono violeta se retiro (tell de glow morado): los presets que lo
 * usaban pasan a la familia de marca.
 */
export function AuroraGlow({ tone = 'carmine', intensity = 'normal' }) {
  const toneClass = tone === 'gold' ? 'as-aurora-conic-gold' : 'as-aurora-conic-carmine'
  const opacity = intensity === 'soft' ? 0.7 : intensity === 'strong' ? 1 : 0.85
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className={`absolute inset-0 ${toneClass}`} style={{ opacity }} />
    </div>
  )
}

/**
 * Lluvia de kanjis estilo Matrix muy sutiles — easter egg que solo se
 * ve si miras con calma. Density baja por defecto, 12 columnas max.
 */
export function KanjiRain({ density = 'low', glyphs = '戦闘決勝影神鬼龍刃魂' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const reduced = useReducedMotion()
  const visible = useVisible(containerRef)
  const pageVisible = usePageVisible()
  useCanvasResize(canvasRef)

  const columns = density === 'low' ? 8 : density === 'high' ? 18 : 12

  useEffect(() => {
    if (reduced || !visible || !pageVisible) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const chars = Array.from(glyphs)

    const cols = Array.from({ length: columns }).map((_, i) => ({
      x: (canvas.clientWidth / columns) * (i + 0.5) + (-10 + Math.random() * 20),
      y: -Math.random() * canvas.clientHeight,
      speed: 0.4 + Math.random() * 0.6,
      glyph: chars[Math.floor(Math.random() * chars.length)],
      lastSwap: 0,
    }))

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 16.6667
      last = now
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      ctx.font = '24px "JetBrains Mono", monospace'
      ctx.textBaseline = 'top'
      for (const c of cols) {
        c.y += c.speed * dt
        c.lastSwap += dt
        if (c.lastSwap > 30) {
          c.glyph = chars[Math.floor(Math.random() * chars.length)]
          c.lastSwap = 0
        }
        if (c.y > h + 30) {
          c.y = -30
          c.speed = 0.4 + Math.random() * 0.6
        }
        const fade = Math.max(0.05, 1 - c.y / h)
        ctx.globalAlpha = 0.18 * fade
        ctx.fillStyle = 'rgb(255 70 110)'
        ctx.fillText(c.glyph, c.x, c.y)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduced, visible, pageVisible, columns, glyphs])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

/**
 * Red de constelacion: puntos en grid distorsionado conectados con
 * lineas tenues que pulsan. Ideal para /animes (catalogo de
 * universos como nodos de una red) o ranking (jerarquia visual).
 */
export function ConstellationNetwork({ density = 'normal', tone = 'gold' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const reduced = useReducedMotion()
  const visible = useVisible(containerRef)
  const pageVisible = usePageVisible()
  useCanvasResize(canvasRef)

  const count = density === 'low' ? 30 : density === 'high' ? 80 : 50
  const linkDist = 140

  useEffect(() => {
    if (reduced || !visible || !pageVisible) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const color = tone === 'crimson' ? '255 70 110' : tone === 'cyan' ? '120 220 255' : '197 161 90'

    const nodes = Array.from({ length: count }).map(() => ({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      vx: -0.18 + Math.random() * 0.36,
      vy: -0.18 + Math.random() * 0.36,
      pulse: Math.random() * Math.PI * 2,
    }))

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 16.6667
      last = now
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      // Líneas
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        a.x += a.vx * dt
        a.y += a.vy * dt
        a.pulse += 0.03 * dt
        if (a.x < 0 || a.x > w) a.vx *= -1
        if (a.y < 0 || a.y > h) a.vy *= -1
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < linkDist) {
            const alpha = (1 - d / linkDist) * 0.16
            ctx.strokeStyle = `rgb(${color} / ${alpha})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      // Nodos
      for (const n of nodes) {
        const r = 1.2 + Math.sin(n.pulse) * 0.5 + 0.8
        ctx.globalAlpha = 0.55
        ctx.fillStyle = `rgb(${color})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduced, visible, pageVisible, count, tone])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

/**
 * Relampago ocasional para escenas dramaticas (errores, torneos
 * intensos). Spam-safe: solo dispara cada 8-15s con flash blanco
 * que cae a transparente en 200ms.
 */
export function LightningStrike({ minInterval = 8000, maxInterval = 15000 }) {
  const [flash, setFlash] = useState(0)
  const reduced = useReducedMotion()
  const pageVisible = usePageVisible()
  useEffect(() => {
    if (reduced || !pageVisible) return
    let active = true
    let timer
    const flashTimers = []
    const schedule = () => {
      if (!active) return
      const delay = minInterval + Math.random() * (maxInterval - minInterval)
      timer = setTimeout(() => {
        setFlash(1)
        flashTimers.push(setTimeout(() => setFlash(0.35), 80))
        flashTimers.push(setTimeout(() => setFlash(0), 220))
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      active = false
      clearTimeout(timer)
      flashTimers.forEach(clearTimeout)
    }
  }, [reduced, pageVisible, minInterval, maxInterval])
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(circle at 25% 18%, rgb(255 255 255 / ${flash * 0.55}), transparent 38%)`,
        transition: 'background 90ms linear',
      }}
    />
  )
}

/**
 * Wrapper para activar varios efectos por preset semantico. Util para
 * que las paginas no tengan que importar cada efecto individual.
 *
 * Presets:
 *  - 'demon-slayer'   → embers crimson + sakura rose (fuego + petalos)
 *  - 'jujutsu-kaisen' → mist cold + embers violet (curse energy)
 *  - 'naruto'         → embers amber + sakura gold (chakra leaf village)
 *  - 'one-piece'      → mist warm + aurora gold (mar dorado)
 *  - 'fullmetal'      → embers amber + sparks
 *  - 'attack-on-titan' → mist cold + embers crimson (humo + guerra)
 *  - 'arena'          → aurora carmine + constellation gold (hero general)
 *  - 'arena-storm'    → mist + lightning (votar/duelos)
 *  - 'ritual'         → sakura gold + aurora violet (omikuji)
 *  - 'arcane'         → constellation cyan + kanji-rain (juegos)
 *  - 'archive'        → constellation gold (animes catalog)
 *  - 'tribute'        → aurora gold + constellation (ranking)
 */
export function AtmospherePreset({ preset }) {
  switch (preset) {
    case 'demon-slayer':
      return (
        <>
          <Embers tone="crimson" density="normal" />
          <SakuraPetals tone="rose" density="low" />
        </>
      )
    case 'jujutsu-kaisen':
      return (
        <>
          <MistDrift tone="cold" intensity="normal" />
          <Embers tone="violet" density="low" />
        </>
      )
    case 'naruto':
      return (
        <>
          <Embers tone="amber" density="normal" />
          <SakuraPetals tone="gold" density="low" />
        </>
      )
    case 'one-piece':
      return (
        <>
          <MistDrift tone="warm" intensity="soft" />
          <AuroraGlow tone="gold" intensity="soft" />
        </>
      )
    case 'fullmetal':
      return <Embers tone="amber" density="high" />
    case 'attack-on-titan':
      return (
        <>
          <MistDrift tone="cold" intensity="strong" />
          <Embers tone="crimson" density="low" />
        </>
      )
    case 'chainsaw-man':
      return (
        <>
          <Embers tone="crimson" density="high" />
          <LightningStrike minInterval={10000} maxInterval={20000} />
        </>
      )
    case 'arena':
      return (
        <>
          <AuroraGlow tone="carmine" intensity="normal" />
          <ConstellationNetwork tone="gold" density="low" />
        </>
      )
    case 'arena-storm':
      return (
        <>
          <MistDrift tone="cold" intensity="soft" />
          <LightningStrike />
        </>
      )
    case 'ritual':
      return (
        <>
          <SakuraPetals tone="rose" density="normal" />
          <AuroraGlow tone="gold" intensity="soft" />
        </>
      )
    case 'arcane':
      return (
        <>
          <ConstellationNetwork tone="cyan" density="normal" />
          <KanjiRain density="low" />
        </>
      )
    case 'forest':
      // Niebla baja + luciérnagas ámbar = bosque nocturno. Las identidades
      // con theme 'emerald' (Aoashi, Black Clover, …) declaraban esta
      // atmósfera y el case no existía → 10 series renderizaban sin
      // atmósfera en silencio (default: null).
      return (
        <>
          <MistDrift tone="cold" intensity="soft" />
          <Embers tone="amber" density="low" />
        </>
      )
    case 'archive':
      return <ConstellationNetwork tone="gold" density="normal" />
    case 'tribute':
      return (
        <>
          <AuroraGlow tone="gold" intensity="soft" />
          <ConstellationNetwork tone="gold" density="low" />
        </>
      )
    default:
      return null
  }
}
