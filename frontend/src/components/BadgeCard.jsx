import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { iconoDeBadge } from '../lib/badgeIcons'
import { kanjiDeBadge } from '../lib/badgeKanji'

/**
 * Card individual de un badge/logro.
 *
 * Estados:
 *   - desbloqueado: marco coloreado por rareza + icono color, fecha tooltip.
 *   - bloqueado: marco gris atenuado + icono con candado encima, tooltip
 *                con la descripción "cómo conseguirlo".
 *
 * Click → expande tooltip in-card con descripción completa + fecha.
 */

// Estándar gaming WoW/Hearthstone para colores de rareza. El estilo es
// borde + glow del color cuando está desbloqueado. Atenuado cuando no.
const RAREZA_STYLE = {
  1: {
    nombre: 'Común',
    borde: 'border-rarity-common/40',
    glow: '',
    icono: 'text-rarity-common',
    chip: 'bg-rarity-common/10 text-rarity-common',
  },
  2: {
    nombre: 'Poco común',
    borde: 'border-rarity-uncommon/50',
    glow: 'shadow-aura-sm [--aura-color:rgb(16_185_129_/_0.45)]',
    icono: 'text-rarity-uncommon',
    chip: 'bg-rarity-uncommon/10 text-rarity-uncommon',
  },
  3: {
    nombre: 'Raro',
    borde: 'border-rarity-rare/50',
    glow: 'shadow-aura-sm [--aura-color:rgb(56_189_248_/_0.5)]',
    icono: 'text-rarity-rare',
    chip: 'bg-rarity-rare/10 text-rarity-rare',
  },
  4: {
    nombre: 'Épico',
    borde: 'border-rarity-epic/55',
    glow: 'shadow-aura-sm [--aura-color:rgb(168_85_247_/_0.55)]',
    icono: 'text-rarity-epic',
    chip: 'bg-rarity-epic/10 text-rarity-epic',
  },
  5: {
    nombre: 'Legendario',
    borde: 'border-rarity-legendary/60',
    // Glow doble + animado para legendarios — el premio mayor del catálogo.
    glow: 'shadow-aura-sm [--aura-color:var(--color-rarity-legendary-aura)] as-pulse-halo',
    icono: 'text-rarity-legendary',
    chip: 'bg-rarity-legendary/15 text-rarity-legendary',
  },
}

function getIcon(nombre) {
  return iconoDeBadge(nombre)
}

function formatFecha(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function BadgeCard({ logro }) {
  const [expanded, setExpanded] = useState(false)
  const desbloqueado = Boolean(logro.desbloqueadoEn)
  const style = RAREZA_STYLE[logro.rareza] ?? RAREZA_STYLE[1]
  const Icon = getIcon(logro.icono)

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-label={`${logro.nombre} — ${desbloqueado ? 'desbloqueado' : 'bloqueado'}`}
      className={`relative flex flex-col items-center gap-1.5 rounded-lg border ${
        desbloqueado ? style.borde : 'border-border'
      } ${desbloqueado ? `bg-bg ${style.glow}` : 'bg-bg/40'} p-3 text-center transition-all hover:scale-105`}
    >
      <span
        className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full ${
          desbloqueado ? 'bg-surface' : 'bg-surface-alt'
        }`}
      >
        {/* eslint-disable-next-line react-hooks/static-components -- icon
            es lookup dinámico por logro.icono; el componente sí es estable
            entre renders del mismo badge (mismo logro = mismo icono). */}
        <Icon
          className={`h-6 w-6 ${desbloqueado ? style.icono : 'text-fg-muted/40'}`}
        />
        {!desbloqueado && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <Lock className="h-4 w-4 text-fg-muted" />
          </span>
        )}
        {/* 1: kanji asociado al badge en esquina sup-derecha
            del circulo del icono. Solo si esta desbloqueado y tiene
            mapping en lib/badgeKanji. */}
        {desbloqueado && kanjiDeBadge(logro.codigo) && (
          <span
            aria-hidden="true"
            lang="ja"
            className={`font-jp absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-bg px-1 text-[10px] leading-none ${style.icono}`}
          >
            {kanjiDeBadge(logro.codigo)}
          </span>
        )}
      </span>
      <span
        className={`text-[11px] font-semibold leading-tight ${
          desbloqueado ? 'text-fg-strong' : 'text-fg-muted/60'
        }`}
      >
        {logro.nombre}
      </span>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full z-10 mt-2 w-52 max-w-[min(13rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-2xl"
          >
            <p className="mb-1.5 flex items-center gap-1.5">
              <span
                className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${style.chip}`}
              >
                {style.nombre}
              </span>
            </p>
            <p className="mb-1.5 text-[12px] font-semibold text-fg-strong">
              {logro.nombre}
            </p>
            <p className="text-[11px] leading-snug text-fg-muted">
              {logro.descripcion}
            </p>
            {desbloqueado && (
              <p className="mt-2 text-[10px] text-fg-muted">
                Desbloqueado el {formatFecha(logro.desbloqueadoEn)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

export default BadgeCard
