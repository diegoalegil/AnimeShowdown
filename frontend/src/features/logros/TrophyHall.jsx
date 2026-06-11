// Salón de trofeos — presentación por estanterías del catálogo de logros.
// Diseño del canvas adaptado a la app: datos REALES por props (la página
// construye las estanterías por rareza desde el catálogo + kanjiDeBadge),
// el fondo es el arte logros-trophy-hall del banco como capa absoluta del
// propio salón (no fixed: convive con VisualPageShell), y cada placa
// conserva su id `logro-<codigo>` para el deep-link ?logro= existente.
//
// 60fps: solo transform/opacity; el micro-brillo cruza UNA pasada ligada
// al ciclo hidden→visible de su estantería (sin loop). reduced-motion vía
// MotionConfig local (la página ya carga framer; coste cero extra).

import { motion, MotionConfig } from 'framer-motion'
import { brandImage } from '../../lib/brand-assets'

const EASE = [0.22, 0.7, 0.3, 1]
const HALL = brandImage('logros-trophy-hall')

/* ---------------- variants ---------------- */

// Las placas suben con stagger cuando SU estantería entra al viewport.
const shelfStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const rise = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

const shine = {
  hidden: { x: '-260%' },
  visible: { x: '360%', transition: { duration: 1.15, delay: 0.45, ease: 'easeInOut' } },
}

/* ---------------- piezas comunes ---------------- */

