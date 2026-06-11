// PioneersPodium.jsx — Salón de Honor de los Pioneros
//
// Top-3 en pedestales con volumen real (cajas CSS 3D: frente + superior +
// laterales vía translateZ/rotateX/rotateY) en lacado oscuro, placa dorada
// grabada (nombre en la sans del sistema, métrica en mono oro con count-up) y numerales
// caligráficos 一二三 trazados con pathLength al entrar al viewport.
//
// Entrada con dolly: la "cámara" desciende de picado a frontal animando
// rotateX + perspective-origin con un spring largo (~900ms); los retratos
// aterrizan en stagger. Brillo especular de las placas siguiendo al cursor
// vía custom props --mx/--my actualizadas por rAF (cero re-renders).
//
// Dos modos:
//   modo="cinematica" → coreografía completa
//   modo="estatica"   → composición frontal estática ya colocada
//   modo="auto"       → estática si prefers-reduced-motion o viewport < 640px
//
// Reglas de perf del proyecto respetadas: solo transform/opacity, cero
// blur()/backdrop-blur/SVG filters, -webkit-backface-visibility en todas las
// caras, ningún nodo preserve-3d lleva filter/overflow/opacity, y todo loop
// (aura del Senpai, especular) se pausa fuera del viewport y con pestaña
// oculta. Cero libs nuevas: solo framer-motion 12, ya en el bundle.
//

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { animate, motion, useMotionTemplate, useReducedMotion, useSpring } from 'framer-motion'
import Avatar from '../../components/Avatar'

/* ─────────────────────────── constantes ─────────────────────────── */

// Spring del dolly: sub-amortiguado, asienta en ~900ms con leve overshoot.
const RESORTE_DOLLY = { type: 'spring', stiffness: 64, damping: 10, mass: 1 }

// Numerales caligráficos reales 一 (1), 二 (2), 三 (3) — trazos horizontales
// con curvatura de pincel. Se dibujan con pathLength (stroke-dashoffset).
const NUMERALES = [
  [{ d: 'M10 56 C 32 47, 64 45, 90 53', w: 10 }],
  [
    { d: 'M24 36 C 42 31, 62 31, 78 35', w: 8 },
    { d: 'M12 68 C 36 60, 66 60, 90 66', w: 9 },
  ],
  [
    { d: 'M26 28 C 42 24, 60 24, 75 27', w: 7 },
    { d: 'M18 52 C 38 47, 64 47, 83 51', w: 8 },
    { d: 'M10 78 C 34 71, 68 71, 92 77', w: 9 },
  ],
]

// Medallero oficial del podio (tokens de index.css, nada de hex en JSX).
const MEDALLA = [
  { anillo: 'var(--color-medal-gold)', halo: 'var(--color-medal-gold-aura)' },
  { anillo: 'var(--color-medal-silver)', halo: 'var(--color-medal-silver-aura)' },
  { anillo: 'var(--color-medal-bronze)', halo: 'var(--color-medal-bronze-aura)' },
]

// Dimensiones de cada pedestal (w × h × d). clamp = cero desbordes a 390px.
const DIMS = [
  { w: 'clamp(112px, 23vw, 226px)', h: 'clamp(112px, 19vw, 200px)', d: 'clamp(56px, 9.2vw, 108px)', avatar: 'clamp(64px, 11vw, 112px)' },
  { w: 'clamp(100px, 20vw, 198px)', h: 'clamp(90px, 15vw, 150px)', d: 'clamp(52px, 8.5vw, 100px)', avatar: 'clamp(56px, 9.4vw, 94px)' },
  { w: 'clamp(100px, 20vw, 198px)', h: 'clamp(78px, 12.5vw, 118px)', d: 'clamp(52px, 8.5vw, 100px)', avatar: 'clamp(56px, 9.4vw, 88px)' },
]

// Orden de aterrizaje de retratos: campeón primero, luego plata, luego bronce.
const ORDEN_ATERRIZAJE = [0, 1, 2]

