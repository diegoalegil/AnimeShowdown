import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import EditorialCover from './EditorialCover'
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
  const opacityDots = density === 'low' ? 'opacity-[0.10]' : density === 'high' ? 'opacity-[0.22]' : 'opacity-[0.17]'
  const opacityGlow = density === 'low' ? 'opacity-[0.05]' : density === 'high' ? 'opacity-[0.14]' : 'opacity-[0.09]'
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
  const opacity = intensity === 'soft' ? 'opacity-[0.05] sm:opacity-[0.07]' : 'opacity-[0.07] sm:opacity-[0.10]'
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
  // shellImage (vertical 2:3) tiene preferencia sobre image (horizontal 16:9)
  // cuando exista. Razón: el shell envuelve toda la sección de la página
  // (200vh+ scrolleable). Una imagen 16:9 estirada para cubrir eso se
  // recorta arriba y abajo dejando solo el centro vertical. Una imagen
  // 2:3 portrait encaja nativamente con el flow vertical de la página.
  const image = visual?.shellImage || visualImage(visual)
  const hasShellImage = Boolean(visual?.shellImage)
  // Si hay shellImage vertical → anchor al top (se ve la parte de arriba
  // nítida cuando carga, el fade hacia bottom queda detrás del scroll).
  // Si solo hay imagen horizontal → usar el objectPosition del visual.
  const shellBackgroundPosition =
    visual?.shellObjectPosition ?? (hasShellImage ? 'center top' : 'center center')
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
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-75"
        style={{
          backgroundImage: `url("${image}")`,
          backgroundPosition: shellBackgroundPosition,
          backgroundSize: 'cover',
        }}
      />
      {/* Vignette progresiva hacia abajo: la imagen respira arriba y el texto
          queda legible abajo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(7 10 18 / 0.42) 0%, rgb(7 10 18 / 0.78) 55%, rgb(7 10 18 / 0.94) 100%), radial-gradient(circle at 20% 10%, rgb(var(--visual-accent) / 0.20), transparent 30rem), radial-gradient(circle at 82% 0%, rgb(var(--visual-glow) / 0.10), transparent 26rem)',
        }}
      />
      <ParticleLayer density={density} />
      {atmosphereNode}
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
}) {
  return (
    <div
      className={`relative isolate mb-8 overflow-hidden rounded-3xl border border-white/10 bg-bg/72 p-5 shadow-[0_28px_110px_-55px_rgb(0_0_0)] backdrop-blur-xl sm:p-7 lg:p-8 ${className}`}
      style={{
        '--hero-accent': visual?.accentRgb ?? '159 29 44',
        '--hero-glow': visual?.glowRgb ?? '197 161 90',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-85"
        style={{
          backgroundImage: `url("${visualImage(visual)}")`,
          backgroundPosition: visual?.objectPosition ?? 'center',
        }}
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
      <ParticleLayer density="normal" />
      <KanjiBackdrop kanji={visual?.kanji} visual={visual} className="top-1/2 -translate-y-1/2" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-end">
        <div className="flex min-w-0 flex-col items-start gap-4">
          {eyebrow && (
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
              style={{
                borderColor: `rgb(${visual?.accentRgb ?? '159 29 44'} / 0.48)`,
                background: `rgb(${visual?.accentRgb ?? '159 29 44'} / 0.17)`,
                color: `rgb(${visual?.glowRgb ?? '197 161 90'} / 1)`,
              }}
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

export function VisualCard({
  to,
  visual,
  title,
  eyebrow,
  meta,
  children,
  className = '',
  coverClassName = 'h-48',
}) {
  const Wrapper = to ? Link : 'div'
  const props = to ? { to } : {}
  return (
    <Wrapper
      {...props}
      className={`as-panel group block overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-gold/45 hover:shadow-[0_0_70px_-28px_rgba(197,161,90,0.7)] ${className}`}
    >
      <EditorialCover
        visual={visual}
        title={title}
        eyebrow={eyebrow}
        meta={meta}
        className={`${coverClassName} rounded-none border-0`}
        imageClassName="saturate-110 contrast-105"
        compact
      />
      {children && <div className="p-5">{children}</div>}
    </Wrapper>
  )
}

export function EmptyStateScene({
  visual = BRAND_VISUALS.empty,
  icon: Icon,
  title,
  children,
  action,
  className = '',
}) {
  return (
    <div
      className={`relative flex min-h-80 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-dashed border-white/12 bg-surface/50 p-8 text-center sm:p-12 ${className}`}
      style={{
        '--empty-accent': visual?.accentRgb ?? '159 29 44',
        '--empty-glow': visual?.glowRgb ?? '197 161 90',
      }}
    >
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-70"
        imageClassName="saturate-110 contrast-105"
      />
      {Icon && (
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/35 bg-gold/10 text-gold shadow-[0_0_42px_-18px_rgba(197,161,90,0.8)]">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h2 className="relative max-w-xl text-2xl font-black tracking-tight text-fg-strong">
        {title}
      </h2>
      {children && <div className="relative max-w-lg text-sm leading-7 text-fg-muted">{children}</div>}
      {action && (
        <Link
          to={action.to}
          className="relative inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/90 px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
