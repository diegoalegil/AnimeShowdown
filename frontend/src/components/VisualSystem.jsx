import ResponsivePicture from './ResponsivePicture'
import { BRAND_VISUALS } from '../data/visual-assets'
import { AtmospherePreset } from './AtmosphereEffects'
import { isVisualDebugActive } from '../lib/visualDebug'
import VisualDebugBadge from './VisualDebugBadge'

function visualImage(visual, fallback = BRAND_VISUALS.empty) {
  return visual?.image || visual?.fallbackImage || fallback.image || fallback.fallbackImage
}

export function ParticleLayer({ className = '', density = 'normal' }) {
  // Dos capas superpuestas: partículas pequeñas tipo polvo + partículas
  // medianas con halo carmesí sutil, para que se sienta una atmósfera viva sin
  // distraer del contenido. La densidad sigue siendo configurable.
  const opacityDots = density === 'low' ? 'opacity-[0.12]' : density === 'high' ? 'opacity-[0.26]' : 'opacity-[0.20]'
  const opacityGlow = density === 'low' ? 'opacity-[0.06]' : density === 'high' ? 'opacity-[0.16]' : 'opacity-[0.11]'
  const sizeDots = density === 'low' ? '56px 56px' : density === 'high' ? '30px 30px' : '38px 38px'
  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${opacityDots} ${className}`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgb(255 255 255 / 0.24) 1px, transparent 0)',
          backgroundSize: sizeDots,
          maskImage: 'linear-gradient(to bottom, black, transparent 82%)',
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${opacityGlow}`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 3px 3px, rgb(255 80 120 / 0.55) 1.4px, transparent 0)',
          backgroundSize: '92px 92px',
          backgroundPosition: '12px 24px',
          maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 70%, transparent)',
        }}
      />
    </>
  )
}

export function KanjiBackdrop({ kanji = '戦', visual, className = '' }) {
  return (
    <span
      aria-hidden="true"
      lang="ja"
      className={`pointer-events-none absolute -right-8 top-5 select-none font-mono text-[9rem] font-black leading-none opacity-[0.07] sm:text-[13rem] ${className}`}
      style={{
        color: `rgb(${visual?.glowRgb ?? '197 161 90'} / 1)`,
        textShadow: `0 0 80px rgb(${visual?.accentRgb ?? '159 29 44'} / 0.45)`,
      }}
    >
      {kanji}
    </span>
  )
}

/**
 * Par de kanjis enormes a ambos lados verticales del hero, estilo ELO Duel
 * (referencia visual del producto): el kanji izquierdo gira en vertical-rl
 * a media altura, el derecho hace lo mismo en espejo. Da un marco
 * cinematografico inmediato sin saturar el contenido central.
 *
 * <p>Si se pasa un solo kanji, se duplica con leve cambio de tono. Si se
 * pasan dos ({ left, right }), se usan tal cual — util cuando el contexto
 * tiene una pareja semantica (ELO Duel: 競争 vs 対決, Anime Reveal: 謎 vs 影).
 */
