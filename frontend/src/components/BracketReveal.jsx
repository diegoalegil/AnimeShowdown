/**
 * BracketReveal.jsx — AnimeShowdown
 * Revelado de cruce: orquesta la animación cuando se resuelve un match del bracket.
 *
 * Stack: React 19 · framer-motion 12 · Tailwind v4 (tokens del proyecto).
 * Sin hex literales: todo color via tokens (stroke-gold, var(--color-accent), color-mix).
 *
 * ── TIMELINE (total 800 ms, solapes de 100 ms) ────────────────────────────────
 *
 *   ms    0         350   450       550   650        800
 *         ├── (1) línea ───┤
 *                   ├── (2) pulse ────┤
 *                                ├── (3) atenuado ────┤
 *
 *   (1) Línea ganadora    0 → 450 ms · cubic-bezier(0.22, 1, 0.36, 1) (ease-out)
 *       Trazo ORO que "carga" el path del camino del ganador. framer-motion
 *       anima `pathLength`, que compila internamente a stroke-dasharray /
 *       stroke-dashoffset → solo geometría de trazo, compositor-friendly.
 *
 *   (2) Pulse ganador   350 → 650 ms · easeInOut
 *       scale 1 → 1.04 → 1. El halo carmesí es un overlay con box-shadow
 *       ESTÁTICO del que solo se anima la opacity (0 → 1 → 0) → 60 fps.
 *
 *   (3) Atenuado perdedor 550 → 800 ms · easeOut
 *       opacity → 0.45 + saturate(0.35). `filter` es la única excepción a la
 *       regla transform/opacity: es un one-shot de 250 ms, nunca continuo.
 *
 *   prefers-reduced-motion → estado final directo, transition { duration: 0 }.
 *
 * ── USO ───────────────────────────────────────────────────────────────────────
 *
 *   <BracketReveal resolved={match.resolved} onRevealComplete={advanceWinner}>
 *     <svg viewBox="…">
 *       <path d={winnerD} className="stroke-line" fill="none" />  // ruta base estática
 *       <BracketReveal.WinnerPath d={winnerD} />                  // overlay oro animado
 *     </svg>
 *     <BracketReveal.Winner className="rounded-xl">
 *       <FighterCard fighter={winner} />
 *     </BracketReveal.Winner>
 *     <BracketReveal.Loser className="rounded-xl">
 *       <FighterCard fighter={loser} />
 *     </BracketReveal.Loser>
 *   </BracketReveal>
 *
 *   Para nodos 100 % SVG (sin overlay HTML), usa los variants exportados
 *   directamente sobre <motion.g>/<motion.path> con custom={reducedMotion}.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  REVEAL_TIMING,
  haloVariants,
  loserVariants,
  winnerPathVariants,
  winnerVariants,
} from "./bracket-reveal-variants";

/* ── Contexto interno ─────────────────────────────────────────────────────── */

const RevealCtx = React.createContext({ resolved: false, reduced: false });

function useReveal() {
  const { resolved, reduced } = React.useContext(RevealCtx);
  return {
    reduced,
    custom: reduced,
    initial: "idle",
    animate: resolved ? "resolved" : "idle",
  };
}

/* ── Wrapper raíz ─────────────────────────────────────────────────────────── */

/**
 * No pinta nada por sí mismo: provee el estado `resolved` y el flag de
 * reduced-motion a los subcomponentes, y dispara onRevealComplete al
 * terminar la secuencia (inmediato con reduced motion).
 */
export function BracketReveal({ resolved = false, onRevealComplete, children }) {
  const reduced = useReducedMotion() ?? false;

  React.useEffect(() => {
    if (!resolved || !onRevealComplete) return undefined;
    const t = setTimeout(onRevealComplete, reduced ? 0 : REVEAL_TIMING.total * 1000);
    return () => clearTimeout(t);
  }, [resolved, reduced, onRevealComplete]);

  const value = React.useMemo(() => ({ resolved, reduced }), [resolved, reduced]);
  return <RevealCtx.Provider value={value}>{children}</RevealCtx.Provider>;
}

/* ── (1) Path oro — colócalo DESPUÉS del path base dentro del mismo <svg> ── */

function WinnerPath({ d, strokeWidth = 2.5, className = "", ...rest }) {
  const anim = useReveal();
  return (
    <motion.path
      d={d}
      fill="none"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      className={`stroke-gold ${className}`}
      variants={winnerPathVariants}
      custom={anim.custom}
      initial={anim.initial}
      animate={anim.animate}
      {...rest}
    />
  );
}

/* ── (2) Card ganadora: pulse + halo carmesí ──────────────────────────────── */

function Winner({ className = "", haloClassName = "", children, ...rest }) {
  const anim = useReveal();
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ transformOrigin: "50% 50%", willChange: "transform" }}
      variants={winnerVariants}
      custom={anim.custom}
      initial={anim.initial}
      animate={anim.animate}
      {...rest}
    >
      {children}
      {/* Halo: sombra estática, solo se anima la opacity (compositor). */}
      <motion.span
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-px rounded-[inherit] ${haloClassName}`}
        style={{
          boxShadow:
            "0 0 0 1px var(--color-accent), 0 0 22px 1px color-mix(in oklab, var(--color-accent) 45%, transparent)",
        }}
        variants={haloVariants}
        custom={anim.custom}
        initial={anim.initial}
        animate={anim.animate}
      />
    </motion.div>
  );
}

/* ── (3) Card perdedora: baja a 0.45 y se desatura ────────────────────────── */

function Loser({ className = "", children, ...rest }) {
  const anim = useReveal();
  return (
    <motion.div
      className={className}
      style={{ willChange: "opacity" }}
      variants={loserVariants}
      custom={anim.custom}
      initial={anim.initial}
      animate={anim.animate}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

BracketReveal.WinnerPath = WinnerPath;
BracketReveal.Winner = Winner;
BracketReveal.Loser = Loser;

export default BracketReveal;
