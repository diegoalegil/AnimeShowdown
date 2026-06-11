import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { Download, Lock, X } from 'lucide-react'
import CartaFace from './CartaFace'
import PersonajeImg from '../../components/PersonajeImg'

/**
 * Vitrina 3D del álbum: estanterías de cristal oscuro en perspectiva con las
 * cartas apoyadas (rotateX), parallax sutil al cursor y vuelo de la carta al
 * centro al hacer click (shared layout de framer-motion). CSS 3D puro, sin
 * WebGL. Las no conseguidas reutilizan el teaser esmerilado del grid.
 *
 * Solo se monta con puntero fino y sin prefers-reduced-motion: CartasPage
 * conserva el grid plano como vista táctil/reduced-motion (el parallax
 * necesita hover y CartaFace es ilegible por debajo de ~100px de ancho).
 *
 * ── Gotcha Safari `preserve-3d` ──────────────────────────────────────────
 * Safari APLANA un nodo con `transform-style: preserve-3d` si ese MISMO nodo
 * declara overflow ≠ visible, filter / backdrop-filter, opacity < 1,
 * clip-path, mask o mix-blend-mode. Reglas aplicadas aquí:
 *   1. Los nodos 3D (escena, estante, carta) llevan SOLO transform +
 *      preserve-3d (con prefijo -webkit-). Nunca overflow/filter/opacity.
 *   2. El recorte redondeado, blurs y scrims viven en HIJOS hoja planos
 *      (CartaFace y el slot esmerilado son hojas: pueden recortar y difuminar).
 *   3. `perspective` se declara en el contenedor padre, nunca como
 *      `transform: perspective(...)` (Safari lo compone distinto).
 * ──────────────────────────────────────────────────────────────────────────
 * 60 fps: solo se animan transform y opacity.
 */

const LEAN_DEG = 8 // inclinación de reposo contra el cristal
const POP_Z = 12 // translateZ máx. del parallax (px)
const PERSPECTIVE = '1200px'

const P3D = { transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }

