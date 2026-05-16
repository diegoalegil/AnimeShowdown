import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { Lock } from 'lucide-react'

/**
 * Card individual de un badge/logro (Plan v2 §4.2).
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
    borde: 'border-zinc-400/40',
    glow: '',
    icono: 'text-zinc-300',
    chip: 'bg-zinc-400/10 text-zinc-300',
  },
  2: {
    nombre: 'Poco común',
    borde: 'border-emerald-500/50',
    glow: 'shadow-[0_0_16px_-4px_rgb(16,185,129,0.45)]',
    icono: 'text-emerald-300',
    chip: 'bg-emerald-500/10 text-emerald-300',
  },
  3: {
    nombre: 'Raro',
    borde: 'border-sky-500/50',
    glow: 'shadow-[0_0_16px_-4px_rgb(56,189,248,0.5)]',
    icono: 'text-sky-300',
    chip: 'bg-sky-500/10 text-sky-300',
  },
  4: {
    nombre: 'Épico',
    borde: 'border-purple-500/55',
    glow: 'shadow-[0_0_18px_-4px_rgb(168,85,247,0.55)]',
    icono: 'text-purple-300',
    chip: 'bg-purple-500/10 text-purple-300',
  },
  5: {
    nombre: 'Legendario',
    borde: 'border-amber-400/60',
    // Glow doble + animado para legendarios — el premio mayor del catálogo.
    glow: 'shadow-[0_0_24px_-4px_rgb(251,191,36,0.65)] animate-pulse-halo',
    icono: 'text-amber-300',
    chip: 'bg-amber-500/15 text-amber-300',
  },
}

function getIcon(nombre) {
  return Icons[nombre] ?? Icons.Award
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
            className="absolute left-1/2 top-full z-10 mt-2 w-52 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-2xl"
          >
            <p className="mb-1.5 flex items-center gap-1.5">
              <span
                className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}
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
