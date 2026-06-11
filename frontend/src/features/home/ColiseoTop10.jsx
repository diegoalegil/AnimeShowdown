// ColiseoTop10.jsx — Top 10 en anillo 3D · CSS puro, sin WebGL
// Stack: React 19 + Tailwind v4 (tokens del proyecto) + framer-motion 12
//
// Notas de implementación (las gotchas que importan):
// · Cilindro: cada carta = rotateY(i*36°) translateZ(RADIUS); cámara fija (perspective
//   en el contenedor), gira SOLO el anillo → un único write de transform por frame.
// · 60fps: animamos exclusivamente transform/opacity vía MotionValues; nada de
//   width/height/top, nada de re-render por frame (el índice frontal es el único setState).
// · Safari: -webkit-transform-style / -webkit-backface-visibility en TODAS las caras,
//   incluidas las capas internas de cada cara (Safari aplana descendientes si falta).
// · Fog: opacity = 0.16 + 0.84 · ((cosθ+1)/2)^1.7 — derivada del MotionValue de rotación.
// · Reflejo: copia especular barata (scaleY(-1) + mask-image gradiente), fuera del
//   wrapper de elevación para que el reflejo no "despegue" del suelo.
// · Reduced motion: grid estático, cero animación.
// · Cero hex en JSX: todo color sale de tokens (bg-bg, text-gold, var(--color-*))
//   o de color-mix() sobre esos vars — el guard de CI queda contento.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
  motion,
} from "framer-motion";

const N_DEFAULT = 10;
const STEP = 360 / N_DEFAULT; // 36°
const RADIUS = 430; // px — (CARD_W/2)/tan(18°) ≈ 323 + aire entre cartas
const CARD_W = 210;
const CARD_H = 315; // 2:3
const IDLE_DPS = 360 / 60; // idle: una vuelta cada 60 s
const LIFT = 70; // translateZ extra de la carta frontal
const REST_MS = 4000; // pausa tras interacción antes de volver al idle

// La imagen base viene del catálogo (imagenPersonaje); derivamos las
// variantes -300/-600 con la convención del resto de la app.
const img = (c, w) => c.image.replace(/(?:-(?:300|600|1024))?\.webp$/i, `-${w}.webp`);
const mod = (a, n) => ((a % n) + n) % n;

const SAFARI_FACE = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};
const PRESERVE_3D = {
  transformStyle: "preserve-3d",
  WebkitTransformStyle: "preserve-3d",
};

export default function ColiseoTop10({ items, onOpen }) {
  const reduced = useReducedMotion();
  return reduced ? <StaticGrid items={items} onOpen={onOpen} /> : <Ring items={items} onOpen={onOpen} />;
}

/* ───────────────────────── anillo 3D ───────────────────────── */