function CardShowcase({ cartas, onDownload, descargandoId = null, perShelf = 5 }) {
  const [activa, setActiva] = useState(null)

  const estantes = []
  for (let i = 0; i < cartas.length; i += perShelf) {
    estantes.push(cartas.slice(i, i + perShelf))
  }

  return (
    <section aria-label="Vitrina del álbum">
      <div
        className="relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-surface px-4 pb-10 pt-6 sm:px-8"
        style={{ perspective: PERSPECTIVE, perspectiveOrigin: '50% 28%' }}
      >
        {/* iluminación de vitrina: cónico tenue desde arriba — capa PLANA, fuera del árbol 3D */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 0%, transparent 41%, color-mix(in oklab, var(--color-gold) 9%, transparent) 50%, transparent 59%)',
          }}
        />
        <header className="relative mb-12 flex items-baseline gap-3">
          {/* 蔵 = almacén / colección atesorada */}
          <span
            lang="ja"
            aria-hidden="true"
            className="text-3xl leading-none text-gold/80"
            style={{ fontFamily: 'var(--font-kanji-serif)' }}
          >
            蔵
          </span>
          <h3 className="text-sm font-semibold text-fg-muted">Vitrina del álbum</h3>
        </header>
        <div className="flex flex-col gap-16" style={P3D}>
          {estantes.map((fila) => (
            <Estante key={fila[0].id} cartas={fila} onPick={setActiva} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activa && (
          <CartaDetalle
            key={activa.id}
            carta={activa}
            onDownload={onDownload}
            descargando={descargandoId === activa.id}
            onClose={() => setActiva(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

/* ─────────────────────────── estantería 3D ─────────────────────────── */

function Estante({ cartas, onPick }) {
  const ref = useRef(null)
  const mx = useMotionValue(-1) // posición X normalizada del cursor; -1 = fuera
  const suave = useSpring(mx, { stiffness: 300, damping: 30, mass: 0.4 })

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / (r.width || 1))
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => mx.set(-1)}
      className="relative"
      style={P3D}
    >
      <ul className="relative z-10 m-0 flex list-none justify-center gap-2 p-0 sm:gap-4" style={P3D}>
        {cartas.map((carta, i) => (
          <CartaEnEstante
            key={carta.id}
            carta={carta}
            pos={(i + 0.5) / cartas.length}
            mx={suave}
            onPick={onPick}
          />
        ))}
      </ul>
      {/* balda de cristal oscuro (hoja plana: puede llevar gradiente sin romper el 3D) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-[-3%] bottom-[-9px] h-16 origin-bottom border-t border-white/15"
        style={{
          transform: 'rotateX(78deg)',
          background:
            'linear-gradient(180deg, rgb(130 160 190 / 0.10), rgb(130 160 190 / 0.02))',
        }}
      />
      {/* canto frontal de la balda */}
      <div aria-hidden="true" className="absolute inset-x-[-3%] bottom-[-11px] h-[2px] bg-gold/20" />
    </div>
  )
}

function CartaEnEstante({ carta, pos, mx, onPick }) {
  // parallax: las cartas cercanas al cursor se adelantan hasta POP_Z px
  const z = useTransform(mx, (v) =>
    v < 0 ? 0 : Math.max(0, 1 - Math.abs(v - pos) * 2.8) * POP_Z,
  )
  const transform = useMotionTemplate`translateZ(${z}px) rotateX(${LEAN_DEG}deg)`

  return (
    <motion.li className="relative w-[clamp(96px,16vw,150px)]" style={{ ...P3D, transform }}>
      <motion.button
        type="button"
        layoutId={`vitrina-${carta.id}`}
        disabled={!carta.poseida}
        onClick={() => onPick(carta)}
        whileTap={carta.poseida ? { scale: 0.97 } : undefined}
        aria-label={carta.poseida ? `Ver carta de ${carta.personajeNombre}` : 'Carta sin descubrir'}
        className="block w-full cursor-pointer text-left disabled:cursor-default"
        style={P3D}
      >
        {carta.poseida ? <CartaFace carta={carta} /> : <SlotEsmerilado carta={carta} />}
      </motion.button>
      {/* sombra de contacto sobre la balda (hoja plana: blur permitido) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-[6%] -bottom-2 h-3"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgb(0 0 0 / 0.65), transparent 70%)',
          transform: 'translateZ(-6px) rotateX(80deg)',
          filter: 'blur(3px)',
        }}
      />
    </motion.li>
  )
}

/* Sin descubrir: mismo teaser esmerilado del grid (imagen real difuminada +
   candado), en versión compacta. Hoja plana: aquí sí es legal overflow + blur. */
function SlotEsmerilado({ carta }) {
  return (
    <span className="relative block aspect-[2/3] overflow-hidden rounded-xl border border-white/8 bg-surface/40">
      <PersonajeImg
        slug={carta.personajeSlug}
        nombre={carta.personajeNombre}
        colorDominante={carta.colorDominante}
        alt=""
        aria-hidden="true"
        fit="cover"
        position="center"
        loading="lazy"
        sizes="150px"
        className="h-full w-full scale-110 opacity-40 blur-md saturate-50"
      />
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <Lock className="h-5 w-5 text-fg-strong/55" aria-hidden="true" />
      </span>
    </span>
  )
}

/* ─────────────────────── detalle: vuelo al centro ─────────────────────── */

function CartaDetalle({ carta, onDownload, descargando, onClose }) {
  const cerrarRef = useRef(null)

  useEffect(() => {
    const previo = document.activeElement
    cerrarRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
      if (previo instanceof HTMLElement) previo.focus()
    }
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Carta de ${carta.personajeNombre}`}
    >
      {/* backdrop plano: blur y opacidad AQUÍ, nunca en el padre del vuelo */}
      <motion.div
        className="absolute inset-0 bg-bg/85 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
        {/* layoutId = vuelo desde la balda hasta el centro */}
        <motion.figure
          layoutId={`vitrina-${carta.id}`}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          className="pointer-events-auto m-0 w-[min(72vw,300px)] cursor-pointer"
          onClick={onClose}
        >
          <CartaFace carta={carta} eager />
        </motion.figure>
        <motion.div
          className="pointer-events-auto flex items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.25 }}
        >
          {typeof onDownload === 'function' && (
            <button
              type="button"
              onClick={() => onDownload(carta)}
              disabled={descargando}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-gold/55 hover:text-gold disabled:cursor-wait disabled:opacity-60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {descargando ? 'Descargando...' : 'Descargar'}
            </button>
          )}
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-sm font-semibold text-fg-muted transition-colors hover:border-white/30 hover:text-fg-strong"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cerrar
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default CardShowcase
