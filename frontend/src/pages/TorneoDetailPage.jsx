import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CheckCircle2, Crown, Lock, Target, Trophy, Users } from 'lucide-react'
import PersonajeCard from '../components/PersonajeCard'
import Bracket from '../components/Bracket'
import DuelosAbiertosStrip from '../components/DuelosAbiertosStrip'
import LiveMatchSpectator from '../components/LiveMatchSpectator'
import PersonajeImg from '../components/PersonajeImg'
import ReactionsBar from '../components/ReactionsBar'
import EditorialCover from '../components/EditorialCover'
import ShareButtons from '../components/ShareButtons'
import KanjiSpinner from '../components/KanjiSpinner'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'
import { formatDateSafe, parseDateSafe } from '../lib/dateUtils'
import { useTorneoBySlug, getEstadoBadge } from '../lib/torneosQueries'
import {
  useAplicarPrediccionCampeon,
  useLeaderboardPrediccionesTorneo,
  useMisPredicciones,
} from '../hooks/usePredicciones'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, torneoSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { BRAND_VISUALS, getTournamentVisual } from '../data/visual-assets'
import { VisualPageShell } from '../components/VisualSystem'
import NotFoundPage from './NotFoundPage'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Detalle de un torneo (/torneos/[slug]) consumiendo el backend vía
 * useTorneoBySlug. Antes leía frontend/src/data/torneos.js estático con
 * `getTorneoBySlug(slug)` — 1 elimina ese archivo.
 *
 * El hook hace polling de 30s automáticamente cuando estado === IN_PROGRESS
 * (configurado en lib/torneosQueries.js), así el bracket se actualiza solo
 * mientras los matches estén abiertos.
 */
