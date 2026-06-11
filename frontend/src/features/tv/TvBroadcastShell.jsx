import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import TvKatanaCut from './TvKatanaCut'

/**
 * TvBroadcastShell — paquete broadcast del Modo TV.
 *
 * Sustituye los blobs de aurora + cards de cristal por un tratamiento de
 * retransmisión deportiva japonesa:
 *  1. Corte katana entre vistas (ver TvKatanaCut).
 *  2. Lower-third dorado: kanji contextual + nombre, wipe de transform.
 *  3. Ticker inferior de ELO en vivo (cinta translateX infinita, pausada
 *     con pestaña oculta; reduced-motion ⇒ estático paginado).
 *  4. Bug de esquina: wordmark + kanji 戦.
 *  5. Scene del banco de marca con scrim como fondo de cada vista.
 *
 * Requisitos previos (una sola vez):
 *  - El keyframe as-tv-ticker vive en index.css. Los rótulos usan la
 *    display Kessen (AS Display) — la nota original pedía Geist, el tell
 *    tipográfico viejo: descartada.
 *
 * Uso (desde TvModePage):
 *   const VISTAS = [
 *     { id: 'top10', etiqueta: 'Top 10 ELO', kanji: '王',
 *       scene: sceneDeMarca('jujutsu-kaisen'),
 *       lowerThird: { kanji: '王', titulo: lider.nombre, sub: `Nº 1 · ${lider.elo} ELO · ${lider.anime}` },
 *       render: () => <VistaTop10 top10={top10} /> },
 *     ...
 *   ]
 *   <TvBroadcastShell vistas={VISTAS} idx={vistaIdx} movers={movers} />
 *
 * El shell NO posee el timer de rotación si recibe `idx` controlado; si no,
 * rota solo cada `segundos` (pausado con la pestaña oculta).
 */

/** Fondo de vista: scene del banco de marca + scrim de legibilidad. */
export function VistaScene({ scene, alineacion = 'izquierda', children }) {
  const scrimX =
    alineacion === 'centro'
      ? 'linear-gradient(90deg, color-mix(in srgb, var(--color-canvas) 85%, transparent), color-mix(in srgb, var(--color-canvas) 40%, transparent) 30%, color-mix(in srgb, var(--color-canvas) 40%, transparent) 70%, color-mix(in srgb, var(--color-canvas) 85%, transparent))'
      : 'linear-gradient(90deg, color-mix(in srgb, var(--color-canvas) 95%, transparent), color-mix(in srgb, var(--color-canvas) 78%, transparent) 40%, color-mix(in srgb, var(--color-canvas) 40%, transparent) 72%, color-mix(in srgb, var(--color-canvas) 60%, transparent))'
  return (
    <div className="absolute inset-0 overflow-hidden bg-bg">
      {scene && (
        <img
          src={scene}
          alt=""
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
      )}
      <div className="absolute inset-0" style={{ background: scrimX }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-canvas) 55%, transparent), color-mix(in srgb, var(--color-canvas) 5%, transparent) 30%, color-mix(in srgb, var(--color-canvas) 75%, transparent))',
        }}
      />
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}

/** Lower-third dorado: kanji contextual + nombre en la display, wipe de transform. */
function LowerThird({ vista }) {
  const reducido = useReducedMotion()
  const lt = vista.lowerThird
  if (!lt) return null
  return (
    <div className="pointer-events-none absolute bottom-20 left-4 z-40 overflow-hidden pt-1.5 sm:bottom-24 sm:left-[4vw]">
      <motion.div
        key={vista.id}
        className="flex items-stretch will-change-transform"
        initial={reducido ? { opacity: 0 } : { x: '-103%' }}
        animate={reducido ? { opacity: 1 } : { x: 0 }}
        transition={
          reducido
            ? { duration: 0.3 }
            : { delay: 0.08, duration: 0.46, ease: [0.16, 0.84, 0.28, 1] }
        }
      >
        <div className="grid w-12 flex-none place-items-center border border-gold/50 bg-accent text-2xl font-black text-gold-pale sm:w-[72px] sm:text-4xl [font-family:var(--font-kanji-serif)]">
          {lt.kanji}
        </div>
        <div className="flex flex-col justify-center gap-0.5 border border-l-0 border-gold/35 border-t-2 border-t-gold bg-bg/90 py-2 pl-4 pr-6 sm:py-2.5 sm:pr-7">
          <p className="whitespace-nowrap text-lg font-semibold leading-tight tracking-tight text-fg-strong sm:text-3xl font-display">
            {lt.titulo}
          </p>
          <p className="whitespace-nowrap text-[11px] text-fg-muted sm:text-sm">{lt.sub}</p>
        </div>
      </motion.div>
    </div>
  )
}

/** Un mover del ticker: ▲/▼ + nombre + ELO en mono oro. */
function MoverItem({ m }) {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap">
      {/* La flecha solo con delta REAL (hoy el catálogo cliente no trae
          histórico): el rank en mono ocupa su lugar. */}
      {m.delta != null ? (
        <span
          className={`font-mono text-sm font-bold ${m.delta >= 0 ? 'text-gold-bright' : 'text-accent-hover'}`}
        >
          {m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta)}
        </span>
      ) : (
        <span className="font-mono text-sm font-bold text-gold-bright">{String(m.rank).padStart(2, '0')}</span>
      )}
      <span className="text-[15px] font-semibold text-fg-strong">{m.nombre}</span>
      <span className="font-mono text-[15px] font-bold text-gold">{m.elo}</span>
    </div>
  )
}

