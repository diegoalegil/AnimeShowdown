import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Globe2, Radio, Swords, TrendingUp, Trophy } from 'lucide-react'
import FloatingCards from './FloatingCards'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { getStatsPersonaje } from '../lib/personajes-core'
import { BRAND_VISUALS } from '../data/visual-assets'
import { useTorneos } from '../lib/torneosQueries'
import { endpoints } from '../lib/api'
import Button from './Button'
import StatPill from './StatPill'

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

function Hero({ catalogoPersonajes = [] }) {
  const { t } = useTranslation()
  const hasCatalog = catalogoPersonajes.length > 0
  const totalPersonajes = hasCatalog ? catalogoPersonajes.length : '—'
  const universos = hasCatalog
    ? new Set(catalogoPersonajes.map((p) => p.anime)).size
    : '—'
  const { data: torneos = [] } = useTorneos()
  const { data: votosRecientes } = useQuery({
    queryKey: ['hero', 'votos-recientes', 4],
    queryFn: () => endpoints.votosRecientes({ limit: 4 }),
    staleTime: 30 * 1000,
  })
  const eloMax = hasCatalog
    ? Math.max(...catalogoPersonajes.map((p) => getStatsPersonaje(p.slug).elo))
    : '—'
  const torneosVisibles = torneos.length > 0 ? torneos.length : '—'
  const torneoDestacado = torneos
    .filter((t) => Number(t.votosUltimos7Dias ?? 0) > 20)
    .sort((a, b) => Number(b.votosUltimos7Dias ?? 0) - Number(a.votosUltimos7Dias ?? 0))[0]
  // perf: CTAs principales del hero usan pointerdown
  // para feedback inmediato. La nav del Link sigue ocurriendo en click
  // (default del browser); el sonido va por delante.
  const ctaVotar = useInstantSoundPress('playClick')
  const ctaRanking = useInstantSoundPress('playClick')
  const heroVisual = BRAND_VISUALS.homeHero
  const heroImage = heroVisual.image || heroVisual.fallbackImage
  return (
    <section
      className="as-stage as-stage-visual as-stage-home relative flex min-h-[calc(100svh-4.5rem)] items-center justify-center overflow-hidden px-5 py-10 sm:px-8 sm:py-16 lg:py-18"
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
        className="relative z-10 flex max-w-5xl flex-col items-center gap-4 text-center sm:gap-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.img
          src="/logo.webp"
          alt=""
          width={240}
          height={240}
          className="h-28 w-28 object-contain sm:h-40 sm:w-40 lg:h-44 lg:w-44"
          style={{ filter: 'drop-shadow(0 0 60px rgb(159 29 44 / 0.52))' }}
          variants={logoVariants}
        />
        <motion.span
          className="as-kicker"
          variants={itemVariants}
        >
          Arena 1v1 · ranking vivo · retos diarios
        </motion.span>
        <motion.h1
          className="w-full max-w-[min(90vw,28rem)] text-balance text-[clamp(1.95rem,8vw,4.55rem)] font-extrabold leading-[1.02] tracking-normal sm:max-w-4xl"
          variants={itemVariants}
        >
          {t('hero.tituloAntes')}{' '}
          <span
            className="bg-gradient-to-r from-fg-strong via-gold to-accent bg-clip-text text-transparent motion-safe:animate-[shimmer_3.2s_ease-out_forwards]"
            style={{ backgroundSize: '200% auto' }}
          >
            {t('hero.tituloAnime')}
          </span>
          {' '}{t('hero.tituloDespues')}
        </motion.h1>
        <motion.p
          className="w-full max-w-[22rem] text-balance text-[clamp(0.98rem,1.55vw,1.15rem)] leading-relaxed text-fg-muted sm:max-w-2xl"
          variants={itemVariants}
        >
          {t('hero.subtitulo')}
        </motion.p>
        <motion.div
          className="mt-2 flex w-full max-w-[22rem] flex-col justify-center gap-3 sm:max-w-none sm:flex-row sm:flex-wrap"
          variants={itemVariants}
        >
          <Button
            as={Link}
            to="/votar"
            size="lg"
            onPointerDown={ctaVotar.onPointerDown}
            onClick={ctaVotar.onClick}
            className="group w-full sm:w-auto"
          >
            <Swords className="h-4 w-4" />
            {t('hero.ctaTorneos')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <Button
            as={Link}
            to="/ranking"
            variant="secondary"
            size="lg"
            onPointerDown={ctaRanking.onPointerDown}
            onClick={ctaRanking.onClick}
            className="w-full sm:w-auto"
          >
            <TrendingUp className="h-4 w-4" />
            {t('hero.ctaRanking')}
          </Button>
        </motion.div>
        <HeroVoteTicker votos={votosRecientes} />
        <motion.p
          className="mt-2 max-w-[22rem] text-center text-[11px] font-medium uppercase leading-5 tracking-[0.14em] text-fg-muted sm:max-w-none sm:tracking-[0.18em]"
          variants={itemVariants}
        >
          {t('hero.features')}
        </motion.p>
        <motion.div
          className="as-panel mt-3 grid w-full max-w-3xl grid-cols-2 gap-0 overflow-hidden rounded-2xl sm:grid-cols-4"
          variants={itemVariants}
        >
          <HeroStat icon={Swords} value={`${totalPersonajes}`} label={t('hero.stats.personajes')} />
          <HeroStat icon={Trophy} value={`${torneosVisibles}`} label={t('hero.stats.torneos')} />
          <HeroStat icon={Globe2} value={`${universos}`} label={t('hero.stats.universos')} />
          {/* eloMax viene de getStatsPersonaje, que es una estimación
              determinística. La etiqueta evita presentarlo como #1 real del
              ranking competitivo. */}
          <HeroStat icon={TrendingUp} value={`${eloMax}`} label={t('hero.stats.eloMaximo')} />
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
                {t('hero.torneoDestacado')}
              </p>
              <p className="truncate text-sm font-bold text-fg-strong">
                {torneoDestacado.nombre}
              </p>
            </div>
            <Link
              to={`/torneos/${torneoDestacado.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-[12px] font-black text-bg transition-colors hover:brightness-110"
            >
              {t('hero.verComunidad')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}

function HeroVoteTicker({ votos }) {
  const { t } = useTranslation()
  const items = (votos || []).filter((v) => v.ganador).slice(0, 3)
  if (items.length === 0) return null
  return (
    <motion.div
      variants={itemVariants}
      className="flex w-full max-w-2xl flex-col gap-1 rounded-2xl border border-success/25 bg-bg/55 px-4 py-3 text-left shadow-lift [--aura-color:rgb(16_185_129_/_0.55)] backdrop-blur-md sm:flex-row sm:items-center sm:gap-3"
      aria-label={t('hero.votesAria')}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-success">
        <Radio className="h-3.5 w-3.5" />
        {t('hero.votesNow')}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex animate-marquee gap-8 whitespace-nowrap motion-reduce:animate-none">
          {[...items, ...items].map((voto, index) => (
            <span
              key={`${voto.fecha}-${voto.ganador.slug}-${index}`}
              className="text-xs font-medium text-fg-muted"
            >
              <strong className="text-fg-strong">{voto.username ?? t('hero.votesFallbackUser')}</strong>{' '}
              {t('hero.votesAction')}{' '}
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
                  · {formatRelativo(voto.fecha, t)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function formatRelativo(fecha, t) {
  const diff = Date.now() - new Date(fecha).getTime()
  if (!Number.isFinite(diff) || diff < 0) return t('hero.timeNow')
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('hero.timeNow')
  if (min < 60) return t('hero.timeMinutes', { count: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('hero.timeHours', { count: h })
  return t('hero.timeToday')
}

function HeroStat({ icon: Icon, value, label }) {
  return (
    <StatPill
      icon={Icon}
      value={value}
      label={label}
      layout="inline"
      className="border-white/10 px-4 py-4 even:border-l sm:border-l first:sm:border-l-0"
    />
  )
}

export default Hero
