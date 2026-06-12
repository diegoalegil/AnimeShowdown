import { motion, useReducedMotion } from 'framer-motion'

/**
 * Sello hanko de la Crónica de la federación: kanji con significado real,
 * uno por tipo de evento — 票 voto · 章 logro · 戦 torneo creado · 縁 nuevo
 * seguimiento (lazo).
 *
 *  - Estampado: 240 ms, scale 1.3→1 + opacity, una sola vez al entrar al
 *    viewport (whileInView de framer-motion = IO interno, cero JS por frame).
 *  - prefers-reduced-motion: el sello aparece ya estampado (initial false).
 *  - El anillo de tinta es transform/opacity puro — nada de blur ni filters.
 */
const SELLO_POR_TIPO = {
  VOTO: {
    kanji: '票',
    aria: 'Voto',
    marco: 'border-accent-hover',
    texto: 'text-accent-hover',
    tinte: 'bg-accent-soft',
    anillo: 'border-accent-hover/60',
  },
  LOGRO: {
    kanji: '章',
    aria: 'Logro desbloqueado',
    marco: 'border-gold/80',
    texto: 'text-gold',
    tinte: 'bg-gold-soft',
    anillo: 'border-gold/50',
  },
  TORNEO_CREADO: {
    kanji: '戦',
    aria: 'Torneo creado',
    marco: 'border-accent-hover',
    texto: 'text-fg-strong',
    tinte: 'bg-accent',
    anillo: 'border-accent-hover/70',
  },
  SEGUIMIENTO: {
    kanji: '縁',
    aria: 'Nuevo seguimiento',
    marco: 'border-electric/60',
    texto: 'text-electric',
    tinte: 'bg-electric/10',
    anillo: 'border-electric/50',
  },
}

// Rotación sutil por posición para que el hilo respire como sellos a mano.
const ROTACIONES = [-4, 3, -2, 5, 1, -3]

const EASE_ESTAMPA = [0.2, 0.85, 0.3, 1.1]

/**
 * Sello hanko de un evento de la crónica. Cuelga del hilo (z-10 para tapar
 * la línea) y se estampa una única vez al entrar al viewport.
 *
 * @param tipo  VOTO | LOGRO | TORNEO_CREADO | SEGUIMIENTO
 * @param indice  posición del item en la lista (varía la rotación)
 * @param estampaInmediata  true para items live: el pop de gota ya anima el
 *        item entero, el sello no debe re-estamparse encima.
 */
export function HankoSello({ tipo, indice = 0, estampaInmediata = false }) {
  const reduce = useReducedMotion()
  const sello = SELLO_POR_TIPO[tipo]
  if (!sello) return null
  const rot = ROTACIONES[indice % ROTACIONES.length]
  const sinAnimacion = reduce || estampaInmediata

  return (
    <span className="relative z-10 inline-flex h-9 w-9 shrink-0">
      {/* Anillo de tinta que se expande al estampar (transform/opacity puro) */}
      {!sinAnimacion && (
        <motion.span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1.5 rounded-full border ${sello.anillo}`}
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: [0.65, 0], scale: [0.7, 1.55] }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.62, delay: 0.12, ease: 'easeOut' }}
        />
      )}
      <motion.span
        role="img"
        aria-label={sello.aria}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border bg-bg text-[17px] font-bold shadow-elev-1 ${sello.marco} ${sello.texto}`}
        style={{ fontFamily: 'var(--font-kanji-serif)', rotate: rot }}
        initial={sinAnimacion ? false : { opacity: 0, scale: 1.3 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.24, ease: EASE_ESTAMPA }}
      >
        {/* Tinte interior del sello, sobre base opaca bg-bg (tapa el hilo) */}
        <span aria-hidden="true" className={`absolute inset-0 rounded-full ${sello.tinte}`} />
        <span className="relative">{sello.kanji}</span>
      </motion.span>
    </span>
  )
}
