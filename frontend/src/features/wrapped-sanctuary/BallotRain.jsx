// ============================================================================
// BallotRain.jsx — escenografia de la Sala 02. Un pool DETERMINISTA de 14
// papeletas (sanctuary-core/ballotPool) que caen UNA pasada cuando la sala
// despierta. Cero creacion de nodos por frame; solo transform/opacity. Es
// decorativa (aria-hidden): su estado base es oculto, asi reduced-motion la
// retira sola (la regla .sanctuary-ballot{display:none} del CSS de feature).
// ============================================================================

import { ballotPool } from './sanctuary-core'

// Tonos de la papeleta: oro/oro-claro/marfil + oro tenue. Cero hex (tokens +
// color-mix para la transparencia).
const BALLOT_TONES = [
  'var(--color-gold)',
  'var(--color-gold-bright)',
  'var(--color-fg-strong)',
  'color-mix(in srgb, var(--color-gold) 60%, transparent)',
]

const POOL = ballotPool()

/**
 * @typedef {object} BallotRainProps
 * @property {boolean} [awake] true cuando la sala esta despierta (lo hereda de
 *   la clase .is-awake del contenedor; este prop es solo informativo/test).
 */

/** Lluvia de votos. Sin props obligatorias: el disparo lo da .is-awake. */
function BallotRain() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {POOL.map((b, i) => (
        <span
          key={i}
          className="sanctuary-ballot"
          style={{
            left: b.left,
            background: BALLOT_TONES[i % BALLOT_TONES.length],
            '--bdelay': b.delay,
            '--bd': b.dur,
            '--r': b.rot,
          }}
        />
      ))}
    </div>
  )
}

export default BallotRain
