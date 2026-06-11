import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { Download, Lock, X } from 'lucide-react'
import CartaFace from './CartaFace'
import PersonajeImg from '../../components/PersonajeImg'
import { FOCUSABLE_SELECTOR } from '../../lib/focusables'

/**
 * Vitrina 3D del álbum: estanterías de cristal oscuro en perspectiva con las
 * cartas apoyadas (rotateX), parallax sutil al cursor y vuelo de la carta al
 * centro al hacer click. CSS 3D puro, sin WebGL. Las no conseguidas reutilizan
 * el teaser esmerilado del grid.
 *
 * Solo se monta con puntero fino, viewport ≥640px y sin prefers-reduced-motion
 * (gate vivo en CartasPage): el grid plano queda como vista táctil/reduced-motion
 * — el parallax necesita hover y CartaFace es ilegible por debajo de ~100px.
 *
 * ── Vuelo al detalle: FLIP manual, NO shared layout ────────────────────────
 * layoutId mediría el botón DENTRO del plano inclinado (perspective + rotateX
 * del li, invisibles para el sistema de proyección de framer): la copia se
 * re-distorsiona al componerse en el contexto 3D y la vuelta diverge varios px
 * con snap al aterrizar. En su lugar: al abrir se mide el rect del botón (AABB
 * del trapecio proyectado, error 1-3 %, imperceptible), se oculta el origen y
 * un clon plano vuela en el overlay fixed con translate/scale; al cerrar
 * deshace el mismo delta y onExitComplete restaura visibilidad y foco. Cero
 * nodos de proyección: abrir/cerrar no re-mide las N cartas de la vitrina.
 *
 * ── Gotcha Safari `preserve-3d` ─────────────────────────────────────────────
 * Safari APLANA un nodo con `transform-style: preserve-3d` si ese MISMO nodo
 * declara overflow ≠ visible, filter / backdrop-filter, opacity < 1,
 * clip-path, mask o mix-blend-mode. Reglas aplicadas aquí:
 *   1. Los nodos 3D (escena, estante, li de carta) llevan SOLO transform +
 *      preserve-3d (con prefijo -webkit-). Nunca overflow/filter/opacity.
 *   2. El recorte redondeado, blurs y scrims viven en HIJOS hoja planos
 *      (CartaFace y el slot esmerilado son hojas: pueden recortar y difuminar).
 *   3. `perspective` se declara en el contenedor padre, nunca como
 *      `transform: perspective(...)` (Safari lo compone distinto).
 * ────────────────────────────────────────────────────────────────────────────
 * 60 fps: solo se animan transform y opacity.
 */

const LEAN_DEG = 8 // inclinación de reposo contra el cristal
const POP_Z = 12 // translateZ máx. del parallax (px)
const PERSPECTIVE = '1200px'

const P3D = { transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }
const RESORTE = { stiffness: 300, damping: 30, mass: 0.4 }
const VUELO = { type: 'spring', stiffness: 160, damping: 24 }

