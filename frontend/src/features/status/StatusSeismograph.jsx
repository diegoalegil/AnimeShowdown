import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotionPref } from '../../hooks/useReducedMotionPref'

/**
 * StatusSeismograph — electrocardiograma de latencia para /status.
 *
 * Cada tick de polling = un latido: el canvas desplaza su propio backbuffer
 * (drawImage sobre sí mismo) y SOLO se pinta la franja nueva, así el coste
 * por frame es casi nulo. El trazo cambia cian/oro/carmesí según umbrales
 * leídos de los tokens en runtime (getComputedStyle), nunca hex literales.
 *
 * El kanji 健 late en sincronía con cada muestra: scale 1→1.06 + halo de
 * opacity (capa radial pre-renderizada con cross-fade — cero blur/filter,
 * que es lo que mata la composición en WebKit). El latido ES el estado:
 * latido cian = nominal · latido oro = degradado · flatline roja = incidencia.
 *
 * prefers-reduced-motion: sin scroll ni pulso — polyline estática de las
 * últimas muestras, redibujada una vez por tick. El loop (rAF + polling) se
 * pausa fuera del viewport y con la pestaña oculta.
 *
 * Props:
 *   ping        async () => ({ latencyMs, status })  — obligatoria
 *   intervalMs  cadencia de polling (default 15000 — /api/status no cachea)
 *   thresholds  { warnMs, critMs } (default 250/600)
 *   height      alto del canvas CSS px (default 132)
 */

function readTokens(el) {
  const cs = getComputedStyle(el)
  const t = (name, fb) => (cs.getPropertyValue(name) || '').trim() || fb
  return {
    ok: t('--color-electric', 'currentColor'),
    warn: t('--color-gold', 'currentColor'),
    crit: t('--color-accent-text', 'currentColor'),
    grid: t('--color-border', 'currentColor'),
  }
}

/** Perfil QRS de un latido: offsets verticales (px lógicos) por columna. */
function beatProfile(amp) {
  const w = 26
  const out = new Float32Array(w)
  for (let i = 0; i < w; i += 1) {
    const p = i / (w - 1)
    let v = 0
    if (p < 0.18) v = -0.14 * Math.sin((p / 0.18) * Math.PI) // onda P
    else if (p < 0.3) v = 0.22 * Math.sin(((p - 0.18) / 0.12) * Math.PI) // Q
    else if (p < 0.46) v = -Math.sin(((p - 0.3) / 0.16) * Math.PI) // R (pico)
    else if (p < 0.6) v = 0.3 * Math.sin(((p - 0.46) / 0.14) * Math.PI) // S
    else if (p < 0.86) v = -0.18 * Math.sin(((p - 0.6) / 0.26) * Math.PI) // T
    out[i] = v * amp
  }
  return out
}

