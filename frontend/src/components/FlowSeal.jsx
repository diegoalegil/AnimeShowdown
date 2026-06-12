import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FLOWSEAL_EASE, FLOWSEAL_TIMING } from './flow-seal-timing'

/**
 * FlowSeal — familia de micro-sellos para los finales de flujo por email.
 *
 *   <FlowSeal variant="exito" />    結 · lacre dorado que asienta sobre la carta + brillo especular (1 pasada)
 *   <FlowSeal variant="enviado" />  送 · sobre con sello que se parte en dos mitades (±3 px) dejando ver el mensaje
 *   <FlowSeal variant="error" />    破 · lacre carmesí apagado con hairline de fractura (sin rojo semántico)
 *
 * Integración:
 *   - NewsletterConfirmarPage: ok → exito · error → error
 *   - ForgotPasswordPage:      enviado=true → enviado
 *   (VerifyPage tiene su propia ceremonia, el hanko 認 de VerifySeal;
 *    ResetPassword hace toast+redirect — sin pantalla que sellar.)
 *
 * Reglas Kessen que cumple:
 *   - Solo transform/opacity, una pasada, fill both, cero loops (nada que pausar fuera de viewport).
 *   - Sin blur, sin SVG filters, sin animar geometría. Clips del split ESTÁTICOS; solo se trasladan los grupos.
 *   - prefers-reduced-motion (useReducedMotion) → estados finales directos, duración 0.
 *   - Cero hex/rgb en JSX: tokens var(--color-*) y color-mix sobre tokens para sombreados.
 *   - Kanji real con significado vía var(--font-kanji-serif).
 *     破 entra en los subsets de AS Display con esta pieza (regenerados juntos).
 *
 * Escalera de tiempos compartida (misma curva --ease-lift en las tres):
 *   0–550 ms  asentado del lacre (scale 1.45 → 0.965 → 1 + opacity)
 *   430–1030  evento del variante (brillo / separación / fractura)
 *   560–1100  señales secundarias (hairline, filo eléctrico, carta asomando 7 px)
 */


const KANJI_STACK = 'var(--font-kanji-serif)'

// ---------------------------------------------------------------------------
// Geometría determinista (módulo, no por render): blob de lacre y fractura.
// ---------------------------------------------------------------------------

function blobPath(cx, cy, r, seed) {
  const n = 10
  const amp = 0.085
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rad = r * (1 + amp * Math.sin(i * 2.7 + seed) + amp * 0.6 * Math.sin(i * 5.1 + seed * 1.7))
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)])
  }
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return `${d} Z`
}

function crackPaths(cx, cy, r) {
  const main = [[0.16, -0.95], [0.02, -0.55], [0.22, -0.18], [-0.08, 0.05], [0.1, 0.42], [-0.06, 0.68], [-0.2, 0.95]]
  const branch = [[-0.08, 0.05], [-0.34, 0.18], [-0.55, 0.44]]
  const toPath = (pts) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${(cx + p[0] * r).toFixed(1)} ${(cy + p[1] * r).toFixed(1)}`).join(' ')
  return { main: toPath(main), branch: toPath(branch) }
}

// ---------------------------------------------------------------------------
// Cuerpo de lacre compartido: sombra + blob con degradado de tokens + anillo
// + kanji embebido (copia clara desplazada 1.4 px = relieve de presión).
// ---------------------------------------------------------------------------

function WaxBody({ id, cx, cy, r, seed, kanji, fontSize, hi, base, ink, muted = false }) {
  const d = blobPath(cx, cy, r, seed)
  return (
    <>
      <defs>
        <radialGradient id={`${id}-wax`} cx="0.36" cy="0.3" r="0.92">
          <stop offset="0%" style={{ stopColor: hi }} />
          <stop offset="60%" style={{ stopColor: base }} />
          <stop offset="100%" style={{ stopColor: base }} />
        </radialGradient>
        <radialGradient id={`${id}-shade`} cx="0.42" cy="0.36" r="0.95">
          <stop offset="55%" style={{ stopColor: 'var(--color-canvas)' }} stopOpacity="0" />
          <stop offset="100%" style={{ stopColor: 'var(--color-canvas)' }} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <path d={d} transform="translate(0 3.5)" style={{ fill: 'color-mix(in srgb, var(--color-canvas) 60%, transparent)' }} />
      <path d={d} fill={`url(#${id}-wax)`} />
      <path d={d} fill={`url(#${id}-shade)`} />
      {muted && <path d={d} style={{ fill: 'color-mix(in srgb, var(--color-bg) 20%, transparent)' }} />}
      <circle cx={cx} cy={cy} r={r * 0.68} fill="none" style={{ stroke: 'color-mix(in srgb, var(--color-canvas) 35%, transparent)' }} strokeWidth="1.4" />
      <text x={cx} y={cy + 1.4} textAnchor="middle" dominantBaseline="central" lang="ja"
        style={{ fontFamily: KANJI_STACK, fill: 'color-mix(in srgb, var(--color-fg-strong) 16%, transparent)' }} fontWeight="700" fontSize={fontSize}>
        {kanji}
      </text>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" lang="ja"
        style={{ fontFamily: KANJI_STACK, fill: ink }} fontWeight="700" fontSize={fontSize}>
        {kanji}
      </text>
    </>
  )
}

