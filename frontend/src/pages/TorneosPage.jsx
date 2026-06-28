import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  PlayCircle,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import EditorialCover from '../components/EditorialCover'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import ResilientEmptyState from '../components/EmptyState'
import { CarteleraTorneos } from '../features/torneos/TournamentPoster'
import { useTorneos } from '../lib/torneosQueries'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useAuth } from '../contexts/AuthContext'
import { personajes, getStatsPersonaje } from '../lib/personajes-core'
import { BRAND_VISUALS, getTournamentVisual } from '../data/visual-assets'
import { buildTorneosPageModel } from '../features/torneos/torneos-page-data'

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

/**
 * Nota de producto: la página antes era título + spinner +
 * footer y un grid plano sin separar estados. Ahora:
 *
 * <ul>
 *   <li>Skeleton con la silueta de la cartelera mientras carga.</li>
 *   <li>La cartelera de la velada (TournamentPoster): en juego se imprime
 *       grande y primero, inscripción después, historial como archivo
 *       compacto. Cada sección solo aparece si tiene items.</li>
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
  const { data: torneos, isLoading, isError, error, refetch } = useTorneos()
  const { user } = useAuth()
  const model = buildTorneosPageModel(torneos)

  const {
    total,
    enCurso,
    proximos,
    historial,
  } = model

  return (
    <VisualPageShell visual={BRAND_VISUALS.torneos} lateralKanji={{left: "戦", right: "場"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: t('nav.torneos'), path: '/torneos' },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.torneos} lateralKanji={{left: "戦", right: "場"}}
          icon={Trophy}
          eyebrow={isLoading ? t('torneos.loading') : t(total === 1 ? 'torneos.contadorSingular' : 'torneos.contadorPlural', { count: total })}
          title={t('torneos.tituloPagina')}
          subtitle={t('torneos.subtitulo')}
          actions={
            user && (
              <Link
                to="/torneos/crear"
                className="inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-aura transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Sparkles className="h-4 w-4" />
                {t('torneos.crearCta')}
              </Link>
            )
          }
          aside={<TorneosHeroBanner />}
        />

        {isLoading && <TorneosSkeleton />}

        {isError && (
          <ResilientEmptyState
            icon={AlertTriangle}
            title="No pudimos cargar torneos"
            description={t('torneos.errorLoad', {
              error: error?.message || t('torneos.errorFallback'),
            })}
            action={
              <button
                type="button"
                onClick={() => refetch()}
                className="as-button-primary rounded-lg px-5 py-3 text-sm font-black"
              >
                Reintentar
              </button>
            }
          />
        )}

        {!isLoading && !isError && total === 0 && (
          <EmptyState user={user} t={t} />
        )}

        {!isLoading && !isError && total > 0 && (
          <div className="flex flex-col gap-12">
            <TorneosOverview model={model} t={t} />
            {/* La cartelera de la velada: en juego XL primero, inscripción
                después y el historial como archivo compacto (TournamentPoster).
                El destacado del overview viejo murió aquí: el primer cartel
                EN JUEGO a página completa ES el destacado. */}
            <CarteleraTorneos
              enCurso={enCurso}
              proximos={proximos}
              historial={historial}
            />
          </div>
        )}
      </div>
    </VisualPageShell>
  )
}

function TorneosOverview({ model, t }) {
  const numberFormat = new Intl.NumberFormat()
  const metrics = [
    {
      icon: PlayCircle,
      label: t('torneos.resumenEnCurso'),
      value: model.enCurso.length,
      tone: 'text-success',
    },
    {
      icon: CalendarClock,
      label: t('torneos.resumenProximos'),
      value: model.proximos.length,
      tone: 'text-electric',
    },
    {
      icon: Swords,
      label: t('torneos.resumenVotos7d'),
      value: numberFormat.format(model.votosUltimos7Dias),
      tone: 'text-gold',
    },
    {
      icon: Users,
      label: t('torneos.resumenParticipantes'),
      value: numberFormat.format(model.participantes),
      tone: 'text-fg-strong',
    },
  ]

  return (
    <section
      aria-label={t('torneos.resumenAria')}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {metrics.map((metric) => (
        <TorneoMetric key={metric.label} {...metric} />
      ))}
    </section>
  )
}

function TorneoMetric({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface/75 p-4">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-bg ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-black tabular-nums text-fg-strong">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-fg-muted">
        {label}
      </p>
    </div>
  )
}

function TorneosHeroBanner() {
  const visual = getTournamentVisual('mha-heroes-vs-villains', 'Arena de torneos')
  return (
    <div className="as-panel-hot relative min-h-64 overflow-hidden rounded-2xl border border-electric/20">
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0"
        imageClassName="saturate-110 contrast-105"
      />
      {/* Overlay en columna: VS arriba-centro (sobre la imagen) y el bloque de
          texto + CTA abajo. flex-col justify-between evita que el VS se pise con
          el contenido (antes el VS iba absolute-centrado sobre todo el banner). */}
      <div className="absolute inset-0 flex flex-col justify-between gap-3 p-5">
        <div className="flex justify-center">
          <div className="as-tournament-vs-aura rounded-full border border-gold/50 bg-gold-soft px-5 py-2 text-4xl font-black uppercase tracking-tighter text-gold shadow-aura-lg">
            VS
          </div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-electric">
              Brackets en vivo
            </p>
            <p className="mt-1 max-w-sm text-sm text-fg-muted">
              Héroes, villanos y favoritos del catálogo cara a cara.
            </p>
          </div>
          <Link
            to="/votar"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-accent/20"
          >
            Votar duelos
            <Swords className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function TorneosSkeleton() {
  // Mismo layout que la cartelera real (cartel XL + dos medios + filas de
  // archivo) para que el cambio loading → loaded no recalcule el layout.
  return (
    <div className="flex flex-col gap-12">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="skl block h-28 rounded-xl bg-surface-alt" />
        ))}
      </div>
      <div className="flex flex-col gap-5">
        <span className="skl block min-h-[420px] rounded-2xl bg-surface-alt sm:min-h-[480px]" />
        <div className="grid gap-5 md:grid-cols-2">
          <span className="skl block min-h-[320px] rounded-2xl bg-surface-alt" />
          <span className="skl hidden min-h-[320px] rounded-2xl bg-surface-alt md:block" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="skl block h-[88px] rounded-xl bg-surface-alt" />
          ))}
        </div>
      </div>
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
          imageClassName="saturate-110 contrast-105"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-gold">
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            {t('torneos.vacioCtaVotar')}
          </Link>
          {user && (
            <Link
              to="/torneos/crear"
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-accent/20"
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
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface text-gold">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[13px] font-semibold text-gold">
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
 *   - User logueado: "Crear un torneo" → /torneos/crear (el formulario aún no
 *     precarga presets, así que el CTA no lo promete para no engañar).
 *   - User invitado: "Vota duelos abiertos" → /votar
 */
function SugerenciaCard({ sugerencia, user, t }) {
  const { titulo, descripcion, cast } = sugerencia
  const presetSlug = titulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const destino = user ? '/torneos/crear' : '/votar'
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
      <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-0.5 text-[10px] font-semibold text-fg-muted">
        <Clock className="h-3 w-3" />
        {t('torneos.sugerenciaBadge')}
        <span className="text-border">·</span>
        <Users className="h-3 w-3" />
        {cast.length}
      </div>
      <Link
        to={destino}
        className="mt-4 inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-gold hover:underline"
      >
        {ctaLabel}
        <Sparkles className="h-3 w-3" />
      </Link>
      </div>
    </div>
  )
}

export default TorneosPage
