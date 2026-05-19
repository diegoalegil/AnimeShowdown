import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import PersonajeCard from '../components/PersonajeCard'
import Bracket from '../components/Bracket'
import DuelosAbiertosStrip from '../components/DuelosAbiertosStrip'
import PersonajeImg from '../components/PersonajeImg'
import ReactionsBar from '../components/ReactionsBar'
import ShareButtons from '../components/ShareButtons'
import { useTorneoBySlug, getEstadoBadge } from '../lib/torneosQueries'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, torneoSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
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
 * `getTorneoBySlug(slug)` — Plan v2 §1.1 elimina ese archivo.
 *
 * El hook hace polling de 30s automáticamente cuando estado === IN_PROGRESS
 * (configurado en lib/torneosQueries.js), así el bracket se actualiza solo
 * mientras los matches estén abiertos.
 */
function TorneoDetailPage() {
  const { slug } = useParams()
  const { data: torneo, isLoading, isError, error } = useTorneoBySlug(slug)

  // useSeo por encima del early-return (Rules of Hooks). Cuando todavía no
  // hay datos pintamos un title genérico; cuando llegan, los meta tags
  // se actualizan en el siguiente tick (efecto dependiente de torneo).
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
          type: 'website',
        }
      : { title: 'Torneo' },
  )

  if (isLoading) {
    return (
      <section className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </section>
    )
  }

  // 404 del backend → reutilizamos NotFoundPage; otros errores muestran
  // mensaje simple para no asustar al usuario con stack traces.
  if (isError) {
    if (error?.status === 404) return <NotFoundPage />
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
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
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

  const badge = getEstadoBadge(estado)
  const fechaInicioFmt = fechaInicio ? formatearFecha(fechaInicio) : null
  const fechaFinFmt = fechaFinalizacion ? formatearFecha(fechaFinalizacion) : null

  // Roster: extraemos los participantes únicos de la ronda 1 (siempre los
  // tiene completos, incluso cuando rondas 2+ aún están vacías).
  const rosterRonda1 = (enfrentamientos ?? [])
    .filter((e) => e.ronda === 1)
    .flatMap((e) => [e.personaje1, e.personaje2])
    .filter(Boolean)

  // El "campeón" para la card de cabecera. Si el torneo está FINISHED y el
  // backend nos da ganadorSlug, lo resolvemos en los matches para tener
  // nombre+anime+imagen sin viaje extra al endpoint de personajes.
  const campeon =
    ganadorSlug && enfrentamientos
      ? findPersonajePorSlug(enfrentamientos, ganadorSlug)
      : null

  return (
    <section className="as-stage as-stage-cyan as-stage-visual as-stage-torneos px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="torneo"
        schema={torneoSchema(torneo, rosterRonda1)}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Torneos', path: '/torneos' },
          { label: torneo.nombre, path: `/torneos/${torneo.slug}` },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <Link
          to="/torneos"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a torneos
        </Link>
        {/* Plan v2 §6.3: <header> con Microdata schema.org/SportsEvent.
            JSON-LD del torneo va en JsonLd arriba; el Microdata aquí
            sirve a crawlers que prefieren parsearlo inline. */}
        <motion.header
          itemScope
          itemType="https://schema.org/SportsEvent"
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <meta itemProp="url" content={`https://animeshowdown.dev/torneos/${torneo.slug}`} />
          {fechaInicio && <meta itemProp="startDate" content={fechaInicio} />}
          {fechaFinalizacion && <meta itemProp="endDate" content={fechaFinalizacion} />}
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
          <h1
            itemProp="name"
            className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
          >
            {nombre}
          </h1>
          {descripcion && (
            <p itemProp="description" className="max-w-3xl text-fg-muted">
              {descripcion}
            </p>
          )}
          <p className="text-fg-muted">
            {numParticipantes} personajes
            {fechaInicioFmt && ` · ${fechaInicioFmt}`}
            {fechaFinFmt && ` → ${fechaFinFmt}`}
          </p>
          {/* Plan v2 §4.3: reactions sobre el torneo. */}
          {torneo?.id && (
            <ReactionsBar targetType="TORNEO" targetId={torneo.id} />
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
              className="h-16 w-12 rounded-md object-cover"
            />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-fg-muted">
                Campeón del torneo
              </p>
              <p className="text-xl font-bold text-fg-strong">
                {campeon.nombre}
              </p>
              <p className="text-[13px] text-fg-muted">{campeon.anime}</p>
            </div>
          </Link>
        )}
        {/* Sprint UX (2026-05-18): "Duelos abiertos" arriba del bracket
            para que el usuario que aterriza en un torneo IN_PROGRESS no
            tenga que cazar a mano qué match está abierto en el bracket.
            Solo se renderiza si hay matches votables; el bracket sigue
            siendo el mapa global del torneo. */}
        {estado === 'IN_PROGRESS' && (
          <DuelosAbiertosStrip
            enfrentamientos={enfrentamientos}
            torneoId={torneo.id}
            torneoSlug={torneo.slug}
          />
        )}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-fg-muted">
          Bracket
        </h2>
        <div className="mb-12">
          <Bracket
            enfrentamientos={enfrentamientos}
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
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
              <Link to="/torneos" className="text-accent hover:underline">
                ver otros torneos activos
              </Link>
              ,{' '}
              <Link to="/ranking" className="text-accent hover:underline">
                consultar el ranking ELO global
              </Link>{' '}
              o{' '}
              <Link to="/votar" className="text-accent hover:underline">
                votar en matches casuales
              </Link>
              .
            </p>
          </>
        )}

        {torneo?.slug && (
          <div className="mt-10 rounded-xl border border-border bg-surface p-5">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
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
      </div>
    </section>
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
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default TorneoDetailPage
