import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Swords, TrendingUp } from 'lucide-react'
import FloatingCards from './FloatingCards'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'

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
  // Audit perf 2026-05-18: CTAs principales del hero usan pointerdown
  // para feedback inmediato. La nav del Link sigue ocurriendo en click
  // (default del browser); el sonido va por delante.
  const ctaVotar = useInstantSoundPress('playClick')
  const ctaRanking = useInstantSoundPress('playClick')
  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-accent opacity-30 blur-3xl animate-aurora-1" />
        <div className="absolute top-1/4 right-1/4 h-[24rem] w-[24rem] rounded-full bg-purple-500 opacity-25 blur-3xl animate-aurora-2" />
        <div className="absolute -bottom-16 left-1/2 h-[26rem] w-[26rem] rounded-full bg-cyan-400 opacity-15 blur-3xl animate-aurora-3" />
      </div>
      <FloatingCards />
      <motion.div
        className="relative z-10 flex max-w-3xl flex-col items-center gap-6 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.img
          src="/logo.webp"
          alt=""
          width={240}
          height={240}
          className="h-44 w-44 object-contain sm:h-56 sm:w-56"
          style={{ filter: 'drop-shadow(0 0 50px rgb(255 46 99 / 0.4))' }}
          variants={logoVariants}
        />
        <motion.h1
          className="text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] tracking-tight"
          variants={itemVariants}
        >
          {t('hero.tituloAntes')}{' '}
          <span
            className="bg-gradient-to-r from-accent via-fuchsia-400 to-pink-300 bg-clip-text text-transparent animate-shimmer"
            style={{ backgroundSize: '200% auto' }}
          >
            {t('hero.tituloAnime')}
          </span>
          {' '}{t('hero.tituloDespues')}
        </motion.h1>
        <motion.p
          className="max-w-xl text-[clamp(0.9375rem,1.6vw,1.125rem)] leading-relaxed text-fg-muted"
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
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-all animate-pulse-halo hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            {t('hero.ctaTorneos')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/ranking"
            onPointerDown={ctaRanking.onPointerDown}
            onClick={ctaRanking.onClick}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-5 py-3 text-sm font-semibold text-fg-strong backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
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
      </motion.div>
    </section>
  )
}

export default Hero
