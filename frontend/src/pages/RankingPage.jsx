import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'

const ranked = [...personajes]
  .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
  .sort((a, b) => b.elo - a.elo)

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, delay: 0.2 },
  },
}

function RankingPage() {
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Datos de ejemplo
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Ranking ELO
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Los {ranked.length} personajes ordenados por puntuación ELO. Cuando el backend esté conectado, esta tabla se actualizará en directo según los enfrentamientos.
          </p>
        </motion.header>
        <motion.ol
          className="flex flex-col gap-2"
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {ranked.map((p, i) => (
            <RankRow key={p.slug} rank={i + 1} {...p} />
          ))}
        </motion.ol>
      </div>
    </section>
  )
}

function RankRow({ rank, slug, nombre, anime, elo, wins, losses }) {
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const isTop3 = rank <= 3

  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:border-accent/40 hover:bg-surface-alt sm:gap-5 sm:px-5"
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
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[12px] text-fg-muted">
            {wins}V · {losses}D
          </p>
          <p className="text-[12px] text-fg-muted">{winRate}% win rate</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-accent">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
      </Link>
    </li>
  )
}

export default RankingPage
