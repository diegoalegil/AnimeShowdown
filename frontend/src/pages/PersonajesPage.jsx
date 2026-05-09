import { motion } from 'framer-motion'
import PersonajeCard from '../components/PersonajeCard'
import { personajes } from '../data/personajes'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PersonajesPage() {
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            {personajes.length} personajes
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Personajes
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Todos los personajes disponibles para los próximos torneos. Pasa el cursor por encima para resaltarlos.
          </p>
        </motion.header>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {personajes.map((p) => (
            <PersonajeCard key={p.slug} {...p} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PersonajesPage
