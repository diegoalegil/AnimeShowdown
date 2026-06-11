/**
 * Timing y variants del revelado de bracket — módulo SIN componentes para
 * que BracketReveal.jsx cumpla react-refresh/only-export-components.
 * Todos los variants reciben `custom` = prefersReducedMotion (boolean) y
 * colapsan a estado final con duration 0 cuando es true.
 */

/* ── Timing canónico (segundos, formato framer-motion) ───────────────────── */
export const REVEAL_TIMING = Object.freeze({
  path:  { delay: 0.0,  duration: 0.45 }, // (1) línea ganadora      0 – 450 ms
  pulse: { delay: 0.35, duration: 0.3  }, // (2) pulse ganador     350 – 650 ms (solape 100 ms)
  dim:   { delay: 0.55, duration: 0.25 }, // (3) atenuado perdedor 550 – 800 ms (solape 100 ms)
  total: 0.8,
});

const EASE_OUT_LINE = [0.22, 1, 0.36, 1];

/* ── Variants ─────────────────────────────────────────────────────────────────
 * Todos reciben `custom` = prefersReducedMotion (boolean) y colapsan a
 * estado final con duration 0 cuando es true.
 * ───────────────────────────────────────────────────────────────────────────── */

/** (1) Trazo oro del camino del ganador. pathLength ⇒ stroke-dashoffset. */
export const winnerPathVariants = {
  idle: { pathLength: 0, opacity: 0 },
  resolved: (reduced) =>
    reduced
      ? { pathLength: 1, opacity: 1, transition: { duration: 0 } }
      : {
          pathLength: 1,
          opacity: 1,
          transition: {
            delay: REVEAL_TIMING.path.delay,
            duration: REVEAL_TIMING.path.duration,
            ease: EASE_OUT_LINE,
            // la línea aparece de inmediato; solo el avance dura 450 ms
            opacity: { duration: 0.1 },
          },
        },
};

/** (2a) Pulse de la card ganadora: scale 1 → 1.04 → 1. */
export const winnerVariants = {
  idle: { scale: 1 },
  resolved: (reduced) =>
    reduced
      ? { scale: 1, transition: { duration: 0 } }
      : {
          scale: [1, 1.04, 1],
          transition: {
            delay: REVEAL_TIMING.pulse.delay,
            duration: REVEAL_TIMING.pulse.duration,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          },
        },
};

/** (2b) Halo carmesí: overlay con sombra estática, solo anima opacity. */
export const haloVariants = {
  idle: { opacity: 0 },
  resolved: (reduced) =>
    reduced
      ? { opacity: 0, transition: { duration: 0 } }
      : {
          opacity: [0, 1, 0],
          transition: {
            delay: REVEAL_TIMING.pulse.delay,
            duration: REVEAL_TIMING.pulse.duration,
            times: [0, 0.4, 1],
            ease: "easeOut",
          },
        },
};

/** (3) Atenuado del perdedor: opacity 0.45 + desaturado (persiste). */
export const loserVariants = {
  idle: { opacity: 1, filter: "saturate(1)" },
  resolved: (reduced) => ({
    opacity: 0.45,
    filter: "saturate(0.35)",
    transition: reduced
      ? { duration: 0 }
      : {
          delay: REVEAL_TIMING.dim.delay,
          duration: REVEAL_TIMING.dim.duration,
          ease: "easeOut",
        },
  }),
};

