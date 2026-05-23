import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Radio, Swords, TrendingUp, Trophy } from 'lucide-react'
import FloatingCards from './FloatingCards'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { personajes, getStatsPersonaje } from '../lib/personajes-core'
import { BRAND_VISUALS } from '../data/visual-assets'
import { useTorneos } from '../lib/torneosQueries'
import { endpoints } from '../lib/api'

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
  const { data: torneos = [] } = useTorneos()
  const { data: votosRecientes } = useQuery({
    queryKey: ['hero', 'votos-recientes', 4],
    queryFn: () => endpoints.votosRecientes({ limit: 4 }),
    staleTime: 30 * 1000,
  })
  const eloMax = Math.max(...personajes.map((p) => getStatsPersonaje(p.slug).elo))
  const torneosVisibles = torneos.length > 0 ? torneos.length : '—'
  const torneoDestacado = torneos
    .filter((t) => Number(t.votosUltimos7Dias ?? 0) > 20)
    .sort((a, b) => Number(b.votosUltimos7Dias ?? 0) - Number(a.votosUltimos7Dias ?? 0))[0]
  // Revisión perf 2026-05-18: CTAs principales del hero usan pointerdown
  // para feedback inmediato. La nav del Link sigue ocurriendo en click
  // (default del browser); el sonido va por delante.
  const ctaVotar = useInstantSoundPress('playClick')
  const ctaRanking = useInstantSoundPress('playClick')
  const heroVisual = BRAND_VISUALS.homeHero
  const heroImage = heroVisual.image || heroVisual.fallbackImage
  return (
    <section
      className="as-stage as-stage-visual as-stage-home relative flex min-h-[calc(100svh-5rem)] items-center justify-center overflow-hidden px-5 py-14 sm:px-8 sm:py-20"
      style={{
        '--as-stage-image': `url("${heroImage}")`,
        '--as-stage-kanji': `"${heroVisual.kanji}"`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 hidden h-[28rem] w-[28rem] rounded-full bg-accent opacity-24 blur-3xl motion-safe:animate-aurora-1 md:block" />
        <div className="absolute top-1/4 right-1/4 hidden h-[24rem] w-[24rem] rounded-full bg-gold opacity-16 blur-3xl motion-safe:animate-aurora-2 md:block" />
        <div className="absolute -bottom-16 left-1/2 hidden h-[26rem] w-[26rem] rounded-full bg-electric opacity-12 blur-3xl motion-safe:animate-aurora-3 md:block" />
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
          className="w-full max-w-[22rem] text-balance text-[clamp(2.05rem,9vw,5.2rem)] font-extrabold leading-[1.02] tracking-normal sm:max-w-4xl"
          variants={itemVariants}
        >
          {t('hero.tituloAntes')}{' '}
          <span
            className="bg-gradient-to-r from-fg-strong via-gold to-accent bg-clip-text text-transparent motion-safe:animate-shimmer"
            style={{ backgroundSize: '200% auto' }}
          >
            {t('hero.tituloAnime')}
          </span>
          {' '}{t('hero.tituloDespues')}
        </motion.h1>
        <motion.p
          className="w-full max-w-[22rem] text-balance text-[clamp(0.98rem,1.7vw,1.2rem)] leading-relaxed text-fg-muted sm:max-w-2xl"
          variants={itemVariants}
        >
          {t('hero.subtitulo')}
        </motion.p>
        <HeroVoteTicker votos={votosRecientes} />
        <motion.div
          className="mt-2 flex flex-wrap justify-center gap-3"
          variants={itemVariants}
        >
          <Link
            to="/votar"
            onPointerDown={ctaVotar.onPointerDown}
            onClick={ctaVotar.onClick}
            className="group inline-flex items-center gap-2 rounded-lg border border-accent/55 bg-gradient-to-b from-accent-hover to-accent px-5 py-3 text-sm font-black text-white shadow-[0_0_34px_-14px_var(--color-accent),inset_0_1px_0_rgb(255_255_255_/_0.18)] transition-all hover:-translate-y-0.5 hover:brightness-110"
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
          className="mt-2 max-w-[22rem] text-center text-[11px] font-medium uppercase leading-5 tracking-[0.14em] text-fg-muted sm:max-w-none sm:tracking-[0.18em]"
          variants={itemVariants}
        >
          {t('hero.features')}
        </motion.p>
        <motion.div
          className="as-panel mt-5 grid w-full max-w-4xl grid-cols-2 gap-0 overflow-hidden rounded-2xl sm:grid-cols-4"
          variants={itemVariants}
        >
          <HeroStat icon="⚔" value={`${totalPersonajes}`} label="Personajes" />
          <HeroStat icon="🏆" value={`${torneosVisibles}`} label="Torneos visibles" />
          <HeroStat icon="👥" value={`${universos}`} label="Universos" />
          {/* Revisión AS-010 (2026-05-23): eloMax viene de
              getStatsPersonaje (sintético determinístico). Etiquetamos
              como "Top ELO base" para no afirmar que es el #1 real del
              ranking competitivo. */}
          <HeroStat icon="↗" value={`${eloMax}`} label="Top ELO base" />
        </motion.div>
        {torneoDestacado && (
          <motion.div
            className="as-panel flex w-full max-w-2xl flex-col items-center gap-3 rounded-xl border-gold/35 bg-gold/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left"
            variants={itemVariants}
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Trophy className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gold">
                Torneo destacado
              </p>
              <p className="truncate text-sm font-bold text-fg-strong">
                {torneoDestacado.nombre}
              </p>
            </div>
            <Link
              to={`/torneos/${torneoDestacado.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-[12px] font-black text-bg transition-colors hover:brightness-110"
            >
              Ver comunidad
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}

function HeroVoteTicker({ votos }) {
  const items = (votos || []).filter((v) => v.ganador).slice(0, 3)
  if (items.length === 0) return null
  return (
    <motion.div
      variants={itemVariants}
      className="flex w-full max-w-2xl flex-col gap-1 rounded-2xl border border-emerald-400/25 bg-bg/55 px-4 py-3 text-left shadow-[0_20px_70px_-45px_rgba(16,185,129,0.55)] backdrop-blur-md sm:flex-row sm:items-center sm:gap-3"
      aria-label="Votos recientes de la comunidad"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
        <Radio className="h-3.5 w-3.5" />
        Ahora
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex animate-marquee gap-8 whitespace-nowrap motion-reduce:animate-none">
          {[...items, ...items].map((voto, index) => (
            <span
              key={`${voto.fecha}-${voto.ganador.slug}-${index}`}
              className="text-xs font-medium text-fg-muted"
            >
              <strong className="text-fg-strong">{voto.username ?? 'alguien'}</strong>{' '}
              votó por{' '}
              <Link
                to={`/personajes/${voto.ganador.slug}`}
                className="font-semibold text-gold hover:underline"
              >
                {voto.ganador.nombre}
              </Link>
              {voto.rival && (
                <>
                  {' '}vs {voto.rival.nombre}
                </>
              )}
              {voto.fecha && (
                <span className="ml-1 text-fg-muted/75">
                  · {formatRelativo(voto.fecha)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function formatRelativo(fecha) {
  const diff = Date.now() - new Date(fecha).getTime()
  if (!Number.isFinite(diff) || diff < 0) return 'ahora'
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return 'hoy'
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
        <p className="text-xs text-fg-muted">{label}</p>
      </div>
    </div>
  )
}

export default Hero
