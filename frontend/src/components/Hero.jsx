import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Swords, TrendingUp } from 'lucide-react'
import FloatingCards from './FloatingCards'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { personajes, getStatsPersonaje } from '../data/personajes'
import { BRAND_VISUALS } from '../data/visual-assets'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const logoVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

function Hero() {
  const { t } = useTranslation()
  const totalPersonajes = personajes.length
  const universos = new Set(personajes.map((p) => p.anime)).size
  const top100Promedio = Math.round(
    [...personajes]
      .map((p) => getStatsPersonaje(p.slug).elo)
      .sort((a, b) => b - a)
      .slice(0, 100)
      .reduce((acc, elo) => acc + elo, 0) / 100,
  )
  // Audit perf 2026-05-18: CTAs principales del hero usan pointerdown
  // para feedback inmediato. La nav del Link sigue ocurriendo en click
  // (default del browser); el sonido va por delante.
  const ctaVotar = useInstantSoundPress('playClick')
  const ctaRanking = useInstantSoundPress('playClick')
  const heroVisual = BRAND_VISUALS.homeHero
  const heroImage = heroVisual.image || heroVisual.fallbackImage
  return (
    <section
      className="as-stage as-stage-visual as-stage-home relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20"
      style={{
        '--as-stage-image': `url("${heroImage}")`,
        '--as-stage-kanji': `"${heroVisual.kanji}"`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-accent opacity-24 blur-3xl animate-aurora-1" />
        <div className="absolute top-1/4 right-1/4 h-[24rem] w-[24rem] rounded-full bg-gold opacity-16 blur-3xl animate-aurora-2" />
        <div className="absolute -bottom-16 left-1/2 h-[26rem] w-[26rem] rounded-full bg-electric opacity-12 blur-3xl animate-aurora-3" />
      </div>
      <FloatingCards />
      <motion.div
        className="relative z-10 flex max-w-4xl flex-col items-center gap-6 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.img
          src="/logo.webp"
          alt=""
          width={240}
          height={240}
          className="h-40 w-40 object-contain sm:h-56 sm:w-56"
          style={{ filter: 'drop-shadow(0 0 60px rgb(159 29 44 / 0.52))' }}
          variants={logoVariants}
        />
        <motion.h1
          className="max-w-4xl text-[clamp(2.65rem,7vw,5.2rem)] font-extrabold leading-[0.98] tracking-tight"
          variants={itemVariants}
        >
          {t('hero.tituloAntes')}{' '}
          <span
            className="bg-gradient-to-r from-fg-strong via-gold to-accent bg-clip-text text-transparent animate-shimmer"
            style={{ backgroundSize: '200% auto' }}
          >
            {t('hero.tituloAnime')}
          </span>
          {' '}{t('hero.tituloDespues')}
        </motion.h1>
        <motion.p
          className="max-w-2xl text-[clamp(0.98rem,1.7vw,1.2rem)] leading-relaxed text-fg-muted"
          variants={itemVariants}
        >
          {t('hero.subtitulo')}
        </motion.p>
        <motion.div
          className="mt-2 flex flex-wrap justify-center gap-3"
          variants={itemVariants}
        >
          <Link
            to="/votar"
            onPointerDown={ctaVotar.onPointerDown}
            onClick={ctaVotar.onClick}
            className="group inline-flex items-center gap-2 rounded-lg border border-accent/55 bg-gradient-to-b from-accent-hover to-accent px-5 py-3 text-sm font-black text-white shadow-[0_0_34px_-14px_var(--color-accent),inset_0_1px_0_rgb(255_255_255_/_0.18)] transition-all animate-pulse-halo hover:-translate-y-0.5 hover:brightness-110"
          >
            <Swords className="h-4 w-4" />
            {t('hero.ctaTorneos')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/ranking"
            onPointerDown={ctaRanking.onPointerDown}
            onClick={ctaRanking.onClick}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-surface/60 px-5 py-3 text-sm font-semibold text-fg-strong backdrop-blur-md transition-colors hover:border-gold/55 hover:text-gold"
          >
            <TrendingUp className="h-4 w-4" />
            {t('hero.ctaRanking')}
          </Link>
        </motion.div>
        <motion.p
          className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted"
          variants={itemVariants}
        >
          {t('hero.features')}
        </motion.p>
        <motion.div
          className="as-panel mt-5 grid w-full max-w-4xl grid-cols-2 gap-0 overflow-hidden rounded-2xl sm:grid-cols-4"
          variants={itemVariants}
        >
          <HeroStat icon="⚔" value={`${totalPersonajes}`} label="Personajes" />
          <HeroStat icon="🏆" value="13" label="Torneos" />
          <HeroStat icon="👥" value={`${universos}`} label="Universos" />
          <HeroStat icon="↗" value={`${top100Promedio}`} label="ELO top 100" />
        </motion.div>
      </motion.div>
    </section>
  )
}

function HeroStat({ icon, value, label }) {
  return (
    <div className="flex items-center justify-center gap-3 border-white/10 px-4 py-4 even:border-l sm:border-l first:sm:border-l-0">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <div className="text-left">
        <p className="font-mono text-2xl font-extrabold text-fg-strong tabular-nums">
          {value}
        </p>
        <p className="text-[11px] text-fg-muted">{label}</p>
      </div>
    </div>
  )
}

export default Hero