function TorneoDetailPage() {
  const { slug } = useParams()
  const { data: torneo, isLoading, isError, error, refetch } = useTorneoBySlug(slug)

  // useSeo por encima del early-return (Rules of Hooks). Durante la carga
  // usamos un title temporal no indexable para no emitir un falso 404.
  useSeo(
    torneo
      ? {
          title: `${torneo.nombre} · Bracket de ${
            torneo.numParticipantes ?? '?'
          } personajes`,
          description:
            torneo.descripcion ||
            `Sigue el bracket de ${torneo.nombre} con ${
              torneo.numParticipantes ?? '?'
            } personajes y vota en cada enfrentamiento.`,
          canonical: `https://animeshowdown.dev/torneos/${torneo.slug}`,
          image: `/api/og/torneo/${torneo.slug}.png`,
          type: 'website',
        }
      : isLoading
        ? {
            title: 'Cargando torneo',
            description: 'Preparando bracket de torneo en AnimeShowdown.',
            canonical: `https://animeshowdown.dev/torneos/${slug}`,
            noindex: true,
          }
        : error?.status === 404
          ? { title: '404 — Torneo no encontrado', noindex: true }
          : {
              title: 'Torneo no disponible',
              description: 'No se pudo cargar el torneo en AnimeShowdown.',
              noindex: true,
            },
  )

  if (isLoading) {
    return (
      <VisualPageShell
        visual={BRAND_VISUALS.torneos}
        className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
        contentClassName="flex flex-col items-center gap-3"
        lateralKanji={null}
      >
        <KanjiSpinner kanji="戦" size="lg" tone="accent" />
        <p className="text-[12px] text-fg-muted">
          Preparando bracket…
        </p>
      </VisualPageShell>
    )
  }

  // 404 del backend → reutilizamos NotFoundPage; otros errores muestran
  // mensaje simple para no asustar al usuario con stack traces.
  if (isError) {
    if (error?.status === 404) return <NotFoundPage />
    if (error?.message) return (
      <section className="px-5 py-16 sm:px-8">
        <EmptyState
          icon={AlertTriangle}
          title="No se pudo cargar el torneo"
          description={error?.message || 'Inténtalo de nuevo en unos segundos.'}
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
      </section>
    )
    return (
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-fg-strong">
            No se pudo cargar el torneo
          </h1>
          <p className="mt-2 text-fg-muted">
            {error?.message || 'Inténtalo de nuevo en unos segundos.'}
          </p>
          <Link
            to="/torneos"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a torneos
          </Link>
        </div>
      </section>
    )
  }

  if (!torneo) return <NotFoundPage />

  const {
    nombre,
    descripcion,
    estado,
    fechaInicio,
    fechaFinalizacion,
    numParticipantes,
    totalRondas,
    ganadorSlug,
    enfrentamientos,
  } = torneo
  const enfrentamientosList = Array.isArray(enfrentamientos)
    ? enfrentamientos
    : []

  const badge = getEstadoBadge(estado)
  const fechaInicioDate = parseDateSafe(fechaInicio)
  const fechaFinDate = parseDateSafe(fechaFinalizacion)
  const fechaInicioFmt = formatearFecha(fechaInicio)
  const fechaFinFmt = formatearFecha(fechaFinalizacion)
  const visual = getTournamentVisual(torneo.slug, nombre)

  // Roster: extraemos los participantes únicos de la ronda 1 (siempre los
  // tiene completos, incluso cuando rondas 2+ aún están vacías).
  const rosterRonda1 = enfrentamientosList
    .filter((e) => e.ronda === 1)
    .flatMap((e) => [e.personaje1, e.personaje2])
    .filter(Boolean)

  // El "campeón" para la card de cabecera. Si el torneo está FINISHED y el
  // backend nos da ganadorSlug, lo resolvemos en los matches para tener
  // nombre+anime+imagen sin viaje extra al endpoint de personajes.
  const campeon =
    ganadorSlug
      ? findPersonajePorSlug(enfrentamientosList, ganadorSlug)
      : null

  return (
    <VisualPageShell visual={visual} contentClassName="mx-auto max-w-6xl" density="low" lateralKanji={{left: visual?.kanji ?? "戦", right: "戦"}}>
      <JsonLd
        id="torneo"
        schema={torneoSchema(torneo, rosterRonda1, { image: visual?.image })}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Torneos', path: '/torneos' },
          { label: torneo.nombre, path: `/torneos/${torneo.slug}` },
        ])}
      />
        <Link
          to="/torneos"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a torneos
        </Link>
        {/* 3: <header> con Microdata schema.org/SportsEvent.
            JSON-LD del torneo va en JsonLd arriba; el Microdata aquí
            sirve a crawlers que prefieren parsearlo inline. */}
        <motion.header
          itemScope
          itemType="https://schema.org/SportsEvent"
          className="relative mb-10 flex min-h-96 flex-col items-start justify-end gap-3 overflow-hidden rounded-2xl border border-border p-6 sm:p-8"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <EditorialCover
            visual={visual}
            className="absolute inset-0 rounded-none border-0 opacity-95"
            imageClassName="saturate-110 contrast-105"
          />
          <meta itemProp="url" content={`https://animeshowdown.dev/torneos/${torneo.slug}`} />
          {fechaInicioDate && <meta itemProp="startDate" content={fechaInicio} />}
          {fechaFinDate && <meta itemProp="endDate" content={fechaFinalizacion} />}
          <span className="relative inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-1.5 text-[12px] font-semibold text-fg-muted backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
          <h1
            itemProp="name"
            className="relative text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
          >
            {nombre}
          </h1>
          {descripcion && (
            <p itemProp="description" className="relative max-w-3xl text-fg-muted">
              {descripcion}
            </p>
          )}
          <p className="relative text-fg-muted">
            {numParticipantes} personajes
            {fechaInicioFmt && ` · ${fechaInicioFmt}`}
            {fechaFinFmt && ` → ${fechaFinFmt}`}
          </p>
          {/* 3: reactions sobre el torneo. */}
          {torneo?.id && (
            <div className="relative">
              <ReactionsBar targetType="TORNEO" targetId={torneo.id} />
            </div>
          )}
        </motion.header>
        {campeon && (
          <Link
            to={`/personajes/${campeon.slug}`}
            className="mb-10 flex items-center gap-4 rounded-xl border border-accent/40 bg-accent-soft p-4 transition-colors hover:bg-accent/20"
          >
            <PersonajeImg
              slug={campeon.slug}
              alt={campeon.nombre}
              className="h-16 w-12 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="text-[11px] text-fg-muted">
                Campeón del torneo
              </p>
              <p className="text-xl font-bold text-fg-strong">
                {campeon.nombre}
              </p>
              <p className="text-[13px] text-fg-muted">{campeon.anime}</p>
            </div>
          </Link>
        )}
        {estado === 'IN_PROGRESS' && torneo.currentMatch && (
          <LiveMatchSpectator torneo={torneo} />
        )}
        <ChampionPredictionPanel
          torneoId={torneo.id}
          torneoSlug={torneo.slug}
          estado={estado}
          roster={rosterRonda1}
          torneoNombre={nombre}
        />
        {/* "Duelos abiertos" arriba del bracket
            para que el usuario que aterriza en un torneo IN_PROGRESS no
            tenga que cazar a mano qué match está abierto en el bracket.
            Solo se renderiza si hay matches votables; el bracket sigue
            siendo el mapa global del torneo. */}
        {estado === 'IN_PROGRESS' && (
          <DuelosAbiertosStrip
            enfrentamientos={enfrentamientosList}
            torneoId={torneo.id}
            torneoSlug={torneo.slug}
          />
        )}
        <h2 className="mb-4 text-sm font-semibold text-fg-muted">
          Bracket
        </h2>
        <div className="mb-12">
          <Bracket
            enfrentamientos={enfrentamientosList}
            ganadorSlug={ganadorSlug}
            totalRondas={totalRondas}
            estado={estado}
            torneoId={torneo.id}
            torneoSlug={torneo.slug}
          />
        </div>
        {rosterRonda1.length > 0 && (
          <>
            <div className="mb-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-fg-muted">
                Participantes
              </span>
              <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
                Personajes en {nombre}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {rosterRonda1.map((p) => (
                <PersonajeCard
                  key={p.slug}
                  slug={p.slug}
                  nombre={p.nombre}
                  anime={p.anime}
                />
              ))}
            </div>
            <p className="mt-6 text-[13px] text-fg-muted">
              Vota en cada enfrentamiento del bracket para decidir el campeón.
              También puedes{' '}
              <Link to="/torneos" className="text-gold hover:underline">
                ver otros torneos activos
              </Link>
              ,{' '}
              <Link to="/ranking" className="text-gold hover:underline">
                consultar el ranking ELO global
              </Link>{' '}
              o{' '}
              <Link to="/votar" className="text-gold hover:underline">
                votar en matches casuales
              </Link>
              .
            </p>
          </>
        )}

        <PanelProfetas torneoId={torneo.id} />

        {torneo?.slug && (
          <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-[12px] font-semibold text-fg-muted">
              Comparte este torneo
            </p>
            <ShareButtons
              url={typeof window !== 'undefined'
                ? `${window.location.origin}/torneos/${torneo.slug}`
                : `https://animeshowdown.dev/torneos/${torneo.slug}`}
              texto={`Torneo "${torneo.nombre}" en AnimeShowdown — vota tu favorito`}
            />
          </div>
        )}
    </VisualPageShell>
  )
}

