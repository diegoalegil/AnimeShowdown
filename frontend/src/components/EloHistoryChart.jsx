import { useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { endpoints } from '../lib/api'
import { formatDateSafe } from '../lib/dateUtils'
import { computarGeometria, W, H, PAD_X } from './elo-history-geometry'

/**
 * Time machine del ELO — v2, instrumento de broadcast.
 *
 * <p>Al entrar al viewport el path se dibuja como pincelada (~900ms,
 * stroke-dashoffset con var(--ease-brush)) con un path fantasma grueso como
 * sangrado de tinta (SOLO opacity — cero filter/blur en runtime). El stroke
 * usa linearGradient carmesí→oro si la pendiente del tramo final (últimos
 * 5 días) es positiva; carmesí puro si baja. El punto final late con un halo
 * solo-opacity (pausado fuera de viewport y con pestaña oculta) y el pico
 * recibe el kanji 頂 al completarse el trazo.
 *
 * <p>Tooltip: pointermove mapea al punto más cercano y actualiza custom props
 * (--tx/--ty/--lx/--tip-o) + textContent vía ref — cero re-renders de React.
 * prefers-reduced-motion: línea pintada estática, tooltip funcional.
 */
function EloHistoryChart({ slug }) {
  const { data, isLoading } = useQuery({
    queryKey: ['personaje', slug, 'elo-history', 30],
    queryFn: () => endpoints.personajeEloHistory(slug, { dias: 30 }),
    enabled: Boolean(slug),
    staleTime: 30 * 60_000,
  })

  const geo = useMemo(() => computarGeometria(data), [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-surface p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }
  if (!geo) return null

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-bold text-fg-strong">ELO últimos 30 días</h2>
        </div>
        <p className="font-mono text-[12px] text-fg-muted tabular-nums">
          <span className={geo.delta > 0 ? 'text-success' : geo.delta < 0 ? 'text-danger' : 'text-fg-muted'}>
            {geo.delta > 0 ? '+' : ''}
            {geo.delta}
          </span>{' '}
          votos · ahora <strong className="text-fg-strong">{geo.actual}</strong>
        </p>
      </div>
      <BrushChart geo={geo} slug={slug} />
      <div className="mt-2 flex justify-between text-[10px] text-fg-muted">
        <span>{formatearFecha(geo.pts[0].fecha)}</span>
        <span>{formatearFecha(geo.pts[geo.pts.length - 1].fecha)}</span>
      </div>
    </div>
  )
}

function BrushChart({ geo, slug }) {
  const wrapRef = useRef(null)
  const mainRef = useRef(null)
  const ghostRef = useRef(null)
  const areaRef = useRef(null)
  const peakRef = useRef(null)
  const endDotRef = useRef(null)
  const haloRef = useRef(null)
  const labelRef = useRef(null)
  const drawnRef = useRef(false)
  const timerRef = useRef(null)

  const dibujar = useCallback(() => {
    const m = mainRef.current
    if (!m) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fin = () => {
      peakRef.current.style.opacity = '1'
      peakRef.current.style.transform = 'translateY(0)'
      endDotRef.current.style.opacity = '1'
      if (!reduced) haloRef.current.style.animationPlayState = 'running'
    }
    if (reduced) {
      m.style.strokeDashoffset = '0'
      ghostRef.current.style.opacity = '0.12'
      areaRef.current.style.opacity = '1'
      fin()
      return
    }
    m.style.animation = 'elo-draw 900ms var(--ease-brush) forwards'
    ghostRef.current.style.opacity = '0.12'
    areaRef.current.style.opacity = '1'
    timerRef.current = setTimeout(fin, 920)
  }, [])

  // Disparo al entrar al viewport + pausa del halo fuera de él / pestaña oculta.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            if (!drawnRef.current) {
              drawnRef.current = true
              dibujar()
            } else if (haloRef.current) {
              haloRef.current.style.animationPlayState = 'running'
            }
          } else if (haloRef.current) {
            haloRef.current.style.animationPlayState = 'paused'
          }
        })
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    const onVis = () => {
      if (haloRef.current && drawnRef.current) {
        haloRef.current.style.animationPlayState = document.hidden ? 'paused' : 'running'
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      clearTimeout(timerRef.current)
    }
  }, [dibujar])

  // Tooltip: custom props + textContent, cero re-renders.
  const onMove = useCallback(
    (e) => {
      const el = wrapRef.current
      const r = el.getBoundingClientRect()
      if (!r.width) return
      const vx = ((e.clientX - r.left) / r.width) * W
      const i = Math.max(
        0,
        Math.min(geo.pts.length - 1, Math.round(((vx - PAD_X) / (W - PAD_X * 2)) * (geo.pts.length - 1))),
      )
      const p = geo.pts[i]
      const tx = (p.x / W) * r.width
      el.style.setProperty('--tx', `${tx.toFixed(1)}px`)
      el.style.setProperty('--ty', `${((p.y / H) * r.height).toFixed(1)}px`)
      el.style.setProperty('--lx', `${Math.max(58, Math.min(r.width - 58, tx)).toFixed(1)}px`)
      el.style.setProperty('--tip-o', '1')
      if (labelRef.current) {
        labelRef.current.textContent = `${p.votos.toLocaleString('es-ES')} · ${formatearFecha(p.fecha)}`
      }
    },
    [geo],
  )
  const onLeave = useCallback(() => {
    wrapRef.current?.style.setProperty('--tip-o', '0')
  }, [])

  const gradId = `elo-grad-${slug}`
  const fillId = `elo-fill-${slug}`
  const pk = geo.pts[geo.peak]
  const last = geo.pts[geo.pts.length - 1]
  const kx = Math.max(22, Math.min(W - 22, pk.x))

  return (
    <div
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="elo-chart-wrap relative cursor-crosshair touch-none"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Evolución de votos de los últimos 30 días, de ${geo.inicial} a ${geo.actual}`}
      >
        <defs>
          {geo.subeAlFinal && (
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="70%" stopColor="var(--color-gold)" />
              <stop offset="100%" stopColor="var(--color-gold-bright)" />
            </linearGradient>
          )}
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Área bajo la línea — aparece con el trazo (solo opacity). */}
        <path
          ref={areaRef}
          d={geo.area}
          fill={`url(#${fillId})`}
          className="opacity-0 transition-opacity duration-700 delay-[350ms]"
        />
        {/* Sangrado de tinta: path grueso pre-renderizado, solo anima opacity. */}
        <path
          ref={ghostRef}
          d={geo.linea}
          stroke="var(--color-accent)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="opacity-0 transition-opacity duration-[900ms] ease-brush"
        />
        {/* Pincelada principal. pathLength=1 evita getTotalLength. */}
        <path
          ref={mainRef}
          d={geo.linea}
          stroke={geo.subeAlFinal ? `url(#${gradId})` : 'var(--color-accent-hover)'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          pathLength="1"
          style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
        />
        {/* Pico máximo — 頂 (cima), aparece tras completarse el trazo. */}
        <g
          ref={peakRef}
          className="opacity-0 transition-[opacity,transform] duration-500 ease-lift"
          style={{ transform: 'translateY(6px)' }}
        >
          <line
            x1={PAD_X}
            x2={pk.x - 6}
            y1={pk.y}
            y2={pk.y}
            stroke="var(--color-border-gold-subtle)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
          <circle cx={pk.x} cy={pk.y} r="2.5" fill="var(--color-gold)" />
          <text
            x={kx}
            y={pk.y - 11}
            textAnchor="middle"
            fill="var(--color-gold)"
            fontSize="19"
            fontWeight="700"
            style={{ fontFamily: 'var(--font-kanji-serif)' }}
          >
            頂
          </text>
        </g>
        {/* Latido del punto final: halo solo-opacity, pausado por defecto. */}
        <circle
          ref={haloRef}
          cx={last.x}
          cy={last.y}
          r="9"
          fill={geo.subeAlFinal ? 'var(--color-gold)' : 'var(--color-accent-hover)'}
          className="elo-halo opacity-0"
        />
        <circle
          ref={endDotRef}
          cx={last.x}
          cy={last.y}
          r="3.5"
          fill={geo.subeAlFinal ? 'var(--color-gold)' : 'var(--color-accent-hover)'}
          className="opacity-0 transition-opacity duration-300"
        />
      </svg>
      {/* Hairline + dot + etiqueta del tooltip — posicionados por custom props. */}
      <div className="elo-tip-line pointer-events-none absolute bottom-3 left-0 top-6 w-px bg-border-gold" />
      <div className="elo-tip-dot pointer-events-none absolute left-0 top-0 h-[7px] w-[7px] rounded-full bg-fg-strong" />
      <div
        ref={labelRef}
        className="elo-tip-label pointer-events-none absolute top-0 whitespace-nowrap rounded-md border border-border-gold-subtle bg-canvas/90 px-2 py-0.5 font-mono text-[11px] text-fg-strong"
      />
    </div>
  )
}

function formatearFecha(iso) {
  return formatDateSafe(iso, { day: '2-digit', month: 'short' })
}

export default EloHistoryChart