/**
 * Ticker de ELO en vivo. Cinta translateX infinita (dos copias, -50%).
 * Pausada con la pestaña oculta; reduced-motion ⇒ estático paginado.
 */
function TickerElo({ movers }) {
  const reducido = useReducedMotion()
  const [oculta, setOculta] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [pagVisible, setPagVisible] = useState(true)

  useEffect(() => {
    const onVis = () => setOculta(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Paginación solo en modo estático
  useEffect(() => {
    if (!reducido) return undefined
    const id = setInterval(() => {
      if (document.hidden) return
      setPagVisible(false)
      setTimeout(() => {
        setPagina((p) => p + 1)
        setPagVisible(true)
      }, 320)
    }, 6000)
    return () => clearInterval(id)
  }, [reducido])

  const porPagina = 3
  const nPaginas = Math.max(1, Math.ceil(movers.length / porPagina))
  const visibles = useMemo(() => {
    const ini = (pagina % nPaginas) * porPagina
    return movers.slice(ini, ini + porPagina)
  }, [movers, pagina, nPaginas])

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex h-12 items-stretch border-t border-gold/40 bg-bg/95 sm:h-16">
      <div className="flex flex-none items-center gap-2 border-r border-gold/30 bg-accent-soft px-3 sm:gap-3 sm:px-6">
        <span className="text-base font-black text-gold sm:text-lg [font-family:var(--font-kanji-serif)]">
          速報
        </span>
        <span className="hidden whitespace-nowrap text-[13px] font-semibold text-fg-strong sm:inline">
          ELO en vivo
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        {reducido ? (
          <div
            className="flex items-center gap-10 pl-6 transition-opacity duration-300"
            style={{ opacity: pagVisible ? 1 : 0 }}
          >
            {visibles.map((m) => (
              <MoverItem key={m.slug} m={m} />
            ))}
          </div>
        ) : (
          <div
            className="flex w-max items-center gap-12 pl-12 will-change-transform"
            style={{
              animation: 'as-tv-ticker 42s linear infinite',
              animationPlayState: oculta ? 'paused' : 'running',
            }}
          >
            {[...movers, ...movers].map((m, i) => (
              <MoverItem key={`${m.slug}-${i}`} m={m} />
            ))}
          </div>
        )}
      </div>
      <p className="hidden flex-none items-center border-l border-white/10 px-6 font-mono text-xs text-fg-muted sm:flex">
        animeshowdown.dev
      </p>
    </div>
  )
}

function TvBroadcastShell({
  vistas,
  movers = [],
  idx: idxControlado,
  segundos = 12,
  onVistaChange,
}) {
  const [idxInterno, setIdxInterno] = useState(0)
  const idx = idxControlado ?? idxInterno
  const vista = vistas[idx % vistas.length]
  const timer = useRef(null)

  // Rotación propia solo si nadie controla `idx`; pausada con pestaña oculta.
  useEffect(() => {
    if (idxControlado != null) return undefined
    const programar = () => {
      timer.current = setTimeout(() => {
        if (!document.hidden) {
          setIdxInterno((v) => {
            const sig = (v + 1) % vistas.length
            onVistaChange?.(sig)
            return sig
          })
        }
        programar()
      }, segundos * 1000)
    }
    programar()
    return () => clearTimeout(timer.current)
  }, [idxControlado, segundos, vistas.length, onVistaChange])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-bg text-fg">
      {/* Corte katana entre vistas; cada render lleva su scene + scrim */}
      <TvKatanaCut
        className="absolute inset-0"
        viewKey={vista.id}
        render={(key) => {
          const v = vistas.find((x) => x.id === key) ?? vista
          return (
            <VistaScene scene={v.scene} alineacion={v.alineacion}>
              {v.render()}
            </VistaScene>
          )
        }}
      />

      {/* Rótulo de segmento */}
      <div className="absolute left-4 top-4 z-40 flex items-center gap-3 sm:left-[4vw] sm:top-[3vw]">
        <span className="font-mono text-[13px] font-bold text-gold">
          {String(idx + 1).padStart(2, '0')} / {String(vistas.length).padStart(2, '0')}
        </span>
        <span className="h-4 w-px bg-gold/45" />
        <span className="text-[15px] font-semibold text-fg-strong">{vista.etiqueta}</span>
      </div>

      {/* Bug de esquina: wordmark + 戦. Es también la salida del Modo TV. */}
      <Link
        to="/"
        aria-label="Salir del Modo TV"
        className="absolute right-4 top-4 z-40 flex items-center gap-3 opacity-85 transition-opacity hover:opacity-100 sm:right-[4vw] sm:top-[3vw]"
      >
        <div className="flex flex-col items-end">
          <span className="text-base font-bold tracking-tight text-fg-strong">AnimeShowdown</span>
          <span className="font-mono text-[11px] text-fg-muted">Modo TV · salir</span>
        </div>
        <div className="grid h-10 w-10 place-items-center border border-gold/45 bg-bg/60 text-xl font-bold text-gold [font-family:var(--font-kanji-serif)]">
          戦
        </div>
      </Link>

      <LowerThird vista={vista} />
      <TickerElo movers={movers} />
    </div>
  )
}

export default TvBroadcastShell
