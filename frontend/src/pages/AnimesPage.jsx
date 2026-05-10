import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { personajes, imagenPersonaje } from '../data/personajes'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSound } from '../contexts/SoundContext'
import SugerirPersonajeCTA from '../components/SugerirPersonajeCTA'

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const animes = (() => {
  const groups = {}
  personajes.forEach((p) => {
    if (!groups[p.anime]) groups[p.anime] = []
    groups[p.anime].push(p)
  })
  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
})()

function AnimesPage() {
  useDocumentTitle('Animes')
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
            {animes.length} universos
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Animes
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Todos los universos de anime representados en el catálogo. Pulsa cualquiera para ver sus personajes.
          </p>
        </motion.header>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {animes.map(([anime, list]) => (
            <AnimeTile key={anime} anime={anime} list={list} />
          ))}
        </div>

        <SugerirPersonajeCTA titulo="¿Falta algún anime en el catálogo?" />
      </div>
    </section>
  )
}

function AnimeTile({ anime, list }) {
  const featured = list.slice(0, 4)
  const { play } = useSound()
  return (
    <Link
      to={`/personajes?anime=${encodeURIComponent(anime)}`}
      onClick={() => play('playWhoosh')}
      className="group block overflow-hidden rounded-xl border border-border bg-surface p-3 transition-all hover:-translate-y-1 hover:border-accent/40"
    >
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {featured.map((p) => (
          <img
            key={p.slug}
            src={imagenPersonaje(p.slug)}
            alt=""
            loading="lazy"
            className="aspect-[2/3] w-full rounded-md object-cover object-top"
          />
        ))}
        {Array.from({ length: 4 - featured.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="aspect-[2/3] w-full rounded-md bg-surface-alt"
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {anime}
          </h3>
          <p className="text-[11px] text-fg-muted">
            {list.length} personajes
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </Link>
  )
}

export default AnimesPage
