import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  CheckCircle2,
  PlayCircle,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react'
import TorneoCard from '../components/TorneoCard'
import { useTorneos } from '../lib/torneosQueries'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useAuth } from '../contexts/AuthContext'

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
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: t('nav.torneos'), path: '/torneos' },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            {isLoading
              ? t('torneos.loading')
              : t('torneos.contadorPlural', { count: total })}
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
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
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface p-8 text-center sm:p-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Trophy className="h-7 w-7" />
      </div>
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-fg-strong">
          {t('torneos.vacioTitulo')}
        </h2>
        <p className="text-[14px] leading-relaxed text-fg-muted">
          {t('torneos.vacioSub')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
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
  )
}

export default TorneosPage
