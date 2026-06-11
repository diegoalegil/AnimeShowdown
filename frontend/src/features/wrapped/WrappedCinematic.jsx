// WrappedCinematic.jsx — el Wrapped como scrollytelling vertical de capítulos
// full-viewport con scroll-snap: el opening de tu temporada.
//
// Stack: React 19 · Tailwind CSS v4 (tokens del proyecto, CERO hex en JSX) ·
// framer-motion 12. Sin libs nuevas; el pintor canvas del capítulo final
// (./wrapped-story-card) entra con import() dinámico cuando su capítulo
// se acerca al viewport — fuera del bundle inicial.
//
// Scroll-driven: el scroll ES el play-head.
//   · Con soporte de `animation-timeline: view()` (Chrome/Edge) los SLAM de
//     número, el micro-shake de aterrizaje y el zoom de scene son animaciones
//     CSS ligadas al view timeline — cero JS por frame, composición nativa.
//   · Fallback (Safari/Firefox): useScroll + useTransform de framer-motion
//     con los mismos keyframes; framer escribe transform/opacity directo al
//     style, sin re-render por frame.
//
// 60fps: SOLO transform/opacity. Nada de blur()/backdrop-blur ni SVG filters
// vivos (jank real de WebKit en este proyecto). La ráfaga de speed-lines son
// capas de repeating-linear-gradient pre-renderizadas que cruzan con
// translate3d + opacity durante 200ms.
//
// prefers-reduced-motion: secciones apiladas estáticas, sin snap, sin bursts,
// números ya aterrizados.
//
// Loops: no hay loops infinitos de rAF. La única animación repetida (chevrón
// del cover) solo corre mientras el cover es el capítulo activo y se pausa
// con la pestaña oculta vía la clase global `.as-tab-hidden`.
//
// Integración (WrappedPage.jsx):
//   const fandomSlug = slugDeAnime(data.fandomPrincipal) // catálogo
//   <WrappedCinematic data={data} username={data.username}
//                     fandomSlug={fandomSlug} temporada="2026" />
//
// `data` = shape de endpoints.miWrapped (votosTotales, duelosJugados,
// prediccionesAcertadas, badgesDesbloqueados, fandomPrincipal, personajeTop).