function ShelfLedge() {
  // Repisa con perspectiva sutil (trapecio) + sombra proyectada.
  return (
    <div aria-hidden="true">
      <div className="-mx-2 h-[11px] bg-gradient-to-b from-gold/35 via-gold/20 to-black/95 [clip-path:polygon(1.5%_0,98.5%_0,100%_100%,0_100%)]" />
      {/* sombra proyectada de la repisa — tokens puros, sin literales de color */}
      <div className="mx-0.5 h-4 bg-[radial-gradient(50%_90%_at_50%_0%,color-mix(in_srgb,var(--color-bg)_92%,transparent),transparent_75%)]" />
    </div>
  )
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className="absolute right-3 top-3 h-3.5 w-3.5 text-gold/50"
    >
      <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

function Glifo({ item, tono }) {
  if (item.kanji) {
    return (
      <span lang="ja" className={`text-[28px] font-bold leading-none ${tono} [font-family:var(--font-kanji-serif)]`}>
        {item.kanji}
      </span>
    )
  }
  const Icon = item.Icon
  return Icon ? <Icon className={`h-7 w-7 ${tono}`} aria-hidden="true" /> : null
}

function Comunidad({ count }) {
  if (count == null) return null
  return (
    <span className="mt-2 block font-mono text-[10.5px] text-gold/60">
      {count.toLocaleString('es-ES')} {count === 1 ? 'usuario lo tiene' : 'usuarios lo tienen'}
    </span>
  )
}

/* ---------------- estados de placa ---------------- */

function PlaqueUnlocked({ item, destacado, celebrar }) {
  return (
    <motion.li variants={rise} className="group list-none" id={`logro-${item.codigo}`}>
      <div
        className={`relative overflow-hidden rounded-md border bg-gradient-to-b from-surface to-bg p-5 shadow-xl shadow-black/60 transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none ${
          destacado ? 'border-electric/70' : 'border-gold/50'
        }`}
      >
        {/* micro-brillo diagonal: solo transform, una pasada — y solo si el
            logro es de verdad del usuario (celebrar). */}
        {celebrar && (
          <motion.span
            aria-hidden="true"
            variants={shine}
            style={{ rotate: 10 }}
            className="pointer-events-none absolute -top-1/2 left-0 h-[180%] w-1/3 bg-gradient-to-r from-transparent via-gold/20 to-transparent"
          />
        )}
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 flex-none place-items-center rounded border border-gold/40 bg-gold/10">
            <Glifo item={item} tono="text-gold" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-white/90">{item.nombre}</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-white/55 [text-wrap:pretty]">
              {item.descripcion}
            </span>
            <Comunidad count={item.count} />
          </span>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-gold/60 to-transparent"
        />
      </div>
      <ShelfLedge />
    </motion.li>
  )
}

function PlaqueLocked({ item, destacado }) {
  return (
    <motion.li variants={rise} className="group list-none" id={`logro-${item.codigo}`}>
      <div
        className={`relative overflow-hidden rounded-md border bg-gradient-to-b from-bg to-black/60 p-5 shadow-lg shadow-black/70 transition-[transform,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-gold/25 motion-reduce:transition-none ${
          destacado ? 'border-electric/50' : 'border-white/[0.06]'
        }`}
      >
        <LockIcon />
        <div className="flex items-start gap-4">
          {/* silueta del glifo: mismo kanji, sin tinta */}
          <span className="grid h-14 w-14 flex-none place-items-center rounded border border-white/[0.06] bg-white/[0.015]">
            <Glifo item={item} tono="text-white/10" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-white/45">{item.nombre}</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-white/30 [text-wrap:pretty]">
              {item.descripcion}
            </span>
            <Comunidad count={item.count} />
          </span>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-white/5 to-transparent"
        />
      </div>
      <ShelfLedge />
    </motion.li>
  )
}

/* ---------------- estantería ---------------- */

function ShelfSection({ shelf, logueado, logroDestacado }) {
  const done = shelf.items.filter((a) => a.unlocked).length
  return (
    <section className="relative z-10 w-full pt-10 first:pt-2">
      <header className="flex items-baseline gap-3">
        <span lang="ja" className="text-[28px] font-bold leading-none text-gold [font-family:var(--font-kanji-serif)]">
          {shelf.kanji}
        </span>
        <h2 className="text-[19px] font-semibold text-white/90">{shelf.name}</h2>
        {logueado && (
          <span className="font-mono text-[12.5px] text-gold/85">
            {done}/{shelf.items.length}
          </span>
        )}
        <span className="h-px flex-1 self-center bg-gradient-to-r from-gold/25 to-transparent" />
      </header>
      <motion.ul
        variants={shelfStagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
        className="m-0 grid grid-cols-1 gap-x-5 gap-y-7 p-0 pt-6 md:grid-cols-3"
      >
        {shelf.items.map((item) =>
          item.unlocked ? (
            <PlaqueUnlocked
              key={item.codigo}
              item={item}
              destacado={item.codigo === logroDestacado}
              celebrar={logueado}
            />
          ) : (
            <PlaqueLocked key={item.codigo} item={item} destacado={item.codigo === logroDestacado} />
          ),
        )}
      </motion.ul>
    </section>
  )
}

/* ---------------- salón ---------------- */

/**
 * @param estanterias [{kanji, name, items: [{codigo, kanji?, Icon?, nombre,
 *                     descripcion, unlocked, count?}]}]
 * @param logueado    sin sesión las placas se muestran en modo escaparate
 *                    (brillantes, sin contadores propios ni celebración)
 * @param logroDestacado codigo del ?logro= para resaltar el deep-link
 */
function TrophyHall({ estanterias, logueado = false, logroDestacado = null }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative overflow-hidden rounded-3xl border border-gold/15 bg-bg px-5 pb-12 pt-4 sm:px-8">
        {/* hall dorado del banco + scrim de legibilidad */}
        {HALL && (
          <img
            src={HALL.src}
            srcSet={HALL.srcSet}
            sizes="(min-width: 1280px) 1152px, 100vw"
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-[50%_30%] opacity-60"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-bg/90 via-bg/55 to-bg/95"
        />
        {estanterias.map((shelf) => (
          <ShelfSection
            key={shelf.name}
            shelf={shelf}
            logueado={logueado}
            logroDestacado={logroDestacado}
          />
        ))}
      </div>
    </MotionConfig>
  )
}

export default TrophyHall
