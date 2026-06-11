// Hero cinematográfico de la página de detalle de anime.
// Stack: React 19 · Tailwind CSS v4 (tokens del proyecto, cero hex) · framer-motion 12
// 60fps: solo se anima transform/opacity. prefers-reduced-motion respetado vía useReducedMotion.
//
// Props:
//   sceneSrc    — URL de la scene panorámica (desde el PR 452, visual.image YA
//                 es la scene del banco si el anime tiene arte; si no, el banner local)
//   sceneSrcSet — srcset responsive del visual (visual.imageWebpSrcset); si falta
//                 se sirve solo sceneSrc — NO se derivan variantes a ciegas, que
//                 los fallbacks de stage no las tienen y serían 404s
//   symbolSrc   — emblema cuadrado del anime (null ⇒ sin medallón)
//   nombre      — nombre del anime
//   kanji       — kanji temático con significado (忍 para Naruto, 戦, 決…)
//   stats       — [{ label, value, gold?, hint? }] (value numérico se formatea es-ES)
//   actions     — CTAs bajo las stats (votar / ranking / top5 / compartir)
//   aside       — dossier de identidad, columna derecha en lg+
//   slug        — slug del anime: ancla el morph scene → hero con la cover
//                 del catálogo (view-transition-name compartido)

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import AnimeSceneMorph from '../../components/AnimeSceneMorph'
import { peekAnimeSceneMorphEntry } from '../../lib/animeSceneMorph'

const EASE = [0.22, 1, 0.36, 1]
const nf = new Intl.NumberFormat('es-ES')

function AnimeCinematicHero({
  sceneSrc,
  sceneSrcSet,
  symbolSrc,
  nombre,
  kanji = '戦',
  stats = [],
  actions,
  aside,
  slug,
}) {
  const reduce = useReducedMotion()
  // true solo si esta ficha entró vía el morph del catálogo: el morph ES la
  // entrada, así que el slow-zoom se salta (apilados, la captura del UA
  // congelaría un frame intermedio del scale). Lectura pura: la señal la
  // consume el adopt de AnimeSceneMorph, ya en fase de effects.
  const [viaMorph] = useState(peekAnimeSceneMorphEntry)

  // Variante compartida para el stagger del texto (transform/opacity only)
  const rise = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    show: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0 }
        : { duration: 0.55, delay: 0.22 + i * 0.1, ease: EASE },
    }),
  }

  return (
    <header className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-bg shadow-elev-3">
      {/* ───── Scene full-bleed del card, ~55vh ───── */}
      <div className="relative h-[55vh] max-h-[560px] min-h-[380px] overflow-hidden bg-surface">
        {/* Lienzo nombrado del morph: img + kanji + scrim. El scrim DEBE
            viajar para que la legibilidad cross-fadee con la geometría; el
            kanji vive entre img y scrim y no puede quedarse fuera del grupo.
            Título y medallón quedan fuera — snapshot limpio. */}
        <AnimeSceneMorph slug={slug} kind="hero" className="absolute inset-0">
          {/* Slow-zoom de entrada: scale 1.06 → 1 en 1.2s */}
          <motion.img
            src={sceneSrc}
            srcSet={sceneSrcSet || undefined}
            sizes="(min-width: 1280px) 1152px, 100vw"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover [object-position:50%_30%] [transform-origin:50%_35%]"
            initial={reduce || viaMorph ? false : { scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: EASE }}
          />

          {/* Kanji temático como marca de agua lateral — kanji real, muy tenue */}
          <span
            aria-hidden="true"
            lang="ja"
            className="pointer-events-none absolute right-[1%] top-1/2 -translate-y-[52%] select-none text-[clamp(190px,42vh,430px)] font-semibold leading-none text-gold/10 [font-family:var(--font-kanji-serif)]"
          >
            {kanji}
          </span>

          {/* Scrim de legibilidad — solo en la zona inferior, donde vive el texto */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-bg via-bg/55 to-transparent" />
        </AnimeSceneMorph>

        {/* Título, abajo a la izquierda sobre el scrim */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-7 sm:px-10 sm:pb-9">
          <motion.div
            custom={0}
            variants={rise}
            initial="hidden"
            animate="show"
            className="h-0.5 w-10 bg-accent"
          />
          <motion.h1
            custom={1}
            variants={rise}
            initial="hidden"
            animate="show"
            className="mt-3 max-w-[16ch] text-balance text-[clamp(2.4rem,6vw,4.25rem)] font-extrabold leading-[0.98] tracking-tight text-fg-strong"
          >
            {nombre}
          </motion.h1>
        </div>
      </div>

      {/* ───── Banda inferior: stats + CTAs + dossier, con el medallón a caballo ───── */}
      <div className="relative border-t border-gold/20 bg-surface px-5 sm:px-10">
        {/* Medallón con borde oro, a caballo entre la scene y la banda.
            Fade + rise al asentarse el morph: vive fuera del lienzo nombrado
            (no viaja en el snapshot) y su delay debe seguir siendo ≥ los
            360ms del morph para aparecer cuando la scene ya aterrizó. */}
        {symbolSrc && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.5, ease: EASE }}
            className="absolute -top-10 right-5 size-20 rounded-full border border-gold/70 bg-bg p-1 shadow-[0_0_0_6px] shadow-bg/60 sm:-top-12 sm:right-10 sm:size-24"
          >
            <img
              src={symbolSrc}
              alt={`Emblema de ${nombre}`}
              loading="lazy"
              className="size-full rounded-full object-cover"
            />
          </motion.div>
        )}

        <div className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.4fr)] lg:items-start">
          <div className="min-w-0">
            {/* Stats en mono, tabular-nums */}
            <div className="grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 sm:gap-x-10">
              {stats.map((s, i) => (
                <motion.div key={s.label} custom={2 + i} variants={rise} initial="hidden" animate="show">
                  <div
                    className={`font-mono text-lg font-extrabold tabular-nums sm:text-2xl ${
                      s.gold ? 'text-gold' : 'text-fg-strong'
                    }`}
                  >
                    {typeof s.value === 'number' ? nf.format(s.value) : s.value}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-fg-muted sm:text-xs">
                    {s.hint ? `${s.label} · ${s.hint}` : s.label}
                  </div>
                </motion.div>
              ))}
            </div>
            {actions && (
              <motion.div
                custom={2 + stats.length}
                variants={rise}
                initial="hidden"
                animate="show"
                className="mt-5 flex flex-wrap gap-3"
              >
                {actions}
              </motion.div>
            )}
          </div>
          {/* pt-12 en lg: deja aire bajo el medallón, que vive en esa esquina */}
          {aside && <div className="relative hidden lg:block lg:pt-12">{aside}</div>}
        </div>
      </div>
    </header>
  )
}

export default AnimeCinematicHero