// Carta de fondo compartida por éxito y error (familia = misma escenografía).
function LetterScenery() {
  return (
    <g>
      <rect x="34" y="30" width="192" height="120" rx="12" className="fill-surface-alt stroke-border" />
      <rect x="52" y="52" width="68" height="5" rx="2.5" opacity="0.12" style={{ fill: 'var(--color-fg)' }} />
      <rect x="52" y="70" width="86" height="5" rx="2.5" opacity="0.09" style={{ fill: 'var(--color-fg)' }} />
      <rect x="52" y="88" width="58" height="5" rx="2.5" opacity="0.09" style={{ fill: 'var(--color-fg)' }} />
      <rect x="52" y="118" width="42" height="5" rx="2.5" opacity="0.28" style={{ fill: 'var(--color-gold)' }} />
    </g>
  )
}

// Asentado compartido: scale 1.45 → 0.965 → 1 con --ease-lift, una pasada.
function pressProps(reduce) {
  return {
    initial: reduce ? false : { scale: 1.45, opacity: 0 },
    animate: reduce ? { scale: 1, opacity: 1 } : { scale: [1.45, 0.965, 1], opacity: [0, 1, 1] },
    transition: reduce ? { duration: 0 } : { ...FLOWSEAL_TIMING.press, ease: FLOWSEAL_EASE },
    style: { transformBox: 'fill-box', transformOrigin: '50% 50%' },
  }
}

// ---------------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------------

function ExitoSeal({ id, reduce, onComplete }) {
  const cx = 162
  const cy = 100
  const r = 37
  const d = blobPath(cx, cy, r, 2.3)
  return (
    <svg viewBox="0 0 260 180" width="100%" role="img" aria-label="Sellado: lacre dorado asentado sobre la carta">
      <LetterScenery />
      <motion.g {...pressProps(reduce)} onAnimationComplete={onComplete}>
        <WaxBody id={id} cx={cx} cy={cy} r={r} seed={2.3} kanji="結" fontSize={33}
          hi="var(--color-gold-bright)" base="var(--color-gold)" ink="color-mix(in srgb, var(--color-canvas) 62%, var(--color-gold))" />
        <defs>
          <clipPath id={`${id}-clip`}><path d={d} /></clipPath>
          <linearGradient id={`${id}-spec`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--color-fg-strong)' }} stopOpacity="0" />
            <stop offset="50%" style={{ stopColor: 'var(--color-fg-strong)' }} stopOpacity="0.6" />
            <stop offset="100%" style={{ stopColor: 'var(--color-fg-strong)' }} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Brillo especular: UNA pasada de una banda clipada al blob; solo translate+opacity. */}
        {!reduce && (
          <g clipPath={`url(#${id}-clip)`}>
            <g transform={`rotate(18 ${cx} ${cy})`}>
              <motion.rect x={cx - 19} y={cy - r - 14} width="38" height={2 * r + 28} fill={`url(#${id}-spec)`}
                initial={{ x: -(2 * r), opacity: 0 }}
                animate={{ x: 2 * r, opacity: [0, 0.9, 0.9, 0] }}
                transition={{ ...FLOWSEAL_TIMING.event, times: [0, 0.14, 0.6, 1], ease: 'easeOut' }} />
            </g>
          </g>
        )}
      </motion.g>
    </svg>
  )
}

