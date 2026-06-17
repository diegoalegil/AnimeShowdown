// ============================================================================
// LanternPath.jsx — escenografia de la Sala 04. Tu mejor racha como fila de
// faroles que se ENCIENDEN uno a uno (cross-fade del ember, stagger 80ms).
// Maximo 14 faroles visibles; si la racha excede, se anade "×N" en mono.
// Solo transform/opacity; el ember encendido es el estado BASE (reduced-motion
// muestra todos encendidos al instante).
// ============================================================================

import { MAX_LANTERNS, TIMING, nfEs } from './sanctuary-core'

/**
 * @typedef {object} LanternPathProps
 * @property {number} racha mejor racha (>=1). Si excede 14 se rotula "×racha".
 */

/**
 * Senda de faroles.
 * @param {LanternPathProps} props
 */
function LanternPath({ racha }) {
  const total = Math.max(0, Number(racha || 0))
  const shown = Math.min(total, MAX_LANTERNS)
  const overflow = total > MAX_LANTERNS

  return (
    <div className="mt-2 flex min-h-[120px] flex-wrap items-end justify-center gap-[clamp(8px,2.4vw,18px)]">
      {Array.from({ length: shown }, (_, i) => (
        <div
          key={i}
          className="relative flex w-[30px] flex-col items-center"
          style={{ '--ld': (i * TIMING.lanternStep) / 1000 + 's' }}
        >
          <span aria-hidden="true" className="h-[18px] w-0.5 bg-border-gold-subtle" />
          <span
            aria-hidden="true"
            className="relative h-[38px] w-[26px] rounded-[6px_6px_7px_7px] border border-border-gold-subtle bg-gradient-to-b from-surface-alt to-surface"
          >
            <span
              className="sanctuary-ember absolute inset-0.5 rounded-[5px]"
              style={{
                background:
                  'radial-gradient(circle at 50% 40%, var(--color-gold-bright), var(--color-accent) 92%)',
                boxShadow: '0 0 18px -2px color-mix(in srgb, var(--color-gold) 70%, transparent)',
              }}
            />
          </span>
        </div>
      ))}
      {overflow ? (
        <span className="self-center font-mono text-lg font-bold text-gold">×{nfEs(total)}</span>
      ) : null}
    </div>
  )
}

export default LanternPath