function CardShowcase({ cartas, onDownload, descargandoId = null, perShelf = 5 }) {
  const [activa, setActiva] = useState(null) // { carta, origen: DOMRect, el }
  const ultimaRef = useRef(null)

  const abrir = useCallback((carta, el) => {
    const registro = { carta, origen: el.getBoundingClientRect(), el }
    ultimaRef.current = registro
    // El clon del overlay sustituye a la carta mientras vuela; visibility
    // también la saca del orden de tabulación. React no gestiona esta prop.
    el.style.visibility = 'hidden'
    setActiva(registro)
  }, [])

  const cerrar = useCallback(() => setActiva(null), [])

  const alAterrizar = useCallback(() => {
    const registro = ultimaRef.current
    if (registro?.el) {
      registro.el.style.visibility = ''
      if (registro.el.isConnected) registro.el.focus()
    }
    ultimaRef.current = null
  }, [])

  const estantes = useMemo(() => {
    const filas = []
    for (let i = 0; i < cartas.length; i += perShelf) {
      filas.push(cartas.slice(i, i + perShelf))
    }
    return filas
  }, [cartas, perShelf])

  return (
    <section aria-label="Vitrina del álbum">
      <div
        className="relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-surface px-4 pb-10 pt-6 sm:px-8"
        style={{ perspective: PERSPECTIVE, perspectiveOrigin: '50% 28%' }}
      >
        {/* iluminación de vitrina: cono tenue desde el techo, descentrado.
            Sin `from`: el pico (posición 50 %) cae en 180deg, hacia DENTRO
            de la caja — con `from 180deg` apuntaría hacia fuera y la capa
            no pintaría ni un píxel. Capa PLANA, fuera del árbol 3D. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              'conic-gradient(at 46% 0%, transparent 41%, color-mix(in oklab, var(--color-gold) 9%, transparent) 50%, transparent 59%)',
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
            <Estante key={fila[0].id} cartas={fila} onPick={abrir} />
          ))}
        </div>
      </div>

      <AnimatePresence onExitComplete={alAterrizar}>
        {activa && (
          <CartaDetalle
            key={activa.carta.id}
            carta={activa.carta}
            origen={activa.origen}
            onDownload={onDownload}
            descargando={descargandoId === activa.carta.id}
            onClose={cerrar}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

/* ─────────────────────────── estantería 3D ─────────────────────────── */

// memo: abrir/cerrar el detalle solo re-renderiza el shell de CardShowcase
// (sus props —slice memoizado y callback estable— no cambian).
const Estante = memo(function Estante({ cartas, onPick }) {
  const ref = useRef(null)
  const mx = useMotionValue(0.5) // posición X normalizada del cursor en el estante
  const dentro = useMotionValue(0) // 1 = puntero sobre el estante
  const suave = useSpring(mx, RESORTE)
  const cerca = useSpring(dentro, RESORTE)

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / (r.width || 1))
    dentro.set(1)
  }
  // La atenuación va en su propio canal (cerca→0): cada carta baja EN SU
  // SITIO. Un centinela fuera de rango en mx haría que el spring barriera
  // el estante levantando todas las cartas a su paso.
  const onLeave = () => dentro.set(0)

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative"
      style={P3D}
    >
      <ul
        role="list"
        className="relative z-10 m-0 flex list-none justify-center gap-2 p-0 sm:gap-4"
        style={P3D}
      >
        {cartas.map((carta, i) => (
          <CartaEnEstante
            key={carta.id}
            carta={carta}
            pos={(i + 0.5) / cartas.length}
            mx={suave}
            cerca={cerca}
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
            'linear-gradient(180deg, color-mix(in oklab, var(--color-fg-muted) 10%, transparent), color-mix(in oklab, var(--color-fg-muted) 2%, transparent))',
        }}
      />
      {/* canto frontal: hairline con fade asimétrico (mismo gesto que TrophyHall) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-[-3%] bottom-[-11px] h-px bg-gradient-to-r from-gold/25 to-transparent"
      />
    </div>
  )
})

function CartaEnEstante({ carta, pos, mx, cerca, onPick }) {
  // parallax: las cartas cercanas al cursor se adelantan hasta POP_Z px,
  // moduladas por `cerca` para que al salir el puntero se asienten en su sitio
  const z = useTransform(
    () => cerca.get() * Math.max(0, 1 - Math.abs(mx.get() - pos) * 2.8) * POP_Z,
  )
  const transform = useMotionTemplate`translateZ(${z}px) rotateX(${LEAN_DEG}deg)`

  return (
    <motion.li className="relative w-[clamp(96px,16vw,150px)]" style={{ ...P3D, transform }}>
      <motion.button
        type="button"
        disabled={!carta.poseida}
        onClick={(e) => onPick(carta, e.currentTarget)}
        whileTap={carta.poseida ? { scale: 0.97 } : undefined}
        aria-label={carta.poseida ? `Ver carta de ${carta.personajeNombre}` : 'Carta sin descubrir'}
        className="block w-full cursor-pointer text-left disabled:cursor-default"
      >
        {carta.poseida ? (
          <CartaFace carta={carta} sizes="150px" />
        ) : (
          <SlotEsmerilado carta={carta} />
        )}
      </motion.button>
      {/* sombra de contacto: rotateX(70) + lean 8° del li = 78°, coplanaria
          con la balda. Sin blur: el radial ya se desvanece solo. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-[6%] -bottom-2 h-6"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, color-mix(in srgb, black 65%, transparent), transparent 70%)',
          transform: 'translateZ(-6px) rotateX(70deg)',
        }}
      />
    </motion.li>
  )
}

/* Sin descubrir: mismo teaser esmerilado del grid (imagen real difuminada +
   candado), en versión compacta. Hoja plana: aquí sí es legal overflow + blur. */
function SlotEsmerilado({ carta }) {
  return (
    <span className="relative block aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-surface/40">
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

function CartaDetalle({ carta, origen, onDownload, descargando, onClose }) {
  const dialogRef = useRef(null)
  const figRef = useRef(null)
  const cerrarRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const escala = useMotionValue(1)
  const deltaRef = useRef({ x: 0, y: 0, escala: 1 })

  // FLIP: el clon nace exactamente sobre el rect de origen y vuela al centro.
  useLayoutEffect(() => {
    const destino = figRef.current.getBoundingClientRect()
    const delta = {
      x: origen.left + origen.width / 2 - (destino.left + destino.width / 2),
      y: origen.top + origen.height / 2 - (destino.top + destino.height / 2),
      escala: origen.width / destino.width,
    }
    deltaRef.current = delta
    x.jump(delta.x)
    y.jump(delta.y)
    escala.jump(delta.escala)
    const controles = [animate(x, 0, VUELO), animate(y, 0, VUELO), animate(escala, 1, VUELO)]
    return () => controles.forEach((c) => c.stop())
  }, [origen, x, y, escala])

  // Foco inicial, Escape, trap de Tab y scroll-lock: efecto de UN montaje.
  // onClose se lee desde ref para que un re-render del padre (p.ej. el estado
  // isPending de la descarga) no re-ejecute el ciclo y robe el foco.
  useEffect(() => {
    cerrarRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
    }
  }, [])

  return (
    <motion.div
      ref={dialogRef}
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
        {/* el vuelo de vuelta deshace el mismo delta medido al abrir */}
        <motion.figure
          ref={figRef}
          style={{ x, y, scale: escala }}
          variants={{
            volver: () => ({
              x: deltaRef.current.x,
              y: deltaRef.current.y,
              scale: deltaRef.current.escala,
              transition: VUELO,
            }),
          }}
          exit="volver"
          className="pointer-events-auto m-0 w-[min(72vw,300px)] cursor-pointer"
          onClick={onClose}
        >
          <CartaFace carta={carta} eager sizes="300px" />
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
