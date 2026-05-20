import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import EditorialCover from './EditorialCover'
import { BRAND_VISUALS } from '../data/visual-assets'

function visualImage(visual, fallback = BRAND_VISUALS.empty) {
  return visual?.image || visual?.fallbackImage || fallback.image || fallback.fallbackImage
}

export function ParticleLayer({ className = '', density = 'normal' }) {
  const opacity = density === 'low' ? 'opacity-[0.10]' : 'opacity-[0.16]'
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${opacity} ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 2px 2px, rgb(255 255 255 / 0.22) 1px, transparent 0)',
        backgroundSize: density === 'low' ? '54px 54px' : '38px 38px',
        maskImage: 'linear-gradient(to bottom, black, transparent 82%)',
      }}
    />
  )
}

export function KanjiBackdrop({ kanji = '戦', visual, className = '' }) {
  return (
    <span
      aria-hidden="true"
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

export function VisualPageShell({
  visual = BRAND_VISUALS.homeHero,
  children,
  className = '',
  contentClassName = 'mx-auto max-w-7xl',
  density = 'low',
}) {
  const image = visualImage(visual)
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
        className="absolute inset-0 bg-cover bg-center opacity-75"
        style={{
          backgroundImage: `url("${image}")`,
          backgroundPosition: visual?.objectPosition ?? 'center',
        }}
      />
      {/* Audit visual (2026-05-20): el gradient anterior empezaba en
          rgb(7 10 18 / 0.82) (82% oscuro arriba) y subia a 0.97 al medio,
          apagando la imagen entera. Nuevo: arriba semi-transparente para
          que la imagen respire, vignette progresiva hacia abajo para que
          el contenido textual encima sea legible. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(7 10 18 / 0.42) 0%, rgb(7 10 18 / 0.78) 55%, rgb(7 10 18 / 0.94) 100%), radial-gradient(circle at 20% 10%, rgb(var(--visual-accent) / 0.20), transparent 30rem), radial-gradient(circle at 82% 0%, rgb(var(--visual-glow) / 0.10), transparent 26rem)',
        }}
      />
      <ParticleLayer density={density} />
      <KanjiBackdrop kanji={visual?.kanji} visual={visual} />
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
        className="absolute inset-0 bg-cover bg-center opacity-75"
        style={{
          backgroundImage: `url("${visualImage(visual)}")`,
          backgroundPosition: visual?.objectPosition ?? 'center',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgb(7 10 18 / 0.94), rgb(7 10 18 / 0.74) 45%, rgb(7 10 18 / 0.30) 100%), linear-gradient(180deg, rgb(7 10 18 / 0.22), rgb(7 10 18 / 0.88)), radial-gradient(circle at 20% 16%, rgb(var(--hero-accent) / 0.26), transparent 24rem), radial-gradient(circle at 78% 18%, rgb(var(--hero-glow) / 0.18), transparent 22rem)',
        }}
      />
      <ParticleLayer density="low" />
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
            <h1 className="text-[clamp(2.35rem,6vw,4.75rem)] font-black leading-[0.98] tracking-tight text-fg-strong">
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
