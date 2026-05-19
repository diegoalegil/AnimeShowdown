import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  PlayCircle,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import TorneoCard from '../components/TorneoCard'
import EditorialCover from '../components/EditorialCover'
import { useTorneos } from '../lib/torneosQueries'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useAuth } from '../contexts/AuthContext'
import { personajes, getStatsPersonaje } from '../data/personajes'
import { BRAND_VISUALS, getTournamentVisual } from '../data/visual-assets'

/**
 * Sugerencias temáticas computadas en module load. Cuando la BD está vacía
 * (empty state), mostramos 3 mockup cards con avatares reales del catálogo
 * para que la página tenga textura y sugiera qué tipo de brackets corren
 * aquí — en vez de un panel vacío que parece app rota.
 */
const SUGERENCIAS_TORNEO = (() => {
  // Top 8 por ELO (mismo bracket que el cron auto-genera más a menudo)
  const top8 = [...personajes]
    .map((p) => ({ ...p, elo: getStatsPersonaje(p.slug).elo }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 8)
  // 8 shōnen mainstream — heurística: animes con ≥3 personajes muy votados
  const shonenAnimes = new Set([
    'One Piece', 'Naruto', 'Dragon Ball', 'Bleach', 'My Hero Academia',
    'Demon Slayer', 'Jujutsu Kaisen', 'Hunter x Hunter',
  ])
  const shonen = personajes
    .filter((p) => shonenAnimes.has(p.anime))
    .map((p) => ({ ...p, elo: getStatsPersonaje(p.slug).elo }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 8)
  // Personajes femeninos populares (heurística simple por nombre conocido)
  const bestGirls = personajes
    .filter((p) => /^(makima|mai_sakurajima|rem|nezuko|mikasa|shinobu|hinata|zero_two|asuna|misa_amane|momo_ayase|emilia|holo|chizuru|mio_isurugi|nico_robin)$/i.test(p.slug))
    .slice(0, 8)
  return [
    { titulo: 'Top 8 ELO', descripcion: 'Los 8 con más fuerza del ranking', cast: top8 },
    { titulo: 'Shōnen Showdown', descripcion: '8 leyendas del shōnen mainstream', cast: shonen },
    { titulo: 'Best Girls 2026', descripcion: 'Las más votadas por la comunidad', cast: bestGirls.length >= 4 ? bestGirls : top8.slice(2, 8) },
  ]
})()

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Audit producto (2026-05-18): la página antes era título + spinner +
 * footer y un grid plano sin separar estados. Ahora:
 *
 * <ul>
 *   <li>Skeleton de 6 cards mientras carga (perceptual mejor que spinner).</li>
 *   <li>Secciones agrupadas por estado: En curso · Próximamente · Historial.
 *       Cada sección solo aparece si tiene items, así no hay headers vacíos.</li>
 *   <li>Empty state premium cuando no hay torneos en BD: copy explicativo
 *       sobre el cron de auto-torneos + CTAs reales (votar duelos abiertos
 *       y crear torneo propio si el user está logueado).</li>
 * </ul>
 */
function TorneosPage() {
  const { t } = useTranslation()
  useSeo({
    title: t('torneos.tituloPagina'),
    description: t('torneos.subtitulo'),
  })
  const { data: torneos, isLoading, isError, error } = useTorneos()
  const { user } = useAuth()

  const total = torneos?.length ?? 0
  const enCurso = (torneos ?? []).filter((it) => it.estado === 'IN_PROGRESS')
  const proximos = (torneos ?? []).filter((it) => it.estado === 'SCHEDULED')
  const historial = (torneos ?? []).filter((it) => it.estado === 'FINISHED')

  return (
    <section className="as-stage as-stage-cyan as-stage-visual as-stage-torneos px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: t('nav.torneos'), path: '/torneos' },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <motion.header
          className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(26rem,1fr)] lg:items-end"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          {/* Acento rojo bracket (audit producto 2026-05-18): torneos =
              rojo combate. Distingue del magenta de votar y del oro de
              ranking, refuerza la idea de eliminación directa. */}
          <div className="flex flex-col items-start gap-3">
            <span className="as-kicker">
              <Trophy className="h-3 w-3" />
              {isLoading
                ? t('torneos.loading')
                : t('torneos.contadorPlural', { count: total })}
            </span>
            <h1 className="text-[clamp(2.4rem,6vw,4.4rem)] font-extrabold leading-tight tracking-tight">
              {t('torneos.tituloPagina')}
            </h1>
            <p className="max-w-2xl text-fg-muted">{t('torneos.subtitulo')}</p>
            {user && (
              <Link
                to="/torneos/crear"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                <Sparkles className="h-4 w-4" />
                {t('torneos.crearCta')}
              </Link>
            )}
          </div>
          <TorneosHeroBanner />
        </motion.header>

        {isLoading && <TorneosSkeleton />}

        {isError && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-rose-200">
            {t('torneos.errorLoad', {
              error: error?.message || t('torneos.errorFallback'),
            })}
          </p>
        )}

        {!isLoading && !isError && total === 0 && (
          <EmptyState user={user} t={t} />
        )}

        {!isLoading && !isError && total > 0 && (
          <div className="flex flex-col gap-12">
            {enCurso.length > 0 && (
              <TorneosSeccion
                icon={PlayCircle}
                tono="text-emerald-300"
                dotColor="bg-emerald-400"
                titulo={t('torneos.seccionEnCurso')}
                count={enCurso.length}
                torneos={enCurso}
              />
            )}
            {proximos.length > 0 && (
              <TorneosSeccion
                icon={CalendarClock}
                tono="text-cyan-300"
                dotColor="bg-cyan-400"
                titulo={t('torneos.seccionProximos')}
                count={proximos.length}
                torneos={proximos}
              />
            )}
            {historial.length > 0 && (
              <TorneosSeccion
                icon={CheckCircle2}
                tono="text-fg-muted"
                dotColor="bg-fg-muted"
                titulo={t('torneos.seccionHistorial')}
                count={historial.length}
                torneos={historial}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function TorneosSeccion({ icon: Icon, tono, dotColor, titulo, count, torneos }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-surface ${tono}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${tono}`}>
          {titulo}
        </h2>
        <span className="font-mono text-[11px] text-fg-muted tabular-nums">
          ({count})
        </span>
        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {torneos.map((it) => (
          <TorneoCard key={it.slug} torneo={it} />
        ))}
      </div>
    </div>
  )
}

function TorneosHeroBanner() {
  const visual = getTournamentVisual('mha-heroes-vs-villains', 'Arena de torneos')
  return (
    <div className="as-panel-hot relative hidden min-h-64 overflow-hidden rounded-2xl border border-cyan-500/20 lg:block">
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0"
        imageClassName="saturate-125 contrast-110"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-gold/50 bg-gold-soft px-6 py-3 text-5xl font-black uppercase tracking-tighter text-gold shadow-[0_0_60px_-14px_rgba(197,161,90,0.85)]">
          VS
        </div>
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
            Brackets en vivo
          </p>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">
            Héroes, villanos y favoritos del catálogo cara a cara.
          </p>
        </div>
        <Link
          to="/votar"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          Votar duelos
          <Swords className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function TorneosSkeleton() {
  // 6 cards en grid igual que el real para que el cambio loading → loaded
  // no recalcule el layout (cero CLS). Avatares fake + h3 fake + meta fake.
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-4 rounded-xl border border-border bg-surface p-5"
          aria-hidden="true"
        >
          <div className="flex -space-x-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className="h-10 w-10 rounded-full border-2 border-surface bg-surface-alt"
              />
            ))}
          </div>
          <div className="h-5 w-3/4 rounded bg-surface-alt" />
          <div className="h-3 w-1/2 rounded bg-surface-alt" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ user, t }) {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero del empty state */}
      <div className="relative flex min-h-96 flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center sm:p-12">
        <EditorialCover
          visual={BRAND_VISUALS.empty}
          className="absolute inset-0 rounded-none border-0 opacity-65"
          imageClassName="saturate-125 contrast-110"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Trophy className="h-7 w-7" />
        </div>
        <div className="relative flex max-w-md flex-col gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-fg-strong">
            {t('torneos.vacioTitulo')}
          </h2>
          <p className="text-[14px] leading-relaxed text-fg-muted">
            {t('torneos.vacioSub')}
          </p>
          <p className="inline-flex items-center justify-center gap-1.5 text-[12px] text-fg-muted">
            <Clock className="h-3.5 w-3.5" />
            {t('torneos.vacioContador')}
          </p>
        </div>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/votar"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            {t('torneos.vacioCtaVotar')}
          </Link>
          {user && (
            <Link
              to="/torneos/crear"
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              <Sparkles className="h-4 w-4" />
              {t('torneos.crearCta')}
            </Link>
          )}
        </div>
      </div>

      {/* 3 brackets sugeridos: mockup visual con avatares reales para que
          la página no se vea muerta. No son torneos reales, son "ideas" del
          tipo de bracket que el cron puede generar. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-accent">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
            {t('torneos.sugerenciasTitulo')}
          </h2>
          <span className="ml-auto text-[11px] text-fg-muted">
            {t('torneos.sugerenciasNota')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUGERENCIAS_TORNEO.map((s) => (
            <SugerenciaCard key={s.titulo} sugerencia={s} user={user} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Card "Bracket sugerido" — no es un torneo real (no tiene slug en BD).
 * Visualmente parecida a TorneoCard pero con tono "futuro" y CTA distinta:
 *   - User logueado: "Crear con este preset" → /torneos/crear?preset=<slug>
 *     (CrearTorneoPage decide si soporta presets; por ahora solo navega).
 *   - User invitado: "Vota duelos abiertos" → /votar
 */
function SugerenciaCard({ sugerencia, user, t }) {
  const { titulo, descripcion, cast } = sugerencia
  const presetSlug = titulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const destino = user ? `/torneos/crear?preset=${presetSlug}` : '/votar'
  const ctaLabel = user
    ? t('torneos.sugerenciaCtaCrear')
    : t('torneos.sugerenciaCtaVotar')
  const visual = getTournamentVisual(presetSlug, titulo)
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-dashed border-accent/30 bg-surface/60 transition-colors hover:border-gold/50">
      <EditorialCover
        visual={visual}
        title={titulo}
        eyebrow="Preset"
        meta={descripcion}
        className="h-36 rounded-none border-0"
        compact
      />
      <div className="flex flex-col p-5">
      <h3 className="text-lg font-bold text-fg-strong">{titulo}</h3>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">
        {descripcion}
      </p>
      <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        <Clock className="h-3 w-3" />
        {t('torneos.sugerenciaBadge')}
        <span className="text-border">·</span>
        <Users className="h-3 w-3" />
        {cast.length}
      </div>
      <Link
        to={destino}
        className="mt-4 inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-accent hover:underline"
      >
        {ctaLabel}
        <Sparkles className="h-3 w-3" />
      </Link>
      </div>
    </div>
  )
}

export default TorneosPage