function StatusSeismograph({
  ping,
  intervalMs = 15000,
  thresholds = null,
  height = 132,
  label = 'Latencia API',
}) {
  const { warnMs, critMs } = thresholds ?? { warnMs: 250, critMs: 600 }
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engine = useRef({
    queue: [], qi: 0, color: '', lastY: null, carry: 0,
    raf: 0, timer: 0, visible: true, tokens: null, dpr: 1, tickPx: 0,
  })
  const samplesRef = useRef([]) // últimas muestras (para reduced-motion)
  const [latest, setLatest] = useState(null)
  const [beat, setBeat] = useState(false)
  const reduced = useReducedMotionPref()

  const toneOf = useCallback((s) => {
    if (!s || s.status !== 'UP' || s.latencyMs >= critMs) return 'crit'
    return s.latencyMs >= warnMs ? 'warn' : 'ok'
  }, [warnMs, critMs])

  /* ---- dibujo ---- */

  const baseline = useCallback(() => Math.round(height * 0.62), [height])

  const drawColumn = useCallback((ctx, w, e) => {
    // 1 columna nueva en el borde derecho; el resto ya se desplazó.
    const y0 = baseline()
    e.tickPx += 1
    ctx.fillStyle = e.tokens.grid
    ctx.globalAlpha = 0.16
    if (e.tickPx % 18 === 0) ctx.fillRect(w - 1, 0, 1, height) // rejilla ECG
    ctx.globalAlpha = 0.35
    ctx.fillRect(w - 1, y0, 1, 1) // línea base
    ctx.globalAlpha = 1
    let y = y0
    if (e.qi < e.queue.length) {
      y = y0 + e.queue[e.qi]
      e.qi += 1
      ctx.strokeStyle = e.color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(w - 1.5, e.lastY ?? y0)
      ctx.lineTo(w - 0.5, y)
      ctx.stroke()
    }
    e.lastY = y
  }, [baseline, height])

  const drawStatic = useCallback(() => {
    // reduced-motion: polyline simple de las últimas muestras, sin animación.
    const canvas = canvasRef.current
    const e = engine.current
    if (!canvas || !e.tokens) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width / e.dpr
    ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0)
    ctx.clearRect(0, 0, w, height)
    const data = samplesRef.current.slice(-48)
    if (data.length < 2) return
    const max = Math.max(critMs * 1.2, ...data.map((s) => s.latencyMs || 0))
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 1; i < data.length; i += 1) {
      const x1 = ((i - 1) / (data.length - 1)) * w
      const x2 = (i / (data.length - 1)) * w
      const yOf = (s) => height - 14 - ((s.latencyMs || 0) / max) * (height - 34)
      const tone = toneOf(data[i])
      ctx.strokeStyle = e.tokens[tone]
      ctx.beginPath()
      ctx.moveTo(x1, yOf(data[i - 1]))
      ctx.lineTo(x2, yOf(data[i]))
      ctx.stroke()
    }
  }, [critMs, height, toneOf])

  /* ---- ciclo de vida ---- */

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const e = engine.current
    e.tokens = readTokens(wrap)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      e.dpr = dpr
      const w = wrap.clientWidth
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      e.lastY = null
      if (reduced) drawStatic()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    let hidden = document.hidden
    const io = new IntersectionObserver(([entry]) => {
      e.visible = entry.isIntersecting
    })
    io.observe(wrap)
    const onVis = () => { hidden = document.hidden }
    document.addEventListener('visibilitychange', onVis)

    // --- polling (un latido por muestra) ---
    let alive = true
    const poll = async () => {
      if (!alive) return
      if (e.visible && !hidden) {
        try {
          const sample = await ping()
          if (!alive) return
          samplesRef.current.push(sample)
          if (samplesRef.current.length > 240) samplesRef.current.shift()
          setLatest(sample)
          const tone = sample.status === 'UP' && sample.latencyMs < critMs
            ? (sample.latencyMs >= warnMs ? 'warn' : 'ok') : 'crit'
          e.color = e.tokens[tone]
          if (sample.status !== 'UP') {
            e.queue = new Float32Array(26) // flatline: sin latido
          } else {
            const amp = 14 + Math.min(sample.latencyMs / critMs, 1.4) * (height * 0.34)
            e.queue = beatProfile(amp)
          }
          e.qi = 0
          if (sample.status === 'UP') {
            setBeat(true)
            window.setTimeout(() => alive && setBeat(false), 300)
          }
          if (reduced) drawStatic()
        } catch { /* el siguiente tick reintenta */ }
      }
      e.timer = window.setTimeout(poll, intervalMs)
    }
    poll()

    // --- scroll del backbuffer (solo si hay movimiento permitido) ---
    let prev = performance.now()
    const SPEED = 34 // px/s
    const frame = (now) => {
      e.raf = requestAnimationFrame(frame)
      const dt = Math.min(now - prev, 100)
      prev = now
      if (!e.visible || hidden) return
      e.carry += (SPEED * dt) / 1000
      const cols = Math.floor(e.carry)
      if (cols <= 0) return
      e.carry -= cols
      const ctx = canvas.getContext('2d')
      const w = canvas.width / e.dpr
      for (let i = 0; i < cols; i += 1) {
        // traslada el backbuffer 1px y pinta solo la columna nueva
        ctx.drawImage(canvas, -1 * e.dpr, 0)
        ctx.clearRect(w - 1, 0, 1, height)
        drawColumn(ctx, w, e)
      }
    }
    if (!reduced) e.raf = requestAnimationFrame(frame)

    return () => {
      alive = false
      cancelAnimationFrame(e.raf)
      window.clearTimeout(e.timer)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ping, intervalMs, warnMs, critMs, height, reduced, drawColumn, drawStatic])

  /* ---- render ---- */

  const tone = toneOf(latest)
  const toneText = tone === 'ok' ? 'text-electric' : tone === 'warn' ? 'text-gold' : 'text-accent-text'
  const toneVar = tone === 'ok' ? 'var(--color-electric)' : tone === 'warn' ? 'var(--color-gold)' : 'var(--color-accent-text)'
  const stateWord = !latest ? 'escuchando'
    : latest.status !== 'UP' ? 'incidencia'
      : latest.latencyMs >= critMs ? 'crítico'
        : latest.latencyMs >= warnMs ? 'degradado' : 'nominal'

  return (
    <figure ref={wrapRef} className="relative overflow-hidden rounded-lg border border-border bg-bg/60">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <figcaption className="flex items-center gap-3">
          {/* Kanji 健: el latido ES el estado. Halo = capa radial estática con cross-fade de opacity. */}
          <span className="relative inline-flex h-11 w-11 items-center justify-center" aria-hidden="true">
            <span
              className="absolute inset-0 rounded-full transition-opacity duration-300 ease-out"
              style={{
                background: `radial-gradient(circle, ${toneVar} 0%, transparent 70%)`,
                opacity: beat && !reduced ? 0.5 : 0.14,
              }}
            />
            <span
              lang="ja"
              className={`font-kanji-serif relative text-2xl font-black ${toneText} transition-transform duration-300 ease-out`}
              style={{ transform: beat && !reduced ? 'scale(1.06)' : 'scale(1)' }}
            >
              健
            </span>
          </span>
          <span className="text-[12px] font-black text-fg-muted">{label}</span>
        </figcaption>
        <p className="flex items-baseline gap-2 font-mono tabular-nums">
          <span className={`text-2xl font-black ${latest?.status === 'UP' ? 'text-fg-strong' : 'text-accent-text'}`}>
            {latest?.status === 'UP' ? Math.round(latest.latencyMs) : '——'}
          </span>
          <span className="text-[11px] text-fg-muted">ms</span>
          <span className={`text-[11px] font-bold ${toneText}`}>{stateWord}</span>
        </p>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        role="img"
        aria-label={`Electrocardiograma de latencia. Última muestra: ${latest ? `${Math.round(latest.latencyMs)} ms, ${stateWord}` : 'sin datos'}`}
      />
      <div className="flex items-center gap-4 border-t border-white/5 px-4 py-2 font-mono text-[10px] text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-px w-4 bg-electric" aria-hidden="true" /> &lt;{warnMs} ms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-px w-4 bg-gold" aria-hidden="true" /> &lt;{critMs} ms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-px w-4 bg-accent-text" aria-hidden="true" /> incidencia
        </span>
        <span className="ml-auto">{intervalMs / 1000}s/tick</span>
      </div>
    </figure>
  )
}

export default StatusSeismograph
