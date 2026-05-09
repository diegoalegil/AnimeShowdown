import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Home } from 'lucide-react'
import { personajes, imagenPersonaje } from '../data/personajes'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
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

function NotFoundPage() {
  useDocumentTitle('404')
  const random = useMemo(
    () => personajes[Math.floor(Math.random() * personajes.length)],
    [],
  )

  return (
    <section className="flex flex-1 items-center justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20">
      <motion.div
        className="grid w-full max-w-4xl grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          className="relative mx-auto w-full max-w-xs md:order-2"
          variants={itemVariants}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 left-1/2 -z-10 -translate-x-1/2 select-none font-extrabold leading-none tracking-tighter text-[clamp(8rem,18vw,14rem)]"
            style={{
              WebkitTextStroke: '2px var(--color-accent)',
              color: 'transparent',
              opacity: 0.6,
            }}
          >
            404
          </span>
          <img
            src={imagenPersonaje(random.slug)}
            alt=""
            className="relative aspect-[2/3] w-full rounded-2xl border border-border bg-surface object-cover shadow-2xl"
            style={{ filter: 'drop-shadow(0 30px 60px rgb(255 46 99 / 0.25))' }}
          />
        </motion.div>
        <div className="flex flex-col gap-4 text-center md:order-1 md:text-left">
          <motion.span
            className="inline-flex w-fit self-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted md:self-start"
            variants={itemVariants}
          >
            Error 404
          </motion.span>
          <motion.h1
            className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
            variants={itemVariants}
          >
            {random.nombre} no encuentra esta página
          </motion.h1>
          <motion.p
            className="text-fg-muted leading-relaxed"
            variants={itemVariants}
          >
            La ruta que buscas no existe o se ha movido. Vuelve al inicio o explora el catálogo de personajes para seguir adelante.
          </motion.p>
          <motion.div
            className="mt-2 flex flex-wrap justify-center gap-3 md:justify-start"
            variants={itemVariants}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <Home className="h-4 w-4" />
              Volver al inicio
            </Link>
            <Link
              to="/personajes"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
            >
              Ver personajes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

export default NotFoundPage
