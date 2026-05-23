import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Sparkles,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Flame,
} from 'lucide-react'
import {
  personajes,
  getStatsPersonaje,
} from '../lib/personajes-core'
import {
  ELO_DUEL_BEST_KEY,
  ELO_DUEL_LEGACY_BEST_KEY,
  safeStorage,
} from '../lib/games'
import PersonajeImg from '../components/PersonajeImg'
import { useSound } from '../contexts/SoundContext'
import { useSeo } from '../hooks/useSeo'

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

function parseBestStreak(value) {
  const n = parseInt(value || '0', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function readBestStreak() {
  const current = parseBestStreak(safeStorage.get(ELO_DUEL_BEST_KEY))
  const legacy = parseBestStreak(safeStorage.get(ELO_DUEL_LEGACY_BEST_KEY))
  const best = Math.max(current, legacy)
  if (best > current) safeStorage.set(ELO_DUEL_BEST_KEY, String(best))
  return best
}

function HigherOrLowerPage() {
  useSeo({
    title: 'ELO Duel · Higher or Lower',
    description:
      'Mini-juego de adivinar quién tiene más ELO entre dos personajes anime. Sube tu mejor racha personal.',
  })
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
  const [best, setBest] = useState(readBestStreak)
  const [gameOver, setGameOver] = useState(false)
  // Ajuste (2026-05-17): los setTimeout de reveal (1100ms) no se
  // cancelan en unmount — si el user navega tras el guess pero antes
  // del reveal, el callback dispara setState en componente desmontado.
  const revealTimerRef = useRef(null)
  useEffect(() => () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
  }, [])

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
        safeStorage.set(ELO_DUEL_BEST_KEY, String(newScore))
      }
      // Después de 1100ms (suficiente para ver el reveal):
      // challenger se convierte en el nuevo reference (rota a la izquierda)
      // y aparece un nuevo challenger en la derecha
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null
        const nuevoChallenger = pickDistinctElo(challenger)
        setReference(challenger)
        setChallenger(nuevoChallenger)
        setRevealed(null)
      }, 1100)
    } else {
      play('playImpact')
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null
        setGameOver(true)
      }, 1100)
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
    <section className="as-stage as-stage-visual as-stage-duel relative flex flex-1 flex-col px-3 py-5 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-col items-start gap-2 sm:gap-3">
          <span className="as-kicker border-cyan-500/45 bg-cyan-500/10 text-cyan-200">
            <Sparkles className="h-3 w-3" />
            <span lang="ja">戦</span> · ELO Duel · Endless
          </span>
          <h1 className="text-[clamp(2.4rem,7vw,4.45rem)] font-extrabold leading-tight tracking-tight">
            <span className="as-title-gradient">ELO</span> Duel
          </h1>
          <p className="max-w-2xl text-[13px] text-fg-muted sm:text-base">
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
              /* Tres columnas desde mobile para mantener el duelo completo
                 dentro del primer viewport. */
              className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4 md:items-center md:gap-6"
            >
              <ReferenceCard personaje={reference} />
              <VsBadge revealed={revealed} />
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
  // Cerca del récord = a 2 o menos. Glow rosa para crear tensión "no te
  // duermas, casi lo igualas". A partir del récord el glow se mantiene
  // como recompensa de "estás en territorio nuevo".
  const cerca = best > 0 && score >= best - 2
  return (
    <div
      className={`as-panel flex items-center justify-between gap-3 rounded-xl px-5 py-3 transition-all duration-300 ${
        cerca
          ? 'border-accent/60 shadow-[0_0_40px_-12px_rgba(255,46,99,0.65)]'
          : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <Flame
          className={`h-4 w-4 ${cerca ? 'animate-pulse text-orange-400' : 'text-fg-muted'}`}
        />
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
        <span className="font-mono text-2xl font-extrabold tabular-nums text-gold">
          {best}
        </span>
      </div>
    </div>
  )
}

function VsBadge({ revealed }) {
  // Separador animado entre las 2 cards. Compacto en mobile (h-9), grande
  // en desktop (h-14) con líneas decorativas a ambos lados.
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className="hidden h-[1px] w-12 bg-border md:block" />
      <motion.div
        animate={
          revealed === null
            ? { scale: [1, 1.06, 1] }
            : revealed === 'correct'
              ? { rotate: [0, 8, -8, 0], scale: 1.15 }
              : { x: [0, -4, 4, -2, 2, 0], scale: 1 }
        }
        transition={{
          duration: revealed === null ? 1.8 : 0.5,
          repeat: revealed === null ? Infinity : 0,
          ease: 'easeInOut',
        }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 sm:h-14 sm:w-14 ${
          revealed === 'correct'
            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
            : revealed === 'wrong'
              ? 'border-rose-400 bg-rose-500/20 text-rose-200'
              : 'border-accent/60 bg-accent-soft text-gold'
        }`}
      >
        <span className="font-mono text-xs font-extrabold tracking-tighter sm:text-base">
          VS
        </span>
      </motion.div>
      <span className="hidden h-[1px] w-12 bg-border md:block" />
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
      className="as-ssr-card relative flex flex-col overflow-hidden rounded-2xl border-2 border-border"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-alt sm:aspect-auto sm:h-[40vh] sm:max-h-[470px]">
        <PersonajeImg
          slug={personaje.slug}
          alt={personaje.nombre}
          className="h-full w-full object-contain"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-0.5 bg-black/60 p-2 text-center backdrop-blur-md sm:gap-1 sm:p-4">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking-[0.2em]">
            ELO conocido
          </span>
          <span className="font-mono text-xl font-extrabold text-white tabular-nums sm:text-4xl">
            {personaje.elo}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-2 sm:gap-1 sm:px-4 sm:py-3">
        <h3 className="line-clamp-1 text-[13px] font-bold text-fg-strong sm:text-base">{personaje.nombre}</h3>
        <p className="line-clamp-1 text-[10px] text-fg-muted sm:text-[12px]">{personaje.anime}</p>
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
      className={`as-ssr-card relative flex flex-col overflow-hidden rounded-2xl border-2 transition-colors ${borderClass}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-alt sm:aspect-auto sm:h-[40vh] sm:max-h-[470px]">
        <PersonajeImg
          slug={personaje.slug}
          alt={personaje.nombre}
          className="h-full w-full object-contain"
        />
        <AnimatePresence>
          {!isRevealed && (
            <motion.div
              key="hidden"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-0.5 bg-black/60 p-2 text-center backdrop-blur-md sm:gap-1 sm:p-4"
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking-[0.2em]">
                ELO misterio
              </span>
              <HelpCircle className="h-6 w-6 text-white/90 sm:h-9 sm:w-9" />
            </motion.div>
          )}
          {isRevealed && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-0.5 p-2 text-center backdrop-blur-md sm:gap-1 sm:p-4 ${
                isCorrect ? 'bg-emerald-500/90' : 'bg-rose-500/90'
              }`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking-[0.2em]">
                ELO real
              </span>
              <span className="font-mono text-xl font-extrabold text-white tabular-nums sm:text-4xl">
                {personaje.elo}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <h3 className="line-clamp-1 text-[13px] font-bold text-fg-strong sm:text-base">{personaje.nombre}</h3>
          <p className="line-clamp-1 text-[10px] text-fg-muted sm:text-[12px]">{personaje.anime}</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-2 sm:gap-2">
          <button
            type="button"
            onClick={onMayor}
            disabled={isRevealed}
            className="group inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-2 text-[12px] font-semibold text-emerald-300 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Más ELO
          </button>
          <button
            type="button"
            onClick={onMenor}
            disabled={isRevealed}
            className="group inline-flex items-center justify-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-2 text-[12px] font-semibold text-rose-300 transition-all hover:-translate-y-0.5 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
      className="as-panel flex flex-col items-center gap-4 rounded-xl border-rose-500/30 bg-rose-500/5 p-8 text-center"
    >
      <span className="inline-flex rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-300">
        Game Over
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-fg-strong">
        Falló la racha
      </h2>
      <p className="max-w-md text-fg-muted">
        Conseguiste <span className="font-mono font-bold text-fg-strong">{score}</span> aciertos
        seguidos. Tu récord es <span className="font-mono font-bold text-gold">{best}</span>.
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
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
        >
          <Trophy className="h-4 w-4" />
          Ver ranking ELO
        </Link>
      </div>
    </motion.div>
  )
}

export default HigherOrLowerPage
