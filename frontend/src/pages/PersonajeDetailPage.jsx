import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  personajes,
  imagenPersonaje,
  getIndicePersonaje,
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
  const prev = personajes[(idx - 1 + personajes.length) % personajes.length]
  const next = personajes[(idx + 1) % personajes.length]

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/personajes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          ← Volver al catálogo
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
              de <span className="font-semibold text-fg-strong">{personaje.anime}</span>
            </motion.p>
            <motion.p
              className="leading-relaxed text-fg-muted"
              variants={itemVariants}
            >
              Este personaje compite en los torneos de AnimeShowdown. Pronto verás su récord ELO, sus victorias y derrotas en directo en cada bracket.
            </motion.p>
            <motion.div
              className="mt-4 flex w-full items-center justify-between gap-3 border-t border-border pt-4"
              variants={itemVariants}
            >
              <Link
                to={`/personajes/${prev.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                ← {prev.nombre}
              </Link>
              <Link
                to={`/personajes/${next.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                {next.nombre} →
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default PersonajeDetailPage
