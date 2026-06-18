// ============================================================================
// StreakFlame.jsx — Módulo de racha · hub de retos diarios
// AnimeShowdown · React 19 + Tailwind v4 (tokens) + framer-motion 12
// ----------------------------------------------------------------------------
// · Solo anima transform/opacity (60 fps)
// · prefers-reduced-motion → estados estáticos (useReducedMotion)
// · Cero hex literal en JSX: tokens Tailwind + var(--color-*) → pasa el guard de CI
// · Niveles de llama: 1–2 días brasa · 3–6 llama · 7+ llama doble con chispas
// · Peligro (<6 h y sin jugar hoy): pulso ámbar lento en el borde
// · Hito (3/7/14/30): onda dorada única que se expande desde la llama
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CORE, MILESTONES, OUTER, TIER_TRANSFORM, tierOf } from "./flame-core";

// Ámbar derivado de la paleta (sin inventar color): oro arrastrado hacia carmesí
const AMBER = "color-mix(in oklch, var(--color-gold) 70%, var(--color-accent))";

/* ─── Llama SVG: gradiente carmesí→oro, flicker por framer-motion ─── */
function FlameSvg({ tier, reduce }) {
  const isEmber = tier === "ember" || tier === "none";
  // A racha 0 la brasa aspiracional sube su brillo respecto a una pavesa
  // muerta: visible y viva, pero por debajo de una racha real (ember 0.35).
  const glowOpacity = { none: 0.28, ember: 0.35, flame: 0.55, double: 0.7 }[tier];
  const origin = { transformBox: "fill-box", originX: 0.5, originY: 1 };

  const flicker = (dur, dir = 1) =>
    reduce || isEmber
      ? {}
      : {
          animate: {
            scale: [1, 0.975, 1.03, 0.99, 1],
            rotate: [0, -1.4 * dir, 1.1 * dir, -0.6 * dir, 0],
          },
          transition: { duration: dur, repeat: Infinity, ease: "easeInOut" },
        };

  // La brasa respira lento — también a racha 0 (estado aspiracional: una
  // brasa viva que invita a encenderla, no un pavesa muerta).
  const emberPulse =
    reduce || !isEmber
      ? {}
      : {
          animate: { scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] },
          transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
        };

  const sparks = [
    { cx: 132, cy: 76, r: 3, delay: 0, dur: 2.4 },
    { cx: 84, cy: 92, r: 2.4, delay: 0.9, dur: 2.8 },
    { cx: 116, cy: 52, r: 2, delay: 1.6, dur: 2.1 },
  ];

  return (
    <svg
      viewBox="0 0 220 260"
      preserveAspectRatio="xMidYMax meet"
      className="block h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sf-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-accent) 65%, black)" />
          <stop offset="45%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-gold)" />
        </linearGradient>
        <linearGradient id="sf-core" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--color-gold)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--color-gold) 45%, white)" />
        </linearGradient>
        <radialGradient id="sf-glow">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.5" />
          <stop offset="65%" stopColor="var(--color-accent)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="110" cy="160" rx="96" ry="104" fill="url(#sf-glow)" opacity={glowOpacity} />

      {/* Llama secundaria (solo 7+), detrás y a contratiempo */}
      {tier === "double" && (
        <g transform="translate(-2 114) scale(0.5)" opacity="0.95">
          <motion.g style={origin} {...flicker(2.2, -1)}>
            <path d={OUTER} fill="url(#sf-flame)" />
          </motion.g>
        </g>
      )}

      <g transform={TIER_TRANSFORM[tier]} opacity={tier === "none" ? 0.55 : 1}>
        <motion.g style={origin} {...flicker(1.9)} {...emberPulse}>
          <path d={OUTER} fill="url(#sf-flame)" />
          {isEmber ? (
            <path d={CORE} fill="url(#sf-core)" opacity="0.4" />
          ) : (
            <motion.path
              d={CORE}
              fill="url(#sf-core)"
              opacity="0.9"
              style={origin}
              {...(reduce
                ? {}
                : {
                    animate: { scale: [1, 1.06, 0.96, 1] },
                    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                  })}
            />
          )}
        </motion.g>
      </g>

      {/* Chispas sutiles (solo 7+) */}
      {tier === "double" &&
        !reduce &&
        sparks.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="var(--color-gold)"
            initial={{ opacity: 0 }}
            animate={{ y: [0, -95], opacity: [0, 0.85, 0], scale: [1, 0.35] }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
    </svg>
  );
}

/* ─── Módulo completo ─── */
export default function StreakFlame({
  streakDays = 0,
  playedToday = false,
  hoursLeft = 24,
  history = null, // bool[14] opcional: [0] = hace 13 días, [13] = hoy
}) {
  const reduce = useReducedMotion();
  const streak = Math.max(0, Math.round(streakDays));
  const tier = tierOf(streak);
  const danger = !playedToday && hoursLeft < 6 && streak > 0;
  // Racha 0 → estado aspiracional (cuenta nueva o racha rota): la brasa
  // invita a encender la primera llama hoy en vez de mostrar un hito frío.
  const aspirational = streak === 0;

  // Onda de hito: una sola vez, al CRUZAR 3/7/14/30
  const prev = useRef(streak);
  const [wave, setWave] = useState(0);
  useEffect(() => {
    if (streak > prev.current && MILESTONES.includes(streak)) setWave(Date.now());
    prev.current = streak;
  }, [streak]);

  const days = history?.length === 14 ? history : deriveHistory(streak, playedToday);

  const next = MILESTONES.find((m) => m > streak) ?? null;
  const base = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const pct = next ? Math.round(((streak - base) / (next - base)) * 100) : 100;

  const hoursLabel = Number.isInteger(hoursLeft)
    ? `${hoursLeft} h`
    : `${hoursLeft.toFixed(1).replace(".", ",")} h`;

  return (
    <section
      className="relative w-full max-w-[400px] overflow-hidden rounded-3xl border border-white/5 bg-surface p-6"
      aria-label={`Racha de ${streak} días`}
    >
      {/* Pulso ámbar de peligro — tensión, no alarma */}
      {danger && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[5] rounded-3xl"
          style={{ border: `1.5px solid ${AMBER}` }}
          animate={reduce ? { opacity: 0.35 } : { opacity: [0.14, 0.6, 0.14] }}
          transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Cabecera */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span
            className="text-[22px] leading-none text-gold/85"
            style={{ fontFamily: "var(--font-kanji-serif)" }}
          >
            続
          </span>
          <span className="text-sm text-white/55">
            {aspirational ? "Tu racha" : "Racha actual"}
          </span>
        </div>
        {danger && (
          <span className="font-mono text-xs" style={{ color: AMBER }}>
            Quedan {hoursLabel}
          </span>
        )}
      </header>

      {/* Llama + contador */}
      <div className="relative mx-auto mt-1 h-[280px] w-[240px]">
        <AnimatePresence>
          {wave > 0 && !reduce && (
            <motion.div
              key={wave}
              className="pointer-events-none absolute left-1/2 top-[150px] z-[4] h-[170px] w-[170px] rounded-full border-2 border-gold"
              style={{ marginLeft: -85, marginTop: -85 }}
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 2.3, opacity: 0 }}
              transition={{ duration: 1.3, ease: [0.16, 0.84, 0.44, 1] }}
              onAnimationComplete={() => setWave(0)}
            />
          )}
        </AnimatePresence>

        <FlameSvg tier={tier} reduce={reduce} />

        <div className="pointer-events-none absolute inset-x-0 top-[106px] text-center">
          <div
            className="font-mono text-[88px] font-bold leading-none"
            style={{
              color: "color-mix(in srgb, var(--color-gold) 14%, white)",
              textShadow:
                "0 2px 26px color-mix(in srgb, var(--color-bg) 90%, transparent), 0 0 10px color-mix(in srgb, var(--color-bg) 55%, transparent)",
            }}
          >
            {streak}
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-white/60">días</div>
        </div>
      </div>

      {/* Últimas 2 semanas: 完 entintado = completado, hueco = fallado */}
      <div className="mt-4 grid grid-cols-7 gap-[7px]" role="img" aria-label="Últimos 14 días">
        {days.map((done, i) => {
          const isToday = i === 13;
          return (
            <div
              key={i}
              className={`grid aspect-square place-items-center rounded-[10px] border ${
                done ? "border-gold/25 bg-gold/[0.07]" : "border-white/10"
              }`}
              style={
                isToday
                  ? {
                      borderColor: danger
                        ? AMBER
                        : "color-mix(in srgb, var(--color-electric) 55%, transparent)",
                    }
                  : undefined
              }
            >
              {done && (
                <span
                  className="text-[15px] text-gold/90"
                  style={{ fontFamily: "var(--font-kanji-serif)" }}
                >
                  完
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Próximo hito · o, a racha 0, la invitación a encender la primera llama */}
      <footer className="mt-4">
        {aspirational ? (
          <p className="flex items-center justify-center gap-1.5 text-center font-mono text-xs text-gold">
            <span aria-hidden="true" style={{ fontFamily: "var(--font-kanji-serif)" }}>
              火
            </span>
            Empieza tu racha hoy · enciende la llama
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 font-mono text-xs">
              <span className="text-white/55">
                {next ? `Siguiente hito · ${next} días` : "Hito máximo alcanzado"}
              </span>
              <span className="text-gold">{next ? `faltan ${next - streak}` : "30+"}</span>
            </div>
            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, pct)}%`,
                  background: "linear-gradient(90deg, var(--color-accent), var(--color-gold))",
                }}
              />
            </div>
          </>
        )}
      </footer>
    </section>
  );
}

// Fallback si el caller no pasa `history`: SOLO la racha actual entintada,
// el resto en hueco — aquí no se inventan días completados.
function deriveHistory(streak, playedToday) {
  const end = playedToday ? 13 : 12;
  const start = end - streak + 1;
  return Array.from({ length: 14 }, (_, i) => streak > 0 && i >= start && i <= end);
}

export { StreakFlame };
