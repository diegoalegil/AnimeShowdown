import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  personajes,
  imagenPersonaje,
  getIndicePersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import NotFoundPage from './NotFoundPage'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PersonajeDetailPage() {
  const { slug } = useParams()
  const idx = getIndicePersonaje(slug)

  if (idx === -1) return <NotFoundPage />

  const personaje = personajes[idx]
  const stats = getStatsPersonaje(slug)
  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0
  const prev = personajes[(idx - 1 + personajes.length) % personajes.length]
  const next = personajes[(idx + 1) % personajes.length]

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/personajes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
        <motion.div
          key={slug}
          className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:gap-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.img
            src={imagenPersonaje(slug)}
            alt={personaje.nombre}
            className="w-full max-w-md rounded-2xl border border-border bg-surface object-cover shadow-2xl"
            style={{ filter: 'drop-shadow(0 30px 60px rgb(255 46 99 / 0.18))' }}
            variants={itemVariants}
          />
          <motion.div
            className="flex flex-col items-start gap-4"
            variants={containerVariants}
          >
            <motion.span
              className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted"
              variants={itemVariants}
            >
              Personaje {idx + 1} de {personajes.length}
            </motion.span>
            <motion.h1
              className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
              variants={itemVariants}
            >
              {personaje.nombre}
            </motion.h1>
            <motion.p
              className="text-lg text-fg-muted"
              variants={itemVariants}
            >
              de{' '}
              <span className="font-semibold text-fg-strong">
                {personaje.anime}
              </span>
            </motion.p>
            <motion.div
              className="grid w-full grid-cols-3 gap-3"
              variants={itemVariants}
            >
              <Stat label="ELO" value={stats.elo} accent />
              <Stat
                label="Récord"
                value={`${stats.wins}-${stats.losses}`}
              />
              <Stat label="Win rate" value={`${winRate}%`} />
            </motion.div>
            <motion.p
              className="text-[12px] leading-relaxed text-fg-muted"
              variants={itemVariants}
            >
              Estadísticas derivadas del historial de enfrentamientos. Datos de ejemplo hasta que el backend esté conectado.
            </motion.p>
            <motion.div
              className="mt-2 flex w-full items-center justify-between gap-3 border-t border-border pt-4"
              variants={itemVariants}
            >
              <Link
                to={`/personajes/${prev.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                {prev.nombre}
              </Link>
              <Link
                to={`/personajes/${next.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                {next.nombre}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-bold ${
          accent ? 'text-accent' : 'text-fg-strong'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default PersonajeDetailPage