import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import {
  motion,
  animate,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion'
import { brandImage } from '../../lib/brand-assets'
import PersonajeImg from '../../components/PersonajeImg'
import ShareButtons from '../../components/ShareButtons'

const nf = new Intl.NumberFormat('es-ES')

const SUPPORTS_VIEW_TIMELINE =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline: view()')


// Capítulos de stats. Kanji con significado real, como manda la marca:
// 票 (hyō, papeleta/voto) · 戦 (sen, batalla) · 推 (oshi, tu favorito) ·
// 章 (shō, emblema/insignia).
const STAT_CHAPTERS = [
  {
    key: 'votosTotales',
    kanji: '票',
    eyebrow: 'Capítulo 01',
    claim: 'Tu voz movió el ranking',
    label: 'votos emitidos en la arena',
    focal: '20% 40%',
  },
  {
    key: 'duelosJugados',
    kanji: '戦',
    eyebrow: 'Capítulo 02',
    claim: 'Cada duelo, una decisión',
    label: 'duelos jugados',
    focal: '78% 42%',
  },
  {
    key: 'badgesDesbloqueados',
    kanji: '章',
    eyebrow: 'Capítulo 04',
    claim: 'Tu vitrina ganó acero y oro',
    label: 'logros desbloqueados',
    focal: '38% 60%',
  },
]

/* ─────────────────────────── SLAM de número ─────────────────────────── */

function SlamNumberStatic({ text }) {
  return (
    <div className="font-mono text-[clamp(6rem,19vw,13.5rem)] font-extrabold leading-[0.95] tracking-tight text-gold tabular-nums">
      {text}
    </div>
  )
}

// Vía CSS scroll-driven: slam + shake encadenados por animation-range sobre
// el view timeline del propio número. Cero JS por frame.
function SlamNumberCss({ text }) {
  return (
    <div
      style={{
        animationName: 'wrapped-shake',
        animationDuration: 'auto',
        animationFillMode: 'both',
        animationTimingFunction: 'linear',
        animationTimeline: 'view()',
        animationRange: 'entry 88% entry 100%',
      }}
    >
      <div
        className="font-mono text-[clamp(6rem,19vw,13.5rem)] font-extrabold leading-[0.95] tracking-tight text-gold tabular-nums [transform-origin:50%_60%]"
        style={{
          animationName: 'wrapped-slam',
          animationDuration: 'auto',
          animationFillMode: 'both',
          animationTimingFunction: 'linear',
          animationTimeline: 'view()',
          animationRange: 'entry 30% entry 96%',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// Fallback framer-motion: mismo timing, ligado al progreso de scroll de la
// sección dentro del scroller snap. El shake del frame de aterrizaje se
// dispara una vez al cruzar el umbral (y se rearma al salir del capítulo).
function SlamNumberMotion({ text, scrollerRef, sectionRef }) {
  const shakeRef = useRef(null)
  const landedRef = useRef(false)
  const { scrollYProgress } = useScroll({
    container: scrollerRef,
    target: sectionRef,
    offset: ['start end', 'start start'],
    layoutEffect: false,
  })
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.74, 0.88, 1],
    [2.6, 2.6, 0.94, 1.045, 1],
  )
  const opacity = useTransform(scrollYProgress, [0.3, 0.66], [0, 1])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v >= 0.88 && !landedRef.current) {
      landedRef.current = true
      if (shakeRef.current) {
        animate(
          shakeRef.current,
          { x: [0, -7, 6, -4, 3, 0], y: [0, 3, -4, 2, -1, 0] },
          { duration: 0.3, ease: 'easeOut' },
        )
      }
    } else if (v < 0.2) {
      landedRef.current = false
    }
  })

  return (
    <motion.div ref={shakeRef}>
      <motion.div
        style={{ scale, opacity }}
        className="font-mono text-[clamp(6rem,19vw,13.5rem)] font-extrabold leading-[0.95] tracking-tight text-gold tabular-nums [transform-origin:50%_60%]"
      >
        {text}
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────── Scene panorámica de fondo ───────────────────── */

function SceneBackdrop({ scene, focal, eager = false, reduce }) {
  const zoomStyle =
    !reduce && SUPPORTS_VIEW_TIMELINE
      ? {
          animationName: 'wrapped-scenezoom',
          animationDuration: 'auto',
          animationFillMode: 'both',
          animationTimingFunction: 'linear',
          animationTimeline: 'view()',
          animationRange: 'cover 0% cover 100%',
        }
      : undefined

  return (
    <>
      {scene ? (
        <img
          src={scene.src}
          srcSet={scene.srcSet}
          sizes="100vw"
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: focal, ...zoomStyle }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-surface to-bg" />
      )}
      {/* Scrim de legibilidad solo donde vive el texto (mitad inferior). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-bg via-bg/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg/70 to-transparent" />
    </>
  )
}

/* ───────────────── Ráfaga de speed-lines entre capítulos ─────────────── */
// Corte de viñeta manga: dos capas de repeating-linear-gradient diagonales
// (pre-renderizadas por el motor, sin filters) que cruzan en 200ms.
// Re-keyed por capítulo activo → replay garantizado; opacity termina en 0.

const SPEEDLINES_BG = [
  'repeating-linear-gradient(115deg, transparent 0px, transparent 26px, var(--color-fg-strong) 27px, var(--color-fg-strong) 29px, transparent 30px, transparent 72px)',
  'repeating-linear-gradient(115deg, transparent 0px, transparent 52px, var(--color-accent) 53px, var(--color-accent) 56px, transparent 57px, transparent 118px)',
].join(', ')

function SpeedLinesBurst({ burstKey }) {
  if (burstKey <= 0) return null
  return (
    <motion.div
      key={burstKey}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
      style={{ background: SPEEDLINES_BG }}
      initial={{ opacity: 0, x: '-6%' }}
      animate={{ opacity: [0, 0.85, 0], x: '7%' }}
      transition={{ duration: 0.2, ease: 'linear' }}
    />
  )
}

/* ──────────────────────────── Capítulos ─────────────────────────────── */

function ChapterShell({ sectionRef, label, reduce, children }) {
  return (
    <section
      ref={sectionRef}
      data-screen-label={label}
      className={`relative w-full overflow-hidden bg-bg ${
        reduce ? 'min-h-[100svh]' : 'h-[100svh] snap-start'
      }`}
    >
      {children}
    </section>
  )
}

function KanjiWatermark({ kanji }) {
  return (
    <span
      aria-hidden="true"
      lang="ja"
      className="pointer-events-none absolute right-[-2%] top-1/2 -translate-y-1/2 select-none text-[clamp(180px,52vh,460px)] font-semibold leading-none text-gold/10 [font-family:var(--font-kanji-serif)]"
    >
      {kanji}
    </span>
  )
}

function CoverChapter({ sectionRef, scene, username, temporada, reduce, active }) {
  return (
    <ChapterShell sectionRef={sectionRef} label="Wrapped — Opening" reduce={reduce}>
      <SceneBackdrop scene={scene} focal="50% 30%" eager reduce={reduce} />
      <KanjiWatermark kanji="開幕" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 px-6 pb-16 sm:px-12 sm:pb-20">
        <div className="h-0.5 w-10 bg-accent" />
        <p className="font-mono text-sm text-gold">AnimeShowdown Wrapped · Temporada {temporada}</p>
        <h1 className="max-w-[14ch] text-balance text-[clamp(2.6rem,9vw,5.5rem)] font-extrabold leading-[0.98] tracking-tight text-fg-strong">
          El opening de tu temporada
        </h1>
        <p className="text-[15px] text-fg-muted">@{username} — esto es lo que dejaste en la arena.</p>
        {!reduce && (
          <div
            className="wrapped-bob mt-6 text-fg-muted"
            style={{
              animation: 'wrapped-bob 1.6s ease-in-out infinite',
              animationPlayState: active ? 'running' : 'paused',
            }}
            aria-hidden="true"
          >
            ↓ desliza
          </div>
        )}
      </div>
    </ChapterShell>
  )
}

function StatChapter({ chapter, value, scene, scrollerRef, sectionRef, reduce }) {
  const text = nf.format(Number(value ?? 0))
  return (
    <ChapterShell sectionRef={sectionRef} label={`Wrapped — ${chapter.claim}`} reduce={reduce}>
      <SceneBackdrop scene={scene} focal={chapter.focal} reduce={reduce} />
      <KanjiWatermark kanji={chapter.kanji} />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-16 sm:px-12 sm:pb-20">
        <p className="font-mono text-[13px] text-gold">{chapter.eyebrow}</p>
        <p className="mt-1 max-w-[24ch] text-balance text-lg font-semibold text-fg sm:text-2xl">
          {chapter.claim}
        </p>
        <div className="mt-3">
          {reduce ? (
            <SlamNumberStatic text={text} />
          ) : SUPPORTS_VIEW_TIMELINE ? (
            <SlamNumberCss text={text} />
          ) : (
            <SlamNumberMotion text={text} scrollerRef={scrollerRef} sectionRef={sectionRef} />
          )}
        </div>
        <p className="mt-2 text-[15px] text-fg-muted">{chapter.label}</p>
      </div>
    </ChapterShell>
  )
}

function FandomChapter({ sectionRef, scene, data, reduce }) {
  return (
    <ChapterShell sectionRef={sectionRef} label="Wrapped — Fandom Nº1" reduce={reduce}>
      <SceneBackdrop scene={scene} focal="50% 50%" reduce={reduce} />
      <KanjiWatermark kanji="推" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-5 px-6 pb-16 sm:gap-8 sm:px-12 sm:pb-20">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-gold">Capítulo 03</p>
          <p className="mt-1 text-lg font-semibold text-fg sm:text-2xl">
            Hay un universo que defendiste más que ninguno
          </p>
          <h2 className="mt-3 max-w-[16ch] text-balance text-[clamp(2.2rem,8vw,4.5rem)] font-extrabold leading-[0.98] tracking-tight text-fg-strong">
            {data.fandomPrincipal ?? 'Tu fandom'}
          </h2>
          {data.personajeTop?.nombre && (
            <p className="mt-3 text-[15px] text-fg-muted">
              Con tu personaje Nº1:{' '}
              <span className="font-semibold text-gold">{data.personajeTop.nombre}</span>
            </p>
          )}
        </div>
        {data.personajeTop?.slug && (
          <div className="hidden shrink-0 overflow-hidden rounded-xl border border-gold/50 sm:block">
            <PersonajeImg
              slug={data.personajeTop.slug}
              nombre={data.personajeTop.nombre}
              width={150}
              height={225}
              sizes="150px"
              className="h-[225px] w-[150px]"
            />
          </div>
        )}
      </div>
    </ChapterShell>
  )
}

function FinalChapter({ sectionRef, cardData, shareUrl, shareText, reduce }) {
  const canvasRef = useRef(null)
  const paintersRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Pintado lazy: import() del painter cuando el capítulo se acerca.
  useEffect(() => {
    const node = sectionRef.current
    if (!node) return undefined
    let alive = true
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        import('./wrapped-story-card').then((mod) => {
          if (!alive || !canvasRef.current) return
          paintersRef.current = mod
          mod.paintWrappedStoryCard(canvasRef.current, cardData).then(() => {
            if (alive) setReady(true)
          })
        })
      },
      { rootMargin: '60% 0px' },
    )
    io.observe(node)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [sectionRef, cardData])

  const onDownload = async () => {
    const mod = paintersRef.current
    if (!mod || !canvasRef.current) return
    const ok = await mod.downloadWrappedStoryCard(canvasRef.current)
    setFeedback(ok ? 'Tarjeta descargada' : 'No se pudo exportar')
  }
  const onShare = async () => {
    const mod = paintersRef.current
    if (!mod || !canvasRef.current) return
    const result = await mod.shareWrappedStoryCard(canvasRef.current, {
      title: 'Mi AnimeShowdown Wrapped',
      text: shareText,
    })
    if (result === 'downloaded') setFeedback('Tu navegador no comparte archivos — descargada')
  }

  return (
    <ChapterShell sectionRef={sectionRef} label="Wrapped — Tu tarjeta" reduce={reduce}>
      <KanjiWatermark kanji="結" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 py-10">
        <div className="text-center">
          <p className="font-mono text-[13px] text-gold">Capítulo final</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-fg-strong sm:text-3xl">
            Tu tarjeta de temporada
          </h2>
        </div>
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          aria-label="Tarjeta resumen de tu temporada, lista para compartir"
          className={`h-[min(58svh,560px)] w-auto rounded-2xl border border-gold/30 bg-surface shadow-elev-3 transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-40'
          }`}
        />
        <p className="font-mono text-xs text-fg-muted">1080×1920 · pintada en canvas, lista para stories</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDownload}
            className="min-h-11 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-fg-strong transition-colors hover:bg-accent-hover"
          >
            Descargar imagen
          </button>
          <button type="button" onClick={onShare} className="as-button-ghost min-h-11 rounded-lg px-5 py-2.5 text-sm font-semibold">
            Compartir
          </button>
        </div>
        {feedback && <p className="text-[13px] text-fg-muted" role="status">{feedback}</p>}
        <ShareButtons url={shareUrl} texto={shareText} />
      </div>
    </ChapterShell>
  )
}

/* ─────────────────────────────── Raíz ───────────────────────────────── */

function WrappedCinematic({ data, username, temporada = '2026', fandomSlug = null }) {
  const reduce = useReducedMotion()
  const scrollerRef = useRef(null)
  // Array estable de refs por capítulo. createRef en useMemo (puro) en vez
  // de useRef(...).current: leer .current en render lo veta el compilador.
  const sectionRefs = useMemo(() => Array.from({ length: 6 }, () => createRef()), [])
  const [active, setActive] = useState(0)
  const [burst, setBurst] = useState(0)
  const activeRef = useRef(0)

  const scene = useMemo(
    () => (fandomSlug ? brandImage(`${fandomSlug}-scene-01`) : null),
    [fandomSlug],
  )

  // Capítulo activo por IntersectionObserver (sin scroll listener por frame).
  // Cada cambio de capítulo dispara la ráfaga de speed-lines.
  useEffect(() => {
    if (reduce) return undefined
    const root = scrollerRef.current
    if (!root) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = sectionRefs.findIndex((r) => r.current === entry.target)
          if (idx === -1) continue
          if (activeRef.current === idx) continue
          activeRef.current = idx
          setActive(idx)
          setBurst((b) => b + 1)
        }
      },
      { root, threshold: 0.55 },
    )
    sectionRefs.forEach((r) => r.current && io.observe(r.current))
    return () => io.disconnect()
  }, [reduce, sectionRefs])

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/wrapped` : '/wrapped'
  const shareText = `Mi AnimeShowdown Wrapped: ${nf.format(data?.votosTotales ?? 0)} votos${
    data?.fandomPrincipal ? ` y mi fandom Nº1 es ${data.fandomPrincipal}` : ''
  }. ¿Y el tuyo?`

  const cardData = useMemo(
    () => ({
      username,
      temporada,
      kanji: '戦',
      fandomPrincipal: data?.fandomPrincipal ?? null,
      personajeTop: data?.personajeTop ?? null,
      sceneUrl: fandomSlug
        ? `https://assets.animeshowdown.dev/img/brand/${fandomSlug}-scene-01-1280.webp`
        : null,
      votosTotales: data?.votosTotales,
      duelosJugados: data?.duelosJugados,
      prediccionesAcertadas: data?.prediccionesAcertadas,
      badgesDesbloqueados: data?.badgesDesbloqueados,
    }),
    [data, username, temporada, fandomSlug],
  )

  const totalChapters = 6

  return (
    <div
      ref={scrollerRef}
      className={
        reduce
          ? 'relative w-full bg-bg'
          : 'relative h-[100svh] w-full snap-y snap-mandatory overflow-y-auto overscroll-contain bg-bg'
      }
    >
      {/* Contador de capítulo, fijo — mono, sobrio */}
      {!reduce && (
        <div className="pointer-events-none fixed left-5 top-5 z-30 flex items-center gap-2 sm:left-8 sm:top-7">
          <span className="h-3 w-1 bg-accent" aria-hidden="true" />
          <span className="font-mono text-xs text-fg-muted tabular-nums">
            Cap. {String(active + 1).padStart(2, '0')} / {String(totalChapters).padStart(2, '0')}
          </span>
        </div>
      )}

      <CoverChapter
        sectionRef={sectionRefs[0]}
        scene={scene}
        username={username}
        temporada={temporada}
        reduce={reduce}
        active={active === 0}
      />
      <StatChapter
        chapter={STAT_CHAPTERS[0]}
        value={data?.votosTotales}
        scene={scene}
        scrollerRef={scrollerRef}
        sectionRef={sectionRefs[1]}
        reduce={reduce}
      />
      <StatChapter
        chapter={STAT_CHAPTERS[1]}
        value={data?.duelosJugados}
        scene={scene}
        scrollerRef={scrollerRef}
        sectionRef={sectionRefs[2]}
        reduce={reduce}
      />
      <FandomChapter sectionRef={sectionRefs[3]} scene={scene} data={data ?? {}} reduce={reduce} />
      <StatChapter
        chapter={STAT_CHAPTERS[2]}
        value={data?.badgesDesbloqueados}
        scene={scene}
        scrollerRef={scrollerRef}
        sectionRef={sectionRefs[4]}
        reduce={reduce}
      />
      <FinalChapter
        sectionRef={sectionRefs[5]}
        cardData={cardData}
        shareUrl={shareUrl}
        shareText={shareText}
        reduce={reduce}
      />

      {!reduce && <SpeedLinesBurst burstKey={burst} />}
    </div>
  )
}

export default WrappedCinematic