export function LateralKanjiPair({ kanji, visual, intensity = 'normal' }) {
  const left = typeof kanji === 'object' ? kanji.left : kanji
  const right = typeof kanji === 'object' ? kanji.right : kanji
  const opacity = intensity === 'soft' ? 'opacity-[0.06] sm:opacity-[0.08]' : 'opacity-[0.09] sm:opacity-[0.13]'
  const glow = visual?.glowRgb ?? '197 161 90'
  const accent = visual?.accentRgb ?? '159 29 44'
  return (
    <>
      <span
        aria-hidden="true"
        lang="ja"
        className={`pointer-events-none absolute left-[-2vw] top-1/2 hidden -translate-y-1/2 select-none font-mono text-[18vw] font-black leading-none lg:block ${opacity}`}
        style={{
          color: `rgb(${glow} / 1)`,
          textShadow: `0 0 110px rgb(${accent} / 0.4)`,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}
      >
        {left}
      </span>
      <span
        aria-hidden="true"
        lang="ja"
        className={`pointer-events-none absolute right-[-2vw] top-1/2 hidden -translate-y-1/2 select-none font-mono text-[18vw] font-black leading-none lg:block ${opacity}`}
        style={{
          color: `rgb(${accent} / 1)`,
          textShadow: `0 0 110px rgb(${glow} / 0.32)`,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'translateY(-50%) scaleX(-1)',
        }}
      >
        {right}
      </span>
    </>
  )
}

export function VisualPageShell({
  visual = BRAND_VISUALS.homeHero,
  children,
  className = '',
  contentClassName = 'mx-auto max-w-7xl',
  density = 'normal',
  lateralKanji,
  atmosphere,
}) {
  // V-1: el fondo de stage ya NO usa foto. Los composites WebP de
  // `/img/stage/*` se veían pixelados en pantalla grande/retina en casi toda
  // la plataforma (menos el Home, que es procedural). Se sustituyen por un
  // fondo procedural —aurora carmesí/oro animada + malla radial + partículas
  // + kanji— nítido a cualquier resolución, de peso ~0 y coherente con el
  // Home. Los campos visual.shellImage/shellOpacity/shellObjectPosition
  // quedan sin efecto en el shell (siguen usándose en EditorialCover/hero).
  // atmosphere puede venir como:
  // - string ('demon-slayer', 'arena', etc.) → render AtmospherePreset
  // - React node directo → render tal cual
  // - null/undefined → leer del visual.atmosphere si existe (auto por slug)
  const atmosphereNode =
    typeof atmosphere === 'string'
      ? <AtmospherePreset preset={atmosphere} />
      : atmosphere ??
        (visual?.atmosphere ? <AtmospherePreset preset={visual.atmosphere} /> : null)
  // Patrón visual de referencia (Anime Reveal, ELO Duel): un kanji ENORME
  // a cada lado en vertical, dando marco cinematográfico al contenido.
  // Si la página pasa lateralKanji={{left, right}} usamos esa pareja
  // semántica; si pasa lateralKanji=null lo deshabilita; sino se duplica
  // el kanji del visual.
  const usarLateral = lateralKanji !== null
  const kanjiLateral =
    lateralKanji && typeof lateralKanji === 'object'
      ? lateralKanji
      : { left: visual?.kanji ?? '戦', right: visual?.kanji ?? '戦' }
  return (
    <section
      className={`relative isolate overflow-hidden px-5 py-12 sm:px-8 sm:py-16 ${className}`}
      style={{
        '--visual-accent': visual?.accentRgb ?? '159 29 44',
        '--visual-glow': visual?.glowRgb ?? '197 161 90',
      }}
    >
      {/* Imagen real + superficie plana: base sobria, una aurora sutil y
          descentrada, malla tenue de textura y vignette lineal. El contenido y
          el arte real mandan. */}
      <div aria-hidden="true" className="absolute inset-0 bg-bg" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="as-aurora-blob absolute -right-[20%] -top-[14%] hidden h-[44rem] w-[44rem] opacity-[0.10] motion-safe:animate-aurora-2 sm:block"
          style={{ '--aurora-color': 'rgb(var(--visual-accent) / 1)' }}
        />
      </div>
      {/* Malla geométrica tenue — textura sutil, no decorado. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgb(255 255 255 / 0.016) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.016) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'radial-gradient(ellipse 95% 65% at 50% 0%, black, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(ellipse 95% 65% at 50% 0%, black, transparent 82%)',
        }}
      />
      {/* Vignette lineal para legibilidad del contenido (sin acentos radiales). */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(7 10 18 / 0.22) 0%, rgb(7 10 18 / 0.62) 58%, rgb(7 10 18 / 0.90) 100%)',
        }}
      />
      <ParticleLayer density={density} />
      {/* Clamp de la atmósfera al viewport: los efectos canvas dimensionan su
          buffer al rect del padre; sobre el section completo, un listado largo
          (8000px+) creaba buffers de >90MB redibujados por rAF — presupuesto
          de raster destrozado y blank silencioso en Safari al superar su
          límite de canvas. El sticky h-screen mantiene los efectos siempre
          alrededor del viewport con buffer constante de una pantalla. */}
      {atmosphereNode && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sticky top-0 h-screen w-full">{atmosphereNode}</div>
        </div>
      )}
      {usarLateral && <LateralKanjiPair kanji={kanjiLateral} visual={visual} />}
      {isVisualDebugActive() && <VisualDebugBadge visual={visual} where="VisualPageShell" />}
      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </section>
  )
}

export function CinematicHero({
  visual = BRAND_VISUALS.homeHero,
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
  aside,
  // fx: capa decorativa que SUSTITUYE al KanjiBackdrop estático (p.ej. el
  // splash de tinta del hub de juegos). Quien la pasa es responsable de su
  // propio fallback estático para no perder el backdrop.
  fx,
}) {
  return (
    <div
      className={`relative isolate mb-8 overflow-hidden rounded-3xl border border-white/10 bg-bg/72 p-5 shadow-elev-3 backdrop-blur-xl sm:p-7 lg:p-8 ${className}`}
      style={{
        '--hero-accent': visual?.accentRgb ?? '159 29 44',
        '--hero-glow': visual?.glowRgb ?? '197 161 90',
      }}
    >
      <ResponsivePicture
        visual={visual}
        src={visualImage(visual)}
        className="absolute inset-0 opacity-85"
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
      />
      {/* Gradiente vertical con oscurecido lateral izquierdo para que el título
          sea legible y la imagen respire en centro/derecha. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(7 10 18 / 0.34) 0%, rgb(7 10 18 / 0.68) 70%, rgb(7 10 18 / 0.92) 100%), linear-gradient(90deg, rgb(7 10 18 / 0.62) 0%, rgb(7 10 18 / 0.18) 45%, transparent 80%), radial-gradient(circle at 20% 16%, rgb(var(--hero-accent) / 0.24), transparent 24rem), radial-gradient(circle at 82% 12%, rgb(var(--hero-glow) / 0.16), transparent 22rem)',
        }}
      />
      {fx ?? (
        <KanjiBackdrop kanji={visual?.kanji} visual={visual} className="top-1/2 -translate-y-1/2" />
      )}

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-end">
        <div className="flex min-w-0 flex-col items-start gap-4">
          {eyebrow && (
            // Eyebrow como texto de marca limpio en sentence-case.
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold"
              style={{ color: `rgb(${visual?.glowRgb ?? '197 161 90'} / 1)` }}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {eyebrow}
            </span>
          )}
          <div className="max-w-3xl">
            <h1 className="max-w-full text-balance break-words text-[clamp(2rem,5.4vw,4.75rem)] font-black leading-[1.02] tracking-tight text-fg-strong">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-fg-muted sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          {children}
        </div>
        {aside && <div className="relative hidden lg:block">{aside}</div>}
      </div>
    </div>
  )
}