function ChampionPredictionPanel({ torneoId, torneoSlug, estado, roster, torneoNombre }) {
  const { user } = useAuth()
  const { data: misPredicciones, isLoading } = useMisPredicciones(torneoId)
  const mutation = useAplicarPrediccionCampeon(torneoId)
  const prediccion = (misPredicciones ?? []).find((p) => p.tipo === 'CAMPEON')
  const selectedId = prediccion?.personajePredichoId
  const puedePredecir = estado === 'SCHEDULED'
  const next = `/torneos/${torneoSlug}`

  if (!Array.isArray(roster) || roster.length === 0) return null

  const onPick = (personaje) => {
    if (!user || !puedePredecir || mutation.isPending) return
    mutation.mutate(
      { personajePredichoId: personaje.id },
      {
        onSuccess: () => {
          toast.success(`Campeón predicho: ${personaje.nombre}`)
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar la predicción')
        },
      },
    )
  }

  return (
    <section className="mb-10 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-[11px] font-semibold text-gold">
            <Target className="h-3.5 w-3.5" />
            Bracket Challenge
          </div>
          <h2 className="text-xl font-bold text-fg-strong">
            Predice el campeón de {torneoNombre}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            {puedePredecir
              ? 'Una apuesta limpia antes del inicio: acertar el campeón suma 10 puntos.'
              : 'La ventana de predicción ya está cerrada para este torneo.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-bg px-3 py-2 text-[12px] font-semibold text-fg-muted">
          {puedePredecir ? <Trophy className="h-4 w-4 text-gold" /> : <Lock className="h-4 w-4" />}
          {puedePredecir ? '10 pts por acierto' : 'Predicciones cerradas'}
        </div>
      </div>

      {!user && puedePredecir && (
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className="mb-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-bold text-gold transition-colors hover:bg-accent/20"
        >
          Entrar para predecir
        </Link>
      )}

      {prediccion && (
        <div className={`mb-5 flex items-center gap-3 rounded-lg border p-3 ${
          prediccion.acertada === true
            ? 'border-success/40 bg-success/10'
            : prediccion.acertada === false
              ? 'border-danger/40 bg-danger/10'
              : 'border-accent/30 bg-accent-soft'
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-fg-strong">
              Tu campeón: {prediccion.personajePredichoNombre}
            </p>
            <p className="text-[12px] text-fg-muted">
              {prediccion.acertada === true
                ? 'Acierto confirmado: +10 pts'
                : prediccion.acertada === false
                  ? 'Esta vez no acertó.'
                  : puedePredecir
                    ? 'Puedes cambiarlo hasta que arranque el torneo.'
                    : 'Pendiente de resolución.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {roster.map((personaje) => {
          const active = String(selectedId ?? '') === String(personaje.id)
          return (
            <button
              key={personaje.slug}
              type="button"
              onClick={() => onPick(personaje)}
              disabled={!user || !puedePredecir || mutation.isPending || isLoading}
              className={`group min-h-44 rounded-xl border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-75 ${
                active
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-bg hover:border-accent/40 hover:bg-surface-alt'
              }`}
            >
              <PersonajeImg
                slug={personaje.slug}
                alt={personaje.nombre}
                className="aspect-[4/5] w-full rounded-lg object-cover"
              />
              <span className="mt-2 block truncate text-sm font-bold text-fg-strong group-hover:text-gold">
                {personaje.nombre}
              </span>
              <span className="block truncate text-[11px] text-fg-muted">
                {personaje.anime}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Panel de Bracket Challenge con aciertos de campeón para este torneo. */
function PanelProfetas({ torneoId }) {
  const { data, isLoading, isError } = useLeaderboardPrediccionesTorneo({ torneoId, limit: 10 })

  return (
    <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <Crown className="h-4 w-4 shrink-0 text-gold" />
        <div>
          <h2 className="text-sm font-bold text-fg-strong">
            Profetas del campeón
          </h2>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Leaderboard de aciertos de campeón en este torneo
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="line" className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-[12px] text-fg-muted">
          No se pudo cargar el ranking de profetas en este momento.
        </p>
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Users className="h-8 w-8 text-fg-muted/40" />
          <p className="text-[13px] font-semibold text-fg-muted">
            Sin predicciones en este torneo todavía
          </p>
          <p className="max-w-xs text-[11px] text-fg-muted/70">
            Al finalizar el torneo aparecerán aquí quienes clavaron el campeón.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {data.map((predictor, i) => {
            const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
            return (
              <li key={predictor.username}>
                <Link
                  to={`/u/${encodeURIComponent(predictor.username)}`}
                  aria-label={`Rank #${i + 1} — ${predictor.username}, ${predictor.puntos ?? predictor.aciertos} puntos`}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2.5 transition-all hover:border-accent/40 hover:bg-surface-alt"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface font-mono text-sm font-bold text-fg-muted">
                    {medalla ?? `#${i + 1}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-strong group-hover:text-gold">
                    {predictor.username}
                  </span>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-gold">
                      {predictor.puntos ?? predictor.aciertos}
                    </p>
                  <p className="text-[10px] text-fg-muted">
                      puntos
                  </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function findPersonajePorSlug(enfrentamientos, slug) {
  for (const e of enfrentamientos) {
    if (e.personaje1?.slug === slug) return e.personaje1
    if (e.personaje2?.slug === slug) return e.personaje2
    if (e.ganador?.slug === slug) return e.ganador
  }
  return null
}

function formatearFecha(iso) {
  return formatDateSafe(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default TorneoDetailPage
