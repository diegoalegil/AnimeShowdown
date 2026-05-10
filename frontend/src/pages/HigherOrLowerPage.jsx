import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Trophy, Sparkles, RotateCcw, ChevronRight } from 'lucide-react'
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

function pickPair() {
  const a = pickRandom()
  let b = pickRandom(a)
  // Si por azar tienen el mismo ELO, tira otro
  while (b.elo === a.elo) b = pickRandom(a)
  return [a, b]
}

function HigherOrLowerPage() {
  useDocumentTitle('Higher or Lower')
  const { play } = useSound()
  const [pair, setPair] = useState(() => pickPair())
  const [revealed, setRevealed] = useState(null) // null | 'correct' | 'wrong'
  const [chosenIndex, setChosenIndex] = useState(null) // 0 ó 1, qué card eligió el user
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

  const [a, b] = pair

  const handleChoose = (index) => {
    if (revealed !== null) return
    const elegido = pair[index]
    const otro = pair[index === 0 ? 1 : 0]
    const acierto = elegido.elo > otro.elo
    setChosenIndex(index)
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
      // Después de 900ms: el ganador se queda, aparece nuevo retador
      setTimeout(() => {
        const winner = elegido
        const newOpponent = pickRandom(winner)
        // Mantenemos al ganador en su lado, el retador en el opuesto
        setPair(index === 0 ? [winner, newOpponent] : [newOpponent, winner])
        setRevealed(null)
        setChosenIndex(null)
      }, 900)
    } else {
      play('playImpact')
      setTimeout(() => setGameOver(true), 900)
    }
  }

  const restart = () => {
    play('playClick')
    setPair(pickPair())
    setScore(0)
    setRevealed(null)
    setChosenIndex(null)
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
            Click en el personaje que creas que tiene más ELO. Si aciertas, se queda en pantalla
            y aparece un nuevo retador. Falla y empiezas de cero.
          </p>
        </header>

        <ScoreBar score={score} best={best} />

        <AnimatePresence mode="wait">
          {gameOver ? (
            <GameOver key="gameover" score={score} best={best} onRestart={restart} />
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <PersonajeCard
                personaje={a}
                revealedState={revealed}
                isChosen={chosenIndex === 0}
                isOther={chosenIndex !== null && chosenIndex !== 0}
                onClick={() => handleChoose(0)}
              />
              <PersonajeCard
                personaje={b}
                revealedState={revealed}
                isChosen={chosenIndex === 1}
                isOther={chosenIndex !== null && chosenIndex !== 1}
                onClick={() => handleChoose(1)}
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

function PersonajeCard({ personaje, revealedState, isChosen, isOther, onClick }) {
  const isCorrect = revealedState === 'correct'
  const isWrong = revealedState === 'wrong'

  const borderClass = useMemo(() => {
    if (revealedState === null) return 'border-border hover:border-accent/60'
    if (isChosen && isCorrect) return 'border-emerald-500'
    if (isChosen && isWrong) return 'border-rose-500'
    if (isOther && isWrong) return 'border-emerald-500/50'
    return 'border-border opacity-60'
  }, [revealedState, isChosen, isCorrect, isWrong, isOther])

  const overlayClass = useMemo(() => {
    if (revealedState === null) return ''
    if (isChosen && isCorrect) return 'bg-emerald-500/10'
    if (isChosen && isWrong) return 'bg-rose-500/10'
    return ''
  }, [revealedState, isChosen, isCorrect, isWrong])

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={revealedState !== null}
      layout
      className={`group relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface transition-all disabled:cursor-default ${borderClass} ${overlayClass}`}
      whileHover={revealedState === null ? { y: -3 } : {}}
      transition={{ duration: 0.2 }}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-alt">
        <img
          src={imagenPersonaje(personaje.slug)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
        />
        {revealedState !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 p-4 text-center backdrop-blur-md ${
              isChosen && isCorrect
                ? 'bg-emerald-500/90'
                : isChosen && isWrong
                  ? 'bg-rose-500/90'
                  : 'bg-black/60'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
              ELO
            </span>
            <span className="font-mono text-4xl font-extrabold text-white tabular-nums">
              {personaje.elo}
            </span>
          </motion.div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-4 py-3 text-left">
        <h3 className="text-base font-bold text-fg-strong">{personaje.nombre}</h3>
        <p className="text-[12px] text-fg-muted">{personaje.anime}</p>
        {revealedState === null && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            Pulsa para elegir <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </motion.button>
  )
}

function GameOver({ score, best, onRestart }) {
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