/* ─────────────────────────── hooks ─────────────────────────── */

/** Resuelve el modo final: estática con reduced-motion o viewport móvil. */
function useModoResuelto(modo) {
  const reducido = useReducedMotion()
  const [estrecho, setEstrecho] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const f = () => setEstrecho(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  if (modo === 'cinematica') return 'cinematica'
  if (modo === 'estatica') return 'estatica'
  return reducido || estrecho ? 'estatica' : 'cinematica'
}

/** true solo si la sección está en viewport Y la pestaña visible — gate de
 *  todos los loops (aura del Senpai, especular). */
function useLoopsActivos(rootRef) {
  const [activo, setActivo] = useState(false)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let enViewport = false
    let pestanaVisible = !document.hidden
    const sync = () => setActivo(enViewport && pestanaVisible)
    const io = new IntersectionObserver(
      (entries) => { entries.forEach((en) => { enViewport = en.isIntersecting }); sync() },
      { threshold: 0.1 },
    )
    io.observe(root)
    const onVis = () => { pestanaVisible = !document.hidden; sync() }
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [rootRef])
  return activo
}

/** Especular de placas: pointermove → rAF → setProperty('--mx'/'--my').
 *  Escribe custom props directamente en el DOM: cero re-renders de React. */
function useEspecular(rootRef, placasRef, habilitado) {
  useEffect(() => {
    if (!habilitado) return undefined
    const root = rootRef.current
    if (!root) return undefined
    let raf = 0
    let mx = 0
    let my = 0
    const aplicar = () => {
      raf = 0
      placasRef.current.forEach((pl) => {
        if (!pl) return
        const r = pl.getBoundingClientRect()
        pl.style.setProperty('--mx', `${(mx - r.left).toFixed(0)}px`)
        pl.style.setProperty('--my', `${(my - r.top).toFixed(0)}px`)
      })
    }
    const onMove = (e) => {
      mx = e.clientX
      my = e.clientY
      if (!raf) raf = requestAnimationFrame(aplicar)
    }
    root.addEventListener('pointermove', onMove, { passive: true })
    return () => { root.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [rootRef, placasRef, habilitado])
}

/* ─────────────────────────── piezas ─────────────────────────── */

/** Métrica en mono oro con count-up (escribe textContent vía rAF de
 *  framer-motion: el componente no re-renderiza durante la animación). */
function ContadorVotos({ valor, cine }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (!cine) {
      el.textContent = valor.toLocaleString('es-ES')
      return undefined
    }
    const ctrl = animate(0, valor, {
      duration: 0.95,
      delay: 0.62,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (v) => { el.textContent = Math.round(v).toLocaleString('es-ES') },
    })
    return () => ctrl.stop()
  }, [valor, cine])
  return <span ref={ref}>{cine ? 0 : valor.toLocaleString('es-ES')}</span>
}