function EnviadoSeal({ id, reduce, onComplete }) {
  const cx = 130
  const cy = 136
  const r = 24
  const wax = (suffix) => (
    <WaxBody id={`${id}${suffix}`} cx={cx} cy={cy} r={r} seed={4.1} kanji="送" fontSize={21}
      hi="var(--color-fg)" base="var(--color-fg-muted)" ink="color-mix(in srgb, var(--color-canvas) 70%, var(--color-fg-muted))" />
  )
  const half = (dir) => ({
    initial: reduce ? false : { x: 0 },
    animate: { x: 3 * dir },
    transition: reduce
      ? { duration: 0 }
      : { delay: 0.5, duration: 0.45, ease: FLOWSEAL_EASE },
  })
  // Filo eléctrico en las caras internas del split: señal puntual, 1 px.
  const edge = (xOff) => (
    <motion.line x1={cx + xOff} y1={cy - r * 0.85} x2={cx + xOff} y2={cy + r * 0.85}
      strokeWidth="1" style={{ stroke: 'var(--color-electric)' }}
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 0.55 }}
      transition={reduce ? { duration: 0 } : { delay: 0.64, duration: 0.3 }} />
  )
  return (
    <svg viewBox="0 0 260 190" width="100%" role="img" aria-label="Enviado: el sello del sobre se parte dejando ver el mensaje">
      {/* La carta asoma 7 px tras el split; solo translateY. */}
      <motion.g initial={reduce ? false : { y: 0 }} animate={{ y: -7 }}
        transition={reduce ? { duration: 0 } : { delay: 0.52, duration: 0.5, ease: FLOWSEAL_EASE }}>
        <rect x="64" y="64" width="132" height="80" rx="8" style={{ fill: 'var(--color-fg-strong)', stroke: 'color-mix(in srgb, var(--color-canvas) 40%, transparent)' }} />
        <rect x="78" y="72" width="64" height="4" rx="2" style={{ fill: 'color-mix(in srgb, var(--color-bg) 35%, transparent)' }} />
        <rect x="78" y="81" width="46" height="4" rx="2" style={{ fill: 'color-mix(in srgb, var(--color-bg) 22%, transparent)' }} />
        <rect x="176" y="71" width="11" height="11" rx="2" opacity="0.85" style={{ fill: 'var(--color-gold)' }} />
      </motion.g>
      <rect x="40" y="92" width="180" height="78" rx="10" className="fill-surface stroke-border" />
      <polygon points="41,93 219,93 130,147" strokeLinejoin="round" className="fill-surface-alt stroke-border" />
      <motion.g {...pressProps(reduce)} onAnimationComplete={onComplete}>
        {/* Clips ESTÁTICOS: dos rects fijos; lo único que se mueve son los grupos internos. */}
        <clipPath id={`${id}-l`}><rect x={cx - r - 10} y={cy - r - 10} width={r + 10} height={2 * r + 20} /></clipPath>
        <clipPath id={`${id}-r`}><rect x={cx} y={cy - r - 10} width={r + 10} height={2 * r + 20} /></clipPath>
        <g clipPath={`url(#${id}-l)`}>
          <motion.g {...half(-1)}>
            {wax('a')}
            {edge(-0.6)}
          </motion.g>
        </g>
        <g clipPath={`url(#${id}-r)`}>
          <motion.g {...half(1)}>
            {wax('b')}
            {edge(0.6)}
          </motion.g>
        </g>
      </motion.g>
    </svg>
  )
}

function ErrorSeal({ id, reduce, onComplete }) {
  const cx = 162
  const cy = 100
  const r = 37
  const cracks = crackPaths(cx, cy, r * 0.96)
  const hairline = (path, opacity, delay, width) => (
    <motion.path d={path} fill="none" strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"
      style={{ stroke: 'var(--color-fg-strong)' }}
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity }}
      transition={reduce ? { duration: 0 } : { delay, duration: FLOWSEAL_TIMING.secondary.duration }} />
  )
  return (
    <svg viewBox="0 0 260 180" width="100%" role="img" aria-label="Error: lacre carmesí agrietado con una fractura fina">
      <LetterScenery />
      <motion.g {...pressProps(reduce)} onAnimationComplete={onComplete}>
        {/* Cesión al agrietarse: micro-rotación de ida y vuelta, una pasada. */}
        <motion.g
          initial={false}
          animate={reduce ? { rotate: 0 } : { rotate: [0, -1.5, 0.8, 0] }}
          transition={reduce ? { duration: 0 } : { delay: 0.47, duration: 0.42, times: [0, 0.38, 0.66, 1], ease: [0.36, 0.07, 0.19, 0.97] }}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
          {/* Carmesí de marca apagado (muted) — nunca el --color-danger genérico. */}
          <WaxBody id={id} cx={cx} cy={cy} r={r} seed={3.6} kanji="破" fontSize={33} muted
            hi="var(--color-accent-hover)" base="var(--color-accent)" ink="color-mix(in srgb, var(--color-canvas) 60%, var(--color-accent))" />
          {hairline(cracks.main, 0.38, 0.56, 1.1)}
          {hairline(cracks.branch, 0.22, 0.7, 0.9)}
        </motion.g>
      </motion.g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

const VARIANTS = { exito: ExitoSeal, enviado: EnviadoSeal, error: ErrorSeal }

/**
 * @param {object} props
 * @param {'exito' | 'enviado' | 'error'} props.variant — estado del final de flujo.
 * @param {number} [props.size] — ancho en px (alto proporcional al viewBox 260×180/190).
 * @param {string} [props.className]
 * @param {() => void} [props.onComplete] — se dispara al terminar el asentado del lacre.
 */
function FlowSeal({ variant = 'exito', size = 246, className = '', onComplete }) {
  const reduce = useReducedMotion()
  const id = `fs-${useId().replace(/:/g, '')}`
  const Seal = VARIANTS[variant] ?? ExitoSeal
  return (
    <div className={`mx-auto ${className}`} style={{ width: '100%', maxWidth: size }}>
      <Seal id={id} reduce={Boolean(reduce)} onComplete={onComplete} />
    </div>
  )
}

export default FlowSeal
