import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Swords, Trophy } from 'lucide-react'
import Hero from '../components/Hero'
import TorneoCard from '../components/TorneoCard'
import { torneos } from '../data/torneos'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const top5 = [...personajes]
  .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
  .sort((a, b) => b.elo - a.elo)
  .slice(0, 5)

const torneosPreview = torneos.slice(0, 3)

const pasos = [
  {
    icon: Heart,
    titulo: 'Elige tu lado',
    descripcion:
      'Explora 96 personajes de tus animes favoritos y descubre quién compite en cada torneo.',
  },
  {
    icon: Swords,
    titulo: 'Vota cara a cara',
    descripcion:
      'Decide quién gana cada enfrentamiento. Tus votos suman puntos al ELO de cada personaje.',
  },
  {
    icon: Trophy,
    titulo: 'Corona al campeón',
    descripcion:
      'Sigue el bracket en directo y celebra al ganador del torneo. Los rankings se actualizan en cada ronda.',
  },
]

function InicioPage() {
  return (
    <>
      <Hero />
      <SectionTorneosActivos />
      <SectionTop5Ranking />
      <SectionComoFunciona />
    </>
  )
}

function SectionHeader({ eyebrow, titulo, link }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
          {eyebrow}
        </span>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
          {titulo}
        </h2>
      </div>
      {link && (
        <Link
          to={link.to}
          className="hidden items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent sm:inline-flex"
        >
          {link.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

function SectionTorneosActivos() {
  return (
    <motion.section
      className="px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Torneos"
          titulo="Brackets en marcha"
          link={{ to: '/torneos', label: 'Ver todos' }}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {torneosPreview.map((t) => (
            <TorneoCard key={t.slug} torneo={t} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function SectionTop5Ranking() {
  return (
    <motion.section
      className="bg-surface/40 px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="Ranking"
          titulo="Top 5 por ELO"
          link={{ to: '/ranking', label: 'Ver completo' }}
        />
        <ol className="flex flex-col gap-2">
          {top5.map((p, i) => (
            <Top5Row key={p.slug} rank={i + 1} {...p} />
          ))}
        </ol>
      </div>
    </motion.section>
  )
}

function Top5Row({ rank, slug, nombre, anime, elo }) {
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-all hover:-translate-x-1 hover:border-accent/40"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${
            rank === 1
              ? 'bg-yellow-500/15 text-yellow-400'
              : rank === 2
                ? 'bg-zinc-400/15 text-zinc-300'
                : rank === 3
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'bg-surface-alt text-fg-muted'
          }`}
        >
          {rank === 1 ? <Trophy className="h-5 w-5" /> : rank}
        </span>
        <img
          src={imagenPersonaje(slug)}
          alt=""
          className="h-12 w-9 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <p className="font-mono text-base font-bold text-accent">{elo}</p>
      </Link>
    </li>
  )
}

function SectionComoFunciona() {
  return (
    <motion.section
      className="px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col items-start gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Cómo funciona
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
            Tres pasos para coronar al mejor
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {pasos.map((paso, i) => (
            <PasoCard key={paso.titulo} numero={i + 1} {...paso} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function PasoCard({ numero, icon: Icon, titulo, descripcion }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/40">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-mono text-[12px] font-semibold text-fg-muted">
          0{numero}
        </span>
      </div>
      <h3 className="text-lg font-bold text-fg-strong">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {descripcion}
      </p>
    </div>
  )
}

export default InicioPage