/** Numeral caligráfico que se traza con stroke-dashoffset al entrar al viewport. */
function NumeralCaligrafico({ indice, cine }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -left-[34%] -top-[36%] h-[92%] w-[92%] -rotate-[4deg] overflow-visible"
    >
      {NUMERALES[indice].map((trazo, i) => (
        <motion.path
          key={trazo.d}
          d={trazo.d}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={trazo.w}
          strokeLinecap="round"
          className="opacity-90"
          initial={cine ? { pathLength: 0 } : false}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: 0.52 + i * 0.11, duration: 0.65, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  )
}

/** Caja 3D lacada: frente + cara superior + laterales. Todas las caras llevan
 *  backface-visibility hidden; el nodo preserve-3d no lleva filter/overflow/opacity. */
function PedestalLacado({ dims, anillo, children }) {
  const cara = 'absolute [backface-visibility:hidden] [-webkit-backface-visibility:hidden]'
  return (
    <div
      className="relative [transform-style:preserve-3d]"
      style={{ width: dims.w, height: dims.h }}
    >
      {/* cara superior — recibe la luz, con canto cálido hacia el frente */}
      <div
        aria-hidden
        className={cara}
        style={{
          left: 0,
          top: '50%',
          width: dims.w,
          height: dims.d,
          marginTop: `calc(${dims.d} / -2)`,
          transform: `rotateX(90deg) translateZ(calc(${dims.h} / 2))`,
          background: 'linear-gradient(180deg, var(--color-surface-alt) 0%, var(--color-surface) 62%, var(--color-gold-soft) 100%)',
        }}
      />
      {/* laterales en sombra */}
      {[-90, 90].map((giro) => (
        <div
          key={giro}
          aria-hidden
          className={`${cara} bg-bg`}
          style={{
            top: 0,
            left: '50%',
            width: dims.d,
            height: dims.h,
            marginLeft: `calc(${dims.d} / -2)`,
            transform: `rotateY(${giro}deg) translateZ(calc(${dims.w} / 2))`,
          }}
        />
      ))}
      {/* frente lacado: base oscura + veta especular diagonal, todo con tokens */}
      <div
        className={`${cara} inset-0 flex items-center justify-center`}
        style={{
          transform: `translateZ(calc(${dims.d} / 2))`,
          background:
            'linear-gradient(105deg, transparent 40%, var(--color-gold-soft) 47%, transparent 56%), linear-gradient(180deg, var(--color-surface-alt) 0%, var(--color-surface) 22%, var(--color-bg) 64%, var(--color-bg) 100%)',
        }}
      >
        {/* canto superior según medalla */}
        <div
          aria-hidden
          className="absolute inset-x-[6%] top-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${anillo} 30%, ${anillo} 70%, transparent)` }}
        />
        {children}
      </div>
    </div>
  )
}

/** Placa dorada grabada: nombre + métrica en mono oro + especular. */
function PlacaGrabada({ voter, rank, cine, regPlaca }) {
  return (
    <div
      ref={regPlaca}
      className="relative w-[82%] overflow-hidden rounded-lg border border-gold/50 px-2 py-2 text-center sm:px-3 sm:py-3"
      style={{
        background: 'linear-gradient(180deg, var(--color-gold-soft), transparent 58%), var(--color-bg)',
        boxShadow: 'inset 0 1px 0 var(--color-gold-soft), 0 3px 8px var(--color-bg)',
      }}
    >
      {/* brillo especular que sigue al cursor (--mx/--my vía rAF) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle 130px at var(--mx, 50%) var(--my, 30%), var(--color-gold-aura-soft), transparent 72%)',
          opacity: 0.4,
        }}
      />
      <p
        className="relative m-0 truncate text-[clamp(11px,1.6vw,16px)] font-bold tracking-[0.01em] text-gold-bright"
        style={{ textShadow: '0 1px 0 var(--color-bg)' }}
      >
        {voter.username}
      </p>
      <p className="relative m-0 mt-1 font-mono text-[clamp(14px,2vw,21px)] font-bold text-gold">
        <ContadorVotos valor={voter.votos} cine={cine} />
        <span className="ml-1.5 text-[clamp(9px,1.1vw,11px)] font-semibold text-fg-muted">votos</span>
      </p>
      <span className="sr-only">Rank #{rank}</span>
    </div>
  )
}

/** Columna del podio: numeral + retrato (aterriza en stagger) + pedestal 3D. */
function ColumnaPodio({ voter, rank, cine, regPlaca }) {
  const dims = DIMS[rank - 1]
  const medalla = MEDALLA[rank - 1]
  return (
    <Link
      to={`/u/${encodeURIComponent(voter.username)}`}
      aria-label={`Rank #${rank} — ${voter.username}, ${voter.votos} votos`}
      className="flex flex-col items-center no-underline [transform-style:preserve-3d]"
    >
      {/* retrato adelantado al plano frontal del pedestal */}
      <div className="relative z-[2] mb-3 sm:mb-4" style={{ transform: `translateZ(calc(${dims.d} / 2 + 2px))` }}>
        <motion.div
          className="relative"
          initial={cine ? { opacity: 0, y: -34, scale: 0.94 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 17, delay: 0.24 + ORDEN_ATERRIZAJE[rank - 1] * 0.13 }}
        >
          <NumeralCaligrafico indice={rank - 1} cine={cine} />
          <div
            className="relative rounded-full"
            style={{
              width: dims.avatar,
              height: dims.avatar,
              boxShadow: `0 0 0 3px ${medalla.anillo}, 0 0 0 8px ${medalla.halo}, 0 16px 30px var(--color-bg)`,
            }}
          >
            <Avatar user={voter} size="100%" className="h-full w-full" />
          </div>
        </motion.div>
      </div>
      <PedestalLacado dims={dims} anillo={medalla.anillo}>
        <PlacaGrabada voter={voter} rank={rank} cine={cine} regPlaca={regPlaca} />
      </PedestalLacado>
    </Link>
  )
}

/** Senpai del mes: retrato enmarcado, UNA pasada de destello y aura carmesí
 *  que respira (solo opacity), pausada fuera de viewport / pestaña oculta. */
function SenpaiDelMes({ senpai, cine, activo }) {
  if (!senpai) return null
  return (
    <section
      aria-label="Senpai del mes"
      className="relative mb-8 flex items-center gap-4 overflow-hidden rounded-2xl border border-gold/30 bg-surface p-4 sm:gap-5 sm:p-5"
      style={{ background: 'linear-gradient(135deg, var(--color-gold-soft), transparent 38%), var(--color-surface)' }}
    >
      {/* aura carmesí que respira — solo opacity */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-11 top-1/2 h-60 w-60 -translate-y-1/2"
        style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 66%)' }}
        animate={cine && activo ? { opacity: [0.16, 0.34, 0.16] } : { opacity: 0.2 }}
        transition={cine && activo ? { duration: 5.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      />
      {/* UNA pasada de destello */}
      {cine && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-y-4 left-0 w-1/3 opacity-60"
          style={{ background: 'linear-gradient(100deg, transparent, var(--color-gold-soft) 50%, transparent)', skewX: -18 }}
          initial={{ x: '-140%' }}
          animate={{ x: '260%' }}
          transition={{ delay: 1.5, duration: 1.05, ease: [0.3, 0.1, 0.2, 1] }}
        />
      )}
      {/* retrato enmarcado en oro */}
      <div
        className="relative shrink-0 rounded-xl p-[5px]"
        style={{ background: 'linear-gradient(160deg, var(--color-gold), var(--color-gold-soft) 55%, var(--color-gold))' }}
      >
        <div className="rounded-[9px] bg-bg p-[3px]">
          <Avatar user={senpai} size={64} className="!rounded-lg" />
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="m-0 text-xs font-bold text-gold">
          <span lang="ja" style={{ fontFamily: 'var(--font-kanji-serif)' }}>先輩</span> · Senpai del mes
        </p>
        <p className="m-0 mt-0.5 truncate text-lg font-extrabold text-fg-strong sm:text-xl">
          <Link to={`/u/${encodeURIComponent(senpai.username)}`} className="hover:underline">
            {senpai.username}
          </Link>
        </p>
        <p className="m-0 mt-0.5 text-[13px] text-fg-muted">
          El predictor más certero de los últimos 30 días ·{' '}
          <strong className="font-mono text-gold">{senpai.aciertos} aciertos</strong>
        </p>
      </div>
    </section>
  )
}

/** Fila plana para el rank 4 en adelante — sin medallas emoji: rank en mono. */
function FilaVoter({ rank, voter }) {
  return (
    <li>
      <Link
        to={`/u/${encodeURIComponent(voter.username)}`}
        aria-label={`Rank #${rank} — ${voter.username}, ${voter.votos} votos`}
        className="group flex items-center gap-3 rounded-lg border border-border/60 bg-surface px-3 py-3 transition-colors hover:border-accent/40 hover:bg-surface-alt sm:gap-4 sm:px-4"
      >
        <span className="w-8 shrink-0 font-mono text-[13px] font-bold text-fg-muted">
          {String(rank).padStart(2, '0')}
        </span>
        <Avatar user={voter} size={34} />
        <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-fg-strong group-hover:text-gold">
          {voter.username}
        </p>
        <p className="m-0 text-right font-mono text-[15px] font-bold text-gold">
          {voter.votos.toLocaleString('es-ES')}
          <span className="ml-1.5 text-[10px] font-semibold text-fg-muted">votos</span>
        </p>
      </Link>
    </li>
  )
}

/* ─────────────────────────── componente principal ─────────────────────────── */

/**
 * @param {{ voters: Array<{username: string, votos: number, avatarUrl?: string}>,
 *           senpai?: { username: string, aciertos: number, avatarUrl?: string } | null,
 *           modo?: 'auto' | 'cinematica' | 'estatica' }} props
 */
export default function PioneersPodium({ voters = [], senpai = null, modo = 'auto' }) {
  const modoFinal = useModoResuelto(modo)
  const cine = modoFinal === 'cinematica'

  const rootRef = useRef(null)
  const placasRef = useRef([])
  const activo = useLoopsActivos(rootRef)
  useEspecular(rootRef, placasRef, cine && activo)

  // Dolly: perspective-origin baja (cámara desciende) en spring sincronizado
  // con el rotateX de la escena. En estática ambos nacen ya en reposo.
  const origenY = useSpring(cine ? 14 : 62, { stiffness: 64, damping: 10, mass: 1 })
  useEffect(() => { if (cine) origenY.set(62) }, [cine, origenY])
  const perspectiveOrigin = useMotionTemplate`50% ${origenY}%`

  const top3 = voters.slice(0, 3)
  // Orden visual plata-oro-bronce
  const columnas = [
    top3[1] && { voter: top3[1], rank: 2 },
    top3[0] && { voter: top3[0], rank: 1 },
    top3[2] && { voter: top3[2], rank: 3 },
  ].filter(Boolean)
  const resto = voters.slice(3)

  return (
    <div ref={rootRef}>
      <SenpaiDelMes senpai={senpai} cine={cine} activo={activo} />

      {top3.length > 0 && (
        <section aria-label="Podio de pioneros" className="relative mb-10">
          {/* pool de luz carmesí tras el podio */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[-6%] left-1/2 h-[62%] w-[min(660px,88%)] -translate-x-1/2"
            style={{ background: 'radial-gradient(ellipse at 50% 100%, var(--color-accent-soft), transparent 68%)' }}
          />

          {/* cámara (perspective) + escena (rotateX con spring) */}
          <motion.div className="relative z-[1]" style={{ perspective: 1300, perspectiveOrigin }}>
            <motion.ol
              className="m-0 flex list-none items-end justify-center gap-3 p-0 pt-12 sm:gap-7 sm:pt-20 [transform-style:preserve-3d]"
              initial={cine ? { rotateX: 38 } : false}
              animate={{ rotateX: 10 }}
              transition={RESORTE_DOLLY}
            >
              {columnas.map(({ voter, rank }, i) => (
                <li key={voter.username} className="[transform-style:preserve-3d]">
                  <ColumnaPodio
                    voter={voter}
                    rank={rank}
                    cine={cine}
                    regPlaca={(el) => { placasRef.current[i] = el }}
                  />
                </li>
              ))}
            </motion.ol>
          </motion.div>

          {/* suelo: hairline dorada + pozo de sombra */}
          <div aria-hidden className="relative z-0 -mt-px">
            <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 4%, var(--color-gold-aura-soft) 50%, transparent 96%)' }} />
            <div className="h-16" style={{ background: 'radial-gradient(ellipse at 50% 0%, var(--color-bg), transparent 72%)' }} />
          </div>
        </section>
      )}

      {resto.length > 0 && (
        <section aria-label="Resto de la tabla">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[13px] font-semibold text-fg-muted">El resto de la liga</h2>
          </div>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {resto.map((voter, i) => (
              <FilaVoter key={voter.username} rank={i + 4} voter={voter} />
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
