/**
 * ChampionSeal.jsx — AnimeShowdown
 * Ceremonia de la apuesta del Bracket Challenge: el usuario elige campeón,
 * los no elegidos caen en cascada dominó, cae el sello hanko 王 y la
 * confirmación se convierte en papeleta. En la resolución: banner dorado
 * (acierto) o sello agrietado + lavado de luto (fallo).
 *
 * Stack: React 19 · framer-motion 12 · Tailwind v4 (tokens del proyecto).
 * Cero hex literales (guard de CI): todo color via tokens / var(--color-*) /
 * color-mix. Solo se animan transform y opacity; los glows son capas
 * PRE-PINTADAS (sombra estática) que cross-fadean opacity. Sin blur nuevo,
 * sin SVG filters. Las dos mitades del sello roto son clips ESTÁTICOS
 * (clip-path fijo) con translateX opuesto. prefers-reduced-motion conmuta
 * estados sin animación (duration 0 + saltos de fase inmediatos).
 *
 * Ubicación sugerida: frontend/src/features/torneos/seal/ChampionSeal.jsx
 *
 * ── TIMELINE (confirmar campeón) ──────────────────────────────────────────
 *
 *   ms    0                ~520+stagger      +270  +370          +1250
 *         ├─ (1) dominó ───────┤
 *         ├─ (2) elegido translateZ ─┤
 *                          ├ (3) hanko cae ┤squash┤settle
 *                                ├──── (4) onda de tinta ────┤
 *                                                       ├─ (5) papeleta ─┤
 *
 *   (1) Cascada dominó: rotateX 74° con transform-origin bottom, perspective
 *       compartida en el grid, spring con rebote corto. Stagger proporcional
 *       a la DISTANCIA en píxeles al elegido (medida con getBoundingClientRect
 *       al confirmar — robusto ante cualquier breakpoint del grid).
 *   (2) El elegido avanza translateZ hacia la cámara (mismo perspective).
 *   (3) Hanko 王: scale 2.6→1 (caída ease-in), squash de impacto
 *       (scaleX 1.12 / scaleY 0.85) y settle con rebote corto.
 *   (4) UNA onda de tinta radial: anillo estático que solo anima
 *       transform: scale + opacity. Single-shot, sin loops.
 *   (5) La barra de confirmación se convierte en papeleta.
 *
 * ── USO ───────────────────────────────────────────────────────────────────
 *
 *   <ChampionSeal
 *     candidatos={finalistas}            // PersonajeMiniDto[] {id, slug, nombre, anime}
 *     prediccion={miPrediccionCampeon}   // {personajeId, fechaISO} | null
 *     resolucion={resultado}             // {ganadorId} | null (torneo FINISHED)
 *     onConfirmar={(personajeId) => aplicarPrediccion.mutateAsync(...)}
 *   />
 *
 *   Si `prediccion` llega del backend, monta directamente en fase papeleta
 *   (sin teatro retroactivo, mismo criterio que BracketReveal en Bracket.jsx).
 */

import { useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import PersonajeCutImg from '../../../components/PersonajeCutImg'
import { EASE_LIFT } from '../../../lib/motion'

/* ── Motion — springs con rebote corto, solo transform/opacity ───────────── */

const FALL_SPRING = { type: 'spring', stiffness: 380, damping: 24, mass: 0.9 }
const RISE_SPRING = { type: 'spring', stiffness: 300, damping: 22, mass: 0.9 }

// ms de stagger por píxel de distancia al elegido (≈45ms por celda).
const STAGGER_POR_PX = 0.45
// La caída del hanko arranca cuando la cascada ya está en el aire.
const HANKO_DELAY_BASE_MS = 520

/** Variants de la cascada. `custom` = delay en segundos para esa carta. */
const dominoVariants = {
  firme: { rotateX: 0, opacity: 1 },
  caida: (delayS) => ({
    rotateX: 74,
    opacity: 0.15,
    transition: {
      rotateX: { ...FALL_SPRING, delay: delayS },
      opacity: { duration: 0.5, ease: 'easeOut', delay: delayS + 0.14 },
    },
  }),
}

const elegidoVariants = {
  firme: { z: 0 },
  avanza: { z: 90, transition: { ...RISE_SPRING, delay: 0.14 } },
}

/* ── Sello hanko (reutilizado por el grande y el de la papeleta) ─────────── */

function SelloHanko({ tam = 92, glifo = '王', tono = 'accent', className = '', style }) {
  // tono 'accent' (carmesí) | 'gold' — siempre tokens, nunca hex.
  const esOro = tono === 'gold'
  return (
    <span
      lang="ja"
      aria-hidden="true"
      className={`grid place-items-center rounded-full border-4 font-black leading-none ${
        esOro ? 'border-gold text-gold-bright' : 'border-accent text-accent-hover'
      } ${className}`}
      style={{
        width: tam,
        height: tam,
        fontSize: tam * 0.46,
        fontFamily: 'var(--font-kanji-serif)',
        background: esOro
          ? 'radial-gradient(circle at 38% 30%, color-mix(in oklab, var(--color-gold) 20%, transparent), transparent 70%)'
          : 'radial-gradient(circle at 38% 30%, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 70%)',
        ...style,
      }}
    >
      {glifo}
    </span>
  )
}

/* ── Fase 3: resolución ───────────────────────────────────────────────────── */

function BannerAcierto({ reduced }) {
  return (
    <motion.div
      className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-gold/60 bg-gold-soft px-4 py-3"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, ease: EASE_LIFT }}
    >
      <span
        lang="ja"
        aria-hidden="true"
        className="text-2xl font-black leading-none text-gold-bright"
        style={{ fontFamily: 'var(--font-kanji-serif)' }}
      >
        王
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-gold-bright">Predicción cumplida</p>
        <p className="text-[11.5px] text-gold/80">Tu campeón se corona. La papeleta vale oro.</p>
      </div>
      {/* UNA pasada de shimmer: gradiente estático, solo translateX. */}
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[45%]"
          style={{
            background:
              'linear-gradient(100deg, transparent, color-mix(in oklab, var(--color-gold-pale) 38%, transparent), transparent)',
          }}
          initial={{ x: '-120%' }}
          animate={{ x: '330%' }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.42 }}
        />
      )}
    </motion.div>
  )
}

/** Sello roto: dos copias con clip-path ESTÁTICO y translateX opuesto. */
const CLIP_IZQ = 'polygon(0% 0%, 58% 0%, 46% 38%, 56% 62%, 42% 100%, 0% 100%)'
const CLIP_DER = 'polygon(58% 0%, 100% 0%, 100% 100%, 42% 100%, 56% 62%, 46% 38%)'

function SelloRoto({ tam = 44, reduced }) {
  const mitad = (clip, x, rot) => (
    <motion.span
      className="absolute inset-0"
      style={{ clipPath: clip }}
      initial={reduced ? false : { x: 0, rotate: 0, opacity: 1 }}
      animate={{ x, rotate: rot, opacity: 0.85 }}
      transition={{ duration: reduced ? 0 : 0.56, ease: EASE_LIFT, delay: reduced ? 0 : 0.06 }}
    >
      <SelloHanko tam={tam} className="border-[3px]" />
    </motion.span>
  )
  return (
    <span className="relative block flex-shrink-0" style={{ width: tam, height: tam }} aria-hidden="true">
      {mitad(CLIP_IZQ, -tam * 0.16, -2)}
      {mitad(CLIP_DER, tam * 0.16, 2.5)}
    </span>
  )
}

/* ── Fase 2: papeleta ─────────────────────────────────────────────────────── */

