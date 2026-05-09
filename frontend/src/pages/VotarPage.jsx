import { useState } from 'react'
import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { toast } from 'sonner'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
  getPersonajeBySlug,
} from '../data/personajes'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSound } from '../contexts/SoundContext'

function getRandomPair() {
  const a = Math.floor(Math.random() * personajes.length)
  let b = Math.floor(Math.random() * personajes.length)
  while (b === a) b = Math.floor(Math.random() * personajes.length)
  return [personajes[a], personajes[b]]
}

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function VotarPage() {
  useDocumentTitle('Votar')
  const { play } = useSound()
  const [pair, setPair] = useState(getRandomPair)
  const [votedFor, setVotedFor] = useState(null)

  const [a, b] = pair
  const statsA = getStatsPersonaje(a.slug)
  const statsB = getStatsPersonaje(b.slug)
  const total = statsA.elo + statsB.elo
  const pctA = Math.round((statsA.elo / total) * 100)
  const pctB = 100 - pctA

  const handleVote = (slug) => {
    if (votedFor) return
    setVotedFor(slug)
    play('playVote')
    const p = getPersonajeBySlug(slug)
    if (p) {
      toast.success(`Voto registrado: ${p.nombre}`, {
        description: `de ${p.anime}`,
      })
    }
  }

  const handleNext = () => {
    setPair(getRandomPair())
    setVotedFor(null)
    play('playClick')
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <motion.header
          className="mb-10 flex flex-col items-center gap-3 text-center"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Enfrentamiento aleatorio
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            ¿A quién prefieres?
          </h1>
          <p className="max-w-xl text-fg-muted">
            Pulsa la card del personaje que crees que ganaría este enfrentamiento. Verás cómo se reparten los votos según su ELO actual.
          </p>
        </motion.header>
        <div
          key={`${a.slug}-${b.slug}`}
          className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6"
        >
          <VoteCard
            personaje={a}
            onClick={() => handleVote(a.slug)}
            isVoted={votedFor === a.slug}
            showResult={Boolean(votedFor)}
            pct={pctA}
          />
          <span className="flex h-14 w-14 items-center justify-center justify-self-center rounded-full border border-accent/40 bg-accent-soft text-accent">
            <Swords className="h-6 w-6" />
          </span>
          <VoteCard
            personaje={b}
            onClick={() => handleVote(b.slug)}
            isVoted={votedFor === b.slug}
            showResult={Boolean(votedFor)}
            pct={pctB}
          />
        </div>
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
          >
            {votedFor ? 'Siguiente enfrentamiento →' : 'Saltar enfrentamiento →'}
          </button>
        </div>
      </div>
    </section>
  )
}

function VoteCard({ personaje, onClick, isVoted, showResult, pct }) {
  const dimmed = showResult && !isVoted
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={showResult}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface text-left transition-all ${
        isVoted
          ? 'border-accent ring-2 ring-accent/40'
          : 'border-border hover:border-accent/40 hover:-translate-y-1'
      } ${dimmed ? 'opacity-50' : ''} disabled:cursor-default`}
    >
      <img
        src={imagenPersonaje(personaje.slug)}
        alt={personaje.nombre}
        className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="flex flex-col gap-1 p-4">
        <h3 className="text-base font-bold text-fg-strong">
          {personaje.nombre}
        </h3>
        <p className="text-[12px] text-fg-muted">{personaje.anime}</p>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-2"
          >
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
              <motion.div
                className={`h-full ${isVoted ? 'bg-accent' : 'bg-fg-muted'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-1.5 text-[12px] font-semibold text-fg-strong">
              {pct}% <span className="font-normal text-fg-muted">de los votos</span>
            </p>
          </motion.div>
        )}
      </div>
    </button>
  )
}

export default VotarPage
