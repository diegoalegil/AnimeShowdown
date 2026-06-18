import { useState } from 'react'
import { AppLink } from '../../components/AppLink'
import { OUTER, tierOf } from '../games/hub/flame-core'
import { readDailyStreak } from '../../lib/dailyProgress'

// Brillo del halo por nivel de racha (cero blur: degradado pre-horneado).
const GLOW = { none: 0.3, ember: 0.42, flame: 0.6, double: 0.78 }

/**
 * HomeStreakEmber — ascua compacta de la racha para la home. Reutiliza el ARTE
 * de la llama (flame-core) en pequeño y enlaza a /games para mantenerla viva.
 * Lee la racha del progreso diario local con init perezoso (mismo patrón que
 * DailyMissionPanel; SSR-safe: 0 sin localStorage). A racha 0 invita a
 * encenderla. Estática a propósito — la home es sensible al LCP y el brillo lo
 * da el degradado, no una animación en bucle.
 */
export default function HomeStreakEmber() {
  const [streak] = useState(() =>
    Math.max(0, Math.round(readDailyStreak()?.current ?? 0)),
  )
  const tier = tierOf(streak)
  const aspirational = streak === 0
  const unidad = streak === 1 ? 'día' : 'días'

  return (
    <AppLink
      to="/games"
      className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-surface px-4 py-3 transition-colors hover:border-gold/40"
      aria-label={
        aspirational
          ? 'Enciende tu racha en los retos diarios'
          : `Racha de ${streak} ${unidad} — mantén la llama en los retos diarios`
      }
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center">
        <svg
          viewBox="0 0 220 260"
          preserveAspectRatio="xMidYMax meet"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="hse-flame" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="color-mix(in oklch, var(--color-accent) 65%, black)" />
              <stop offset="45%" stopColor="var(--color-accent)" />
              <stop offset="100%" stopColor="var(--color-gold)" />
            </linearGradient>
            <radialGradient id="hse-glow">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.5" />
              <stop offset="70%" stopColor="var(--color-accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="110" cy="172" rx="86" ry="96" fill="url(#hse-glow)" opacity={GLOW[tier]} />
          <path d={OUTER} fill="url(#hse-flame)" opacity={aspirational ? 0.55 : 1} />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-lg font-bold leading-none text-fg-strong">{streak}</span>
          <span className="text-xs text-fg-muted">{aspirational ? 'sin racha' : unidad}</span>
          <span
            className="ml-0.5 text-base leading-none text-gold/80"
            style={{ fontFamily: 'var(--font-kanji-serif)' }}
            aria-hidden="true"
          >
            続
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-fg-muted">
          {aspirational ? 'Enciende tu racha hoy' : 'Mantén la llama encendida'}
        </span>
      </span>

      <span
        className="shrink-0 font-mono text-[11px] font-bold text-gold transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        →
      </span>
    </AppLink>
  )
}