function Papeleta({ campeon, fecha, resuelta, acierto, reduced }) {
  const fechaTxt = fecha
    ? new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : null
  return (
    <motion.div
      className="flex -rotate-1 items-center gap-3.5 rounded-lg bg-fg-strong px-4 py-3 text-bg shadow-elev-2 sm:gap-4"
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: EASE_LIFT, delay: reduced ? 0 : 0.1 }}
    >
      {resuelta && !acierto ? (
        <SelloRoto reduced={reduced} />
      ) : (
        <span className="relative flex-shrink-0">
          <SelloHanko tam={44} className="-rotate-6 border-[3px]" />
          {/* 王 reencendiéndose en oro al acertar: capa pre-pintada, solo opacity. */}
          {resuelta && acierto && (
            <motion.span
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.85, delay: reduced ? 0 : 0.25 }}
            >
              <SelloHanko
                tam={44}
                tono="gold"
                className="-rotate-6 border-[3px]"
                style={{
                  textShadow: '0 0 22px var(--color-gold-aura)',
                  boxShadow: 'var(--shadow-aura-sm)',
                  ['--aura-color']: 'var(--color-gold-aura-soft)',
                }}
              />
            </motion.span>
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] text-bg/55">papeleta de apuesta · bracket challenge</p>
        <p className="truncate text-base font-extrabold">{campeon.nombre}</p>
        <p className="text-[11px] text-bg/60">{campeon.anime}</p>
      </div>
      <div className="flex flex-shrink-0 flex-col gap-0.5 border-l border-dashed border-bg/35 pl-3.5 text-right">
        {fechaTxt && <span className="font-mono text-[11px] tabular-nums text-bg/75">{fechaTxt}</span>}
        <span className="font-mono text-[10px] text-bg/45">№ {String(campeon.id).padStart(4, '0')}</span>
      </div>
    </motion.div>
  )
}

/* ── Componente principal ─────────────────────────────────────────────────── */