function Ring({ items }) {
  const rotation = useMotionValue(0); // grados — única fuente de verdad
  const [front, setFront] = useState(0);
  const mode = useRef("idle"); // idle | drag | settle | rest
  const anim = useRef(null);
  const restTimer = useRef(null);
  const lastX = useRef(0);
  const vel = useRef(0); // °/frame aprox durante el drag

  // Idle: rotación lenta continua (sin setState, solo el MotionValue)
  useAnimationFrame((_, delta) => {
    if (mode.current === "idle") rotation.set(rotation.get() - (IDLE_DPS * delta) / 1000);
  });

  // Índice frontal derivado de la rotación (único estado React)
  useEffect(
    () =>
      rotation.on("change", (r) => {
        const i = mod(Math.round(-r / STEP), items.length);
        setFront((f) => (f === i ? f : i));
      }),
    [rotation, items.length]
  );

  useEffect(() => () => clearTimeout(restTimer.current), []);

  const rest = useCallback(() => {
    mode.current = "rest";
    clearTimeout(restTimer.current);
    restTimer.current = setTimeout(() => (mode.current = "idle"), REST_MS);
  }, []);

  const interrupt = useCallback(() => {
    anim.current?.stop();
    clearTimeout(restTimer.current);
  }, []);

  // Inercia nativa de framer-motion con snap a múltiplos de 36°
  const release = useCallback(() => {
    mode.current = "settle";
    anim.current = animate(rotation, rotation.get(), {
      type: "inertia",
      velocity: vel.current * 60,
      power: 0.5,
      timeConstant: 320,
      modifyTarget: (t) => Math.round(t / STEP) * STEP, // snap a la carta frontal
      onComplete: rest,
    });
  }, [rotation, rest]);

  const goTo = useCallback(
    (i) => {
      interrupt();
      mode.current = "settle";
      const r = rotation.get();
      const d = mod(-i * STEP - r + 180, 360) - 180; // camino más corto
      anim.current = animate(rotation, r + d, {
        type: "spring",
        stiffness: 140,
        damping: 24,
        onComplete: rest,
      });
    },
    [rotation, interrupt, rest]
  );

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    interrupt();
    mode.current = "drag";
    lastX.current = e.clientX;
    vel.current = 0;
  };
  const onPointerMove = (e) => {
    if (mode.current !== "drag") return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    const dr = dx * 0.25;
    rotation.set(rotation.get() + dr);
    vel.current = vel.current * 0.6 + dr * 0.4;
  };
  const onPointerUp = () => {
    if (mode.current !== "drag") return;
    release();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") goTo((front + 1) % items.length);
    else if (e.key === "ArrowLeft") goTo((front + items.length - 1) % items.length);
  };

  const ringTransform = useTransform(rotation, (r) => `rotateY(${r}deg)`);
  const f = items[front];

  return (
    <section
      className="flex h-[680px] min-h-[580px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg text-fg select-none"
      aria-label="Top 10 — Coliseo de Leyendas"
    >
      {/* cabecera */}
      <header className="flex items-baseline justify-between px-6 pt-4">
        <div className="flex items-baseline gap-2.5">
          <span className="text-gold text-[22px] leading-none" style={{ fontFamily: "var(--font-kanji-serif)" }}>
            闘
          </span>
          <span className="text-[15px] font-semibold">Coliseo de Leyendas</span>
        </div>
        <span className="font-mono text-[11px] opacity-40">Top 10 · ELO base ·b</span>
      </header>

      {/* arena */}
      <div
        className="relative flex min-h-0 flex-1 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
        role="listbox"
        aria-activedescendant={`coliseo-card-${front}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* escena con cámara fija; escala fluida para mobile (390px sin desbordes) */}
        <div className="shrink-0" style={{ width: 1000, height: 620, scale: "clamp(0.4, 100vw / 1000px, 1)" }}>
          <div className="relative h-full w-full" style={{ perspective: 1300, perspectiveOrigin: "50% 36%" }}>
            {/* suelo de la arena */}
            <div
              className="absolute left-1/2 top-[54%] rounded-full border"
              style={{
                width: 920,
                height: 920,
                margin: "-460px 0 0 -460px",
                transform: "rotateX(90deg) translateZ(-180px)",
                borderColor: "color-mix(in oklab, var(--color-gold) 13%, transparent)",
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 10%, transparent), transparent 62%)",
              }}
            />
            {/* anillo */}
            <motion.div
              className="absolute left-1/2 top-[54%] h-0 w-0"
              style={{ ...PRESERVE_3D, transform: ringTransform }}
            >
              {items.map((c, i) => (
                <RingCard key={c.slug} c={c} i={i} rotation={rotation} front={front === i} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* HUD frontal */}
      <footer className="flex flex-col items-center gap-2.5 px-4 pb-5">
        <div className="flex min-h-[76px] flex-col items-center gap-0.5 text-center">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-xs text-gold">{String(front + 1).padStart(2, "0")}</span>
            <span className="text-sm text-gold/70" style={{ fontFamily: "var(--font-kanji-serif)" }}>
              {f.kanji}
            </span>
          </div>
          <h2 className="text-[26px] font-semibold leading-tight">{f.name}</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-[12.5px] opacity-50">{f.anime}</span>
            <span className="font-mono text-sm text-electric" title="ELO base estimado por popularidad. El ranking competitivo real está en /ranking.">ELO base {f.elo}</span>
          </div>
        </div>
        <nav className="flex" aria-label="Ir a posición">
          {items.map((c, i) => (
            <button
              key={c.slug}
              onClick={() => goTo(i)}
              aria-label={`Posición ${i + 1}: ${c.name}`}
              className={`px-1.5 py-1.5 font-mono text-[10px] leading-none transition-colors hover:text-gold ${
                i === front ? "text-gold" : "text-fg-muted/60"
              }`}
            >
              {String(i + 1).padStart(2, "0")}
            </button>
          ))}
        </nav>
        <p className="font-mono text-[10.5px] opacity-30">Arrastra para girar · ← → para navegar</p>
      </footer>
    </section>
  );
}

/* ───────────────────────── carta ───────────────────────── */

function RingCard({ c, i, rotation, front }) {
  // frontalidad ∈ [0,1] por coseno del ángulo respecto a cámara
  const frontness = useTransform(rotation, (r) => (Math.cos(((i * STEP + r) * Math.PI) / 180) + 1) / 2);
  const opacity = useTransform(frontness, (v) => 0.16 + 0.84 * Math.pow(v, 1.7)); // fog progresivo
  const liftAmt = useTransform(frontness, (v) => Math.pow(Math.max(0, (v - 0.82) / 0.18), 2));
  const liftT = useTransform(liftAmt, (v) => `translateZ(${(v * LIFT).toFixed(1)}px)`);

  return (
    <motion.div
      id={`coliseo-card-${i}`}
      role="option"
      aria-selected={front}
      className="absolute"
      style={{
        ...PRESERVE_3D,
        width: CARD_W,
        height: CARD_H,
        margin: `${-CARD_H / 2}px 0 0 ${-CARD_W / 2}px`,
        transform: `rotateY(${i * STEP}deg) translateZ(${RADIUS}px)`, // el cilindro
        opacity,
      }}
    >
      {/* wrapper de elevación — la frontal "sube" del anillo */}
      <motion.div className="absolute inset-0" style={{ ...PRESERVE_3D, transform: liftT }}>
        {/* glow oro de la carta frontal (opacity-only, composited) */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-3.5 rounded-[18px] border"
          style={{
            ...SAFARI_FACE,
            opacity: liftAmt,
            borderColor: "color-mix(in oklab, var(--color-gold) 55%, transparent)",
            boxShadow:
              "0 0 44px color-mix(in oklab, var(--color-gold) 38%, transparent), 0 0 110px color-mix(in oklab, var(--color-accent) 28%, transparent)",
          }}
        />

        {/* cara frontal */}
        <div
          className="absolute inset-0 overflow-hidden rounded-xl border bg-surface"
          style={{ ...SAFARI_FACE, borderColor: "color-mix(in oklab, var(--color-gold) 22%, transparent)" }}
        >
          <img
            src={img(c, 600)}
            srcSet={`${img(c, 300)} 300w, ${img(c, 600)} 600w`}
            sizes={`${CARD_W}px`}
            alt={c.name}
            draggable={false}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top"
            style={SAFARI_FACE}
          />
          {/* scrim de legibilidad solo donde hay texto */}
          <div
            className="absolute inset-0"
            style={{
              ...SAFARI_FACE,
              background:
                "linear-gradient(to top, color-mix(in oklab, var(--color-bg) 94%, transparent), color-mix(in oklab, var(--color-bg) 45%, transparent) 24%, transparent 54%)",
            }}
          />
          <span className="absolute left-3 top-2.5 font-mono text-xs text-gold" style={SAFARI_FACE}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="absolute inset-x-3.5 bottom-3 flex flex-col gap-1" style={SAFARI_FACE}>
            <span className="text-[15px] font-semibold leading-tight">{c.name}</span>
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] opacity-50">{c.anime}</span>
              <span className="font-mono text-xs text-gold">{c.elo}</span>
            </span>
          </div>
        </div>

        {/* cara trasera — emblema, evita el "contenido espejado" al fondo del anillo */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-xl border bg-surface"
          style={{
            ...SAFARI_FACE,
            transform: "rotateY(180deg)",
            borderColor: "color-mix(in oklab, var(--color-gold) 14%, transparent)",
            background:
              "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 62%)",
          }}
        >
          <span className="text-gold/35 text-[64px] leading-none" style={{ fontFamily: "var(--font-kanji-serif)", ...SAFARI_FACE }}>
            戦
          </span>
          <span className="font-mono text-[11px] opacity-30" style={SAFARI_FACE}>
            {String(i + 1).padStart(2, "0")}
          </span>
        </div>
      </motion.div>

      {/* reflejo especular falso — fuera del wrapper de elevación, pegado al suelo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full mt-1 overflow-hidden rounded-xl opacity-40"
        style={{
          ...SAFARI_FACE,
          height: CARD_H,
          transform: "scaleY(-1)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 42%, color-mix(in srgb, var(--color-bg) 65%, transparent) 100%)",
          maskImage: "linear-gradient(to bottom, transparent 42%, color-mix(in srgb, var(--color-bg) 65%, transparent) 100%)",
        }}
      >
        <img src={img(c, 300)} alt="" draggable={false} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" style={SAFARI_FACE} />
        <div className="absolute inset-0 bg-bg/55" style={SAFARI_FACE} />
      </div>
    </motion.div>
  );
}

/* ─────────────── fallback prefers-reduced-motion: grid estático ─────────────── */

function StaticGrid({ items }) {
  return (
    <section className="min-h-[60vh] bg-bg p-6 text-fg" aria-label="Top 10 — Coliseo de Leyendas">
      <header className="mx-auto mb-5 flex max-w-5xl items-baseline justify-between">
        <div className="flex items-baseline gap-2.5">
          <span className="text-gold text-[22px] leading-none" style={{ fontFamily: "var(--font-kanji-serif)" }}>
            闘
          </span>
          <span className="text-[15px] font-semibold">Coliseo de Leyendas</span>
        </div>
        <span className="font-mono text-[11px] opacity-40">Top 10 · ELO base ·b</span>
      </header>
      <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((c, i) => (
          <li
            key={c.slug}
            className="relative aspect-[2/3] overflow-hidden rounded-xl border bg-surface"
            style={{ borderColor: "color-mix(in oklab, var(--color-gold) 20%, transparent)" }}
          >
            <img src={img(c, 300)} srcSet={`${img(c, 300)} 300w, ${img(c, 600)} 600w`} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, color-mix(in oklab, var(--color-bg) 94%, transparent), color-mix(in oklab, var(--color-bg) 45%, transparent) 24%, transparent 54%)",
              }}
            />
            <span className="absolute left-3 top-2.5 font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
            <div className="absolute inset-x-3.5 bottom-3 flex flex-col gap-1">
              <span className="text-[15px] font-semibold leading-tight">{c.name}</span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] opacity-50">{c.anime}</span>
                <span className="font-mono text-xs text-gold">{c.elo}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
