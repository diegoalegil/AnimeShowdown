import { motion } from 'framer-motion'
import TorneoCard from '../components/TorneoCard'
import { torneos } from '../data/torneos'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function TorneosPage() {
  useDocumentTitle('Torneos')
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            {torneos.length} torneos
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Torneos
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Brackets cara a cara entre los personajes del catálogo. Pulsa cualquier torneo para ver el roster completo y el estado de cada enfrentamiento.
          </p>
        </motion.header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {torneos.map((t) => (
            <TorneoCard key={t.slug} torneo={t} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default TorneosPage