export default function ChampionSeal({ candidatos, prediccion = null, resolucion = null, onConfirmar, puedeApostar = true }) {
  const reduced = useReducedMotion() ?? false

  // Fase local: 'apuesta' → 'sellando' (cascada+hanko) → 'papeleta'.
  // Si ya hay predicción persistida, monta directo en papeleta (sin teatro
  // retroactivo). La resolución viene dada por props.
  const [faseLocal, setFaseLocal] = useState(prediccion ? 'papeleta' : 'apuesta')
  const [seleccion, setSeleccion] = useState(null)
  const [confirmado, setConfirmado] = useState(
    prediccion ? candidatos.find((c) => c.id === prediccion.personajeId) ?? null : null,
  )
  const [fechaSello, setFechaSello] = useState(prediccion?.fechaISO ?? null)

  // Stagger por distancia real en px (medida al confirmar) + posición del
  // hanko sobre el elegido. Refs por candidato, sin re-render.
  const gridRef = useRef(null)
  const cardRefs = useRef(new Map())
  const [coreografia, setCoreografia] = useState(null) // {delays: Map, hanko: {x,y}}

  // El backend resuelve con `acertada` (true/false/null pendiente) — no
  // exponemos ganadorId aquí.
  const resuelta = resolucion?.acertada != null && faseLocal === 'papeleta'
  const acierto = resuelta && resolucion.acertada === true
  const sellando = faseLocal === 'sellando'

  const confirmar = () => {
    if (!seleccion || faseLocal !== 'apuesta') return
    const grid = gridRef.current?.getBoundingClientRect()
    const elegidoEl = cardRefs.current.get(seleccion.id)?.getBoundingClientRect()
    const delays = new Map()
    let hanko = null
    let maxDelayMs = 0
    if (grid && elegidoEl) {
      const cx = elegidoEl.left + elegidoEl.width / 2
      const cy = elegidoEl.top + elegidoEl.height / 2
      hanko = { x: cx - grid.left, y: cy - grid.top - 8 }
      for (const c of candidatos) {
        if (c.id === seleccion.id) continue
        const r = cardRefs.current.get(c.id)?.getBoundingClientRect()
        if (!r) continue
        const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
        const ms = Math.round(d * STAGGER_POR_PX)
        delays.set(c.id, ms / 1000)
        maxDelayMs = Math.max(maxDelayMs, ms)
      }
    }
    setCoreografia({ delays, hanko, hankoDelayS: (HANKO_DELAY_BASE_MS + maxDelayMs) / 1000 })
    setConfirmado(seleccion)
    setFechaSello(new Date().toISOString())
    // Optimista: la ceremonia arranca ya; si el backend rechaza, el caller
    // puede remontar el componente con prediccion=null (key) y toast.
    onConfirmar?.(seleccion.id)
    if (reduced) {
      setFaseLocal('papeleta')
      return
    }
    setFaseLocal('sellando')
  }

  const delayHankoS = coreografia?.hankoDelayS ?? 0.7

  // El hanko notifica el fin de su settle → pasamos a papeleta.
  const onHankoSettled = () => {
    if (faseLocal === 'sellando') {
      setTimeout(() => setFaseLocal('papeleta'), 600)
    }
  }

  const enCeremonia = sellando || faseLocal === 'papeleta'

  // Keyframes del hanko: caída ease-in, squash de impacto, settle con rebote.
  const hankoAnim = useMemo(
    () => ({
      opacity: [0, 1, 1, 1, 1],
      scaleX: [2.6, 1, 1.12, 1, 1],
      scaleY: [2.6, 1, 0.85, 1.04, 1],
      rotate: [-14, -5, -5, -5, -5],
    }),
    [],
  )

  return (
    <section aria-label="Apuesta de campeón" className="flex flex-col gap-4">
      {/* ── Grid de candidatos: perspective COMPARTIDA para la cascada ── */}
      <div className="relative rounded-2xl border border-border/50 bg-bg p-3.5 shadow-elev-2 sm:p-4">
        <div
          ref={gridRef}
          className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-4"
          style={{ perspective: 1100, perspectiveOrigin: '50% 35%' }}
        >
          {candidatos.map((c) => {
            const esElegido = confirmado?.id === c.id
            const cayo = enCeremonia && confirmado && !esElegido
            const sel = seleccion?.id === c.id && faseLocal === 'apuesta'
            return (
              <motion.button
                key={c.id}
                ref={(el) => el && cardRefs.current.set(c.id, el)}
                type="button"
                disabled={faseLocal !== 'apuesta' || !puedeApostar}
                onClick={() => setSeleccion(c)}
                aria-pressed={sel}
                aria-label={`Apostar por ${c.nombre} (${c.anime})`}
                className={`relative block min-h-11 w-full overflow-hidden rounded-xl border bg-surface text-left ${
                  sel || esElegido ? 'border-gold/80' : 'border-border/60'
                }`}
                style={{
                  aspectRatio: '2 / 3',
                  transformOrigin: '50% 100%',
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                }}
                variants={esElegido ? elegidoVariants : dominoVariants}
                custom={cayo ? coreografia?.delays.get(c.id) ?? 0 : 0}
                initial={false}
                animate={
                  reduced
                    ? { opacity: cayo ? 0.15 : 1 }
                    : cayo
                      ? 'caida'
                      : esElegido && enCeremonia
                        ? 'avanza'
                        : 'firme'
                }
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 75% 40% at 50% 92%, color-mix(in oklab, var(--color-accent) 30%, transparent), transparent)',
                  }}
                />
                <PersonajeCutImg
                  slug={c.slug}
                  alt=""
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                />
                <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-bg/95 via-bg/60 to-transparent px-2 pb-1.5 pt-4">
                  <span className="block truncate text-xs font-bold text-fg-strong">{c.nombre}</span>
                  <span className="block truncate text-[9.5px] text-fg-muted">{c.anime}</span>
                </span>
                {/* Badge 王: aparece al seleccionar/confirmar. Solo transform/opacity. */}
                <motion.span
                  aria-hidden="true"
                  lang="ja"
                  className="absolute right-1.5 top-1.5 grid h-5.5 w-5.5 place-items-center rounded-full border border-gold/80 bg-bg/75 text-xs leading-none text-gold-bright"
                  style={{ fontFamily: 'var(--font-kanji-serif)' }}
                  initial={false}
                  animate={{ opacity: sel || esElegido ? 1 : 0, scale: sel || esElegido ? 1 : 0.6 }}
                  transition={{ duration: reduced ? 0 : 0.24, ease: EASE_LIFT }}
                >
                  王
                </motion.span>
              </motion.button>
            )
          })}

          {/* ── Hanko 王 + onda de tinta, sobre el elegido ── */}
          {enCeremonia && coreografia?.hanko && !reduced && (
            <>
              {/* UNA onda de tinta radial (anillo estático, scale+opacity). */}
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute z-[7] rounded-full border-[3px] border-accent/65"
                style={{
                  left: coreografia.hanko.x,
                  top: coreografia.hanko.y,
                  width: 120,
                  height: 120,
                  margin: '-60px 0 0 -60px',
                }}
                initial={{ scale: 0.35, opacity: 0 }}
                animate={{ scale: [0.35, 0.35, 2.4], opacity: [0, 0.55, 0] }}
                transition={{
                  duration: 1.1,
                  times: [0, 0.28, 1],
                  ease: [0, 0, 0.2, 1],
                  delay: delayHankoS + 0.2,
                }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute z-[8]"
                style={{
                  left: coreografia.hanko.x,
                  top: coreografia.hanko.y,
                  width: 92,
                  height: 92,
                  margin: '-46px 0 0 -46px',
                }}
                initial={{ opacity: 0, scaleX: 2.6, scaleY: 2.6, rotate: -14 }}
                animate={hankoAnim}
                transition={{
                  duration: 0.75,
                  times: [0, 0.32, 0.45, 0.7, 1],
                  ease: ['easeIn', 'easeOut', 'easeOut', 'easeOut'],
                  delay: delayHankoS,
                }}
                onAnimationComplete={onHankoSettled}
              >
                <span className="relative block h-full w-full">
                  <SelloHanko tam={92} className="shadow-elev-1" />
                  {/* Relámpago dorado del acierto sobre el sello grande. */}
                  {resuelta && acierto && (
                    <motion.span
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.85, delay: 0.25 }}
                    >
                      <SelloHanko
                        tam={92}
                        tono="gold"
                        style={{
                          textShadow: '0 0 24px var(--color-gold-aura)',
                          boxShadow: 'var(--shadow-aura)',
                          ['--aura-color']: 'var(--color-gold-aura-soft)',
                        }}
                      />
                    </motion.span>
                  )}
                </span>
              </motion.div>
            </>
          )}

          {/* Sello estático para reduced-motion (sin caída ni onda). */}
          {enCeremonia && coreografia?.hanko && reduced && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-[8] -rotate-6"
              style={{
                left: coreografia.hanko.x,
                top: coreografia.hanko.y,
                width: 92,
                height: 92,
                margin: '-46px 0 0 -46px',
              }}
            >
              <SelloHanko tam={92} />
            </span>
          )}

          {/* Lavado de luto del fallo: capa oscura, solo opacity. */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-3.5 z-[6] rounded-2xl bg-bg/60 sm:-inset-4"
            initial={false}
            animate={{ opacity: resuelta && !acierto ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.7 }}
          />
        </div>
      </div>

      {/* ── Liturgia: confirmación → papeleta → resolución ── */}
      <div className="relative">
        {faseLocal === 'apuesta' && puedeApostar && (
          <motion.div
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface px-3.5 py-2.5"
            initial={false}
            animate={{ opacity: seleccion ? 1 : 0.45 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
          >
            <div className="min-w-0">
              <p className="text-[11px] text-fg-muted">Tu campeón</p>
              <p className="truncate text-[15px] font-bold text-fg-strong">
                {seleccion?.nombre ?? 'Elige un candidato'}
              </p>
            </div>
            <button
              type="button"
              onClick={confirmar}
              disabled={!seleccion}
              className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg border border-accent-hover/60 bg-accent px-4.5 py-2.5 text-sm font-bold text-fg-strong transition-colors hover:bg-accent-hover disabled:cursor-not-allowed"
            >
              <span lang="ja" aria-hidden="true" className="leading-none" style={{ fontFamily: 'var(--font-kanji-serif)' }}>
                印
              </span>
              Estampar sello
            </button>
          </motion.div>
        )}

        {faseLocal === 'papeleta' && confirmado && (
          <Papeleta
            campeon={confirmado}
            fecha={fechaSello ?? new Date().toISOString()}
            resuelta={resuelta}
            acierto={acierto}
            reduced={reduced}
          />
        )}
      </div>

      {resuelta && (
        <div aria-live="polite">
          {acierto ? (
            <BannerAcierto reduced={reduced} />
          ) : (
            <motion.div
              className="flex items-center gap-3 rounded-xl border border-border/55 bg-surface px-4 py-3"
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: EASE_LIFT, delay: reduced ? 0 : 0.2 }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-fg">El sello se rompe</p>
                <p className="text-[11.5px] text-fg-muted">Tu campeón cayó antes de la final.</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </section>
  )
}
