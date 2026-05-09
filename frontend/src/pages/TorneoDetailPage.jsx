import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import PersonajeCard from '../components/PersonajeCard'
import { getTorneoBySlug, estadoBadge } from '../data/torneos'
import {
  getPersonajeBySlug,
  imagenPersonaje,
} from '../data/personajes'
import NotFoundPage from './NotFoundPage'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function TorneoDetailPage() {
  const { slug } = useParams()
  const torneo = getTorneoBySlug(slug)

  if (!torneo) return <NotFoundPage />

  const {
    nombre,
    estado,
    participantes,
    fechaInicio,
    fechaFin,
    winner,
  } = torneo
  const badge = estadoBadge[estado]
  const winnerPersonaje = winner ? getPersonajeBySlug(winner) : null
  const fechaInicioFmt = formatearFecha(fechaInicio)
  const fechaFinFmt = fechaFin ? formatearFecha(fechaFin) : null

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/torneos"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          ← Volver a torneos
        </Link>
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight">
            {nombre}
          </h1>
          <p className="text-fg-muted">
            {participantes.length} personajes · {fechaInicioFmt}
            {fechaFinFmt && ` → ${fechaFinFmt}`}
          </p>
        </motion.header>
        {winnerPersonaje && (
          <Link
            to={`/personajes/${winner}`}
            className="mb-10 flex items-center gap-4 rounded-xl border border-accent/40 bg-accent-soft p-4 transition-colors hover:bg-accent/20"
          >
            <img
              src={imagenPersonaje(winner)}
              alt=""
              className="h-16 w-12 rounded-md object-cover"
            />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-fg-muted">
                Campeón del torneo
              </p>
              <p className="text-xl font-bold text-fg-strong">
                {winnerPersonaje.nombre}
              </p>
              <p className="text-[13px] text-fg-muted">
                {winnerPersonaje.anime}
              </p>
            </div>
          </Link>
        )}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-fg-muted">
          Roster
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {participantes.map((s) => {
            const p = getPersonajeBySlug(s)
            return p ? <PersonajeCard key={s} {...p} /> : null
          })}
        </div>
      </div>
    </section>
  )
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
