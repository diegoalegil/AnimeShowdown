import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Sparkles,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  HelpCircle,
} from 'lucide-react'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import { useSound } from '../contexts/SoundContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const BEST_KEY = 'animeshowdown.higherOrLower.best'

function pickRandom(exclude = null) {
  let p
  do {
    p = personajes[Math.floor(Math.random() * personajes.length)]
  } while (exclude && p.slug === exclude.slug)
  return { ...p, ...getStatsPersonaje(p.slug) }
}

function pickDistinctElo(reference) {
  let p = pickRandom(reference)
  // Si por azar tienen exactamente el mismo ELO, tira otro (evita ambigüedad
  // en la pregunta "más o menos" — en el catálogo solo pasa con personajes
  // muy similares en popularidad, pero por si acaso).
  while (p.elo === reference.elo) p = pickRandom(reference)
  return p
}

function HigherOrLowerPage() {
  useDocumentTitle('Higher or Lower')
  const { play } = useSound()

  // Mecánica clásica de Higher or Lower:
  //   - reference = personaje conocido en la izquierda (su ELO se ve)
  //   - challenger = personaje misterio en la derecha (ELO oculto hasta acertar)
  //   - User predice: ¿el challenger tiene MÁS o MENOS ELO que reference?
  //   - Si acierta: challenger se convierte en el nuevo reference, aparece nuevo challenger
  //   - Esto rota la cadena así no hay racha infinita con un top-tier en izquierda
  const [reference, setReference] = useState(() => pickRandom())
  const [challenger, setChallenger] = useState(() =>
    pickDistinctElo(reference || pickRandom()),
  )
  const [revealed, setRevealed] = useState(null) // null | 'correct' | 'wrong'
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10)
      return Number.isFinite(v) ? v : 0
    } catch {
      return 0
    }
  })
  const [gameOver, setGameOver] = useState(false)

  const handleGuess = (esMayor) => {
    if (revealed !== null) return
    const challengerEsMayor = challenger.elo > reference.elo
    const acierto = esMayor === challengerEsMayor
    setRevealed(acierto ? 'correct' : 'wrong')

    if (acierto) {
      play('playMagic')
      const newScore = score + 1
      setScore(newScore)
      if (newScore > best) {
        setBest(newScore)
        try {
          localStorage.setItem(BEST_KEY, String(newScore))
        } catch {
          // ignore storage errors
        }
      }
      // Después de 1100ms (suficiente para ver el reveal):
      // challenger se convierte en el nuevo reference (rota a la izquierda)
      // y aparece un nuevo challenger en la derecha
      setTimeout(() => {
        const nuevoChallenger = pickDistinctElo(challenger)
        setReference(challenger)
        setChallenger(nuevoChallenger)
        setRevealed(null)
      }, 1100)
    } else {
      play('playImpact')
      setTimeout(() => setGameOver(true), 1100)
    }
  }

  const restart = () => {
    play('playClick')
    const nuevoRef = pickRandom()
    setReference(nuevoRef)
    setChallenger(pickDistinctElo(nuevoRef))
    setScore(0)
    setRevealed(null)
    setGameOver(false)
  }

  return (
    <section className="relative flex flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <Sparkles className="h-3 w-3 text-accent" />
            Mini-juego
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Higher or Lower
          </h1>
          <p className="max-w-2xl text-fg-muted">
            ¿El personaje misterio tiene <strong className="text-fg-strong">más</strong> o <strong className="text-fg-strong">menos</strong> ELO que el de la izquierda?
            Cada acierto el misterio se desvela y se convierte en el nuevo punto de comparación.
          </p>
        </header>

        <ScoreBar score={score} best={best} />

        <AnimatePresence mode="wait">
          {gameOver ? (
            <GameOver
              key="gameover"
              score={score}
              best={best}
              reference={reference}
              challenger={challenger}
              onRestart={restart}
            />
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <ReferenceCard personaje={reference} />
              <ChallengerCard
                personaje={challenger}
                revealedState={revealed}
                onMayor={() => handleGuess(true)}
                onMenor={() => handleGuess(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[12px] text-fg-muted">
          Tu mejor racha se guarda en este navegador. Compite contigo mismo.
        </p>
      </div>
    </section>
  )
}

function ScoreBar({ score, best }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Racha actual
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-fg-strong">
          {score}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Récord
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-accent">
          {best}
        </span>
      </div>
    </div>
  )
}

function ReferenceCard({ personaje }) {
  return (
    <motion.div
      key={personaje.slug}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative flex flex-col overflow-hidden rounded-xl border-2 border-border bg-surface"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-alt">
        <img
          src={imagenPersonaje(personaje.slug)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 bg-black/60 p-4 text-center backdrop-blur-md">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
            ELO conocido
          </span>
          <span className="font-mono text-4xl font-extrabold text-white tabular-nums">
            {personaje.elo}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-4 py-3">
        <h3 className="text-base font-bold text-fg-strong">{personaje.nombre}</h3>
        <p className="text-[12px] text-fg-muted">{personaje.anime}</p>
      </div>
    </motion.div>
  )
}

function ChallengerCard({ personaje, revealedState, onMayor, onMenor }) {
  const isCorrect = revealedState === 'correct'
  const isWrong = revealedState === 'wrong'
  const isRevealed = revealedState !== null

  const borderClass = isCorrect
    ? 'border-emerald-500'
    : isWrong
      ? 'border-rose-500'
      : 'border-border'

  return (
    <motion.div
      key={personaje.slug}
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface transition-colors ${borderClass}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-alt">
        <img
          src={imagenPersonaje(personaje.slug)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
        <AnimatePresence>
          {!isRevealed && (
            <motion.div
              key="hidden"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 bg-black/60 p-4 text-center backdrop-blur-md"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                ELO misterio
              </span>
              <HelpCircle className="h-9 w-9 text-white/90" />
            </motion.div>
          )}
          {isRevealed && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 p-4 text-center backdrop-blur-md ${
                isCorrect ? 'bg-emerald-500/90' : 'bg-rose-500/90'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                ELO real
              </span>
              <span className="font-mono text-4xl font-extrabold text-white tabular-nums">
                {personaje.elo}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-fg-strong">{personaje.nombre}</h3>
          <p className="text-[12px] text-fg-muted">{personaje.anime}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMayor}
            disabled={isRevealed}
            className="group inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-300 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <ArrowUp className="h-4 w-4" />
            Más ELO
          </button>
          <button
            type="button"
            onClick={onMenor}
            disabled={isRevealed}
            className="group inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-300 transition-all hover:-translate-y-0.5 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <ArrowDown className="h-4 w-4" />
            Menos ELO
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function GameOver({ score, best, reference, challenger, onRestart }) {
  const challengerEsMayor = challenger.elo > reference.elo
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-8 text-center"
    >
      <span className="inline-flex rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-300">
        Game Over
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-fg-strong">
        Falló la racha
      </h2>
      <p className="max-w-md text-fg-muted">
        Conseguiste <span className="font-mono font-bold text-fg-strong">{score}</span> aciertos
        seguidos. Tu récord es <span className="font-mono font-bold text-accent">{best}</span>.
      </p>
      <div className="text-sm text-fg-muted">
        <span className="font-bold text-fg-strong">{challenger.nombre}</span> tiene ELO{' '}
        <span className="font-mono text-fg-strong">{challenger.elo}</span> →{' '}
        {challengerEsMayor ? (
          <span className="text-emerald-300">era MAYOR</span>
        ) : (
          <span className="text-rose-300">era MENOR</span>
        )}{' '}
        que <span className="font-bold text-fg-strong">{reference.nombre}</span> ({reference.elo}).
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <RotateCcw className="h-4 w-4" />
          Volver a jugar
        </button>
        <Link
          to="/ranking"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
        >
          <Trophy className="h-4 w-4" />
          Ver ranking ELO
        </Link>
      </div>
    </motion.div>
  )
}

export default HigherOrLowerPage
