import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy,
  Sparkles,
  RotateCcw,
  Flame,
  Share2,
} from 'lucide-react'
import {
  buildGameShareText,
  ELO_DUEL_BEST_KEY,
  ELO_DUEL_LEGACY_BEST_KEY,
  safeStorage,
} from '../lib/games'
import { endpoints } from '../lib/api'
import GoldScale from '../features/games/eloDuel/GoldScale'
import GameCatalogLoading from '../components/GameCatalogLoading'
import { useSound } from '../contexts/SoundContext'
import { useSeo } from '../hooks/useSeo'
import { shareWithToast } from '../lib/shareWithToast'
import JsonLd from '../components/JsonLd'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import { getGameVisual } from '../data/visual-assets'

const SEO_IMAGE = getGameVisual('/games/elo-duel').image
const CHOICE_HIGHER = 'HIGHER'
const CHOICE_LOWER = 'LOWER'

function choiceFromGuess(esMayor) {
  return esMayor ? CHOICE_HIGHER : CHOICE_LOWER
}

function isHigherChoice(choice) {
  return choice === CHOICE_HIGHER
}

function describeLoadError(error) {
  if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
    return 'ELO Duel necesita más votos comunitarios para abrir una ronda equilibrada.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo cargar una ronda de ELO Duel.'
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
      'Mini-juego de adivinar quién tiene más ELO competitivo entre dos personajes anime. Sube tu mejor racha personal.',
    canonical: 'https://animeshowdown.dev/games/elo-duel',
    image: SEO_IMAGE,
  })

  return <HigherOrLowerGame />
}

function HigherOrLowerGame() {
  const { play } = useSound()
  const initialRoundQuery = useQuery({
    queryKey: ['elo-duel', 'round'],
    queryFn: () => endpoints.eloDuelRound(),
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const [roundOverride, setRoundOverride] = useState(null)
  const [result, setResult] = useState(null)
  const [isManualLoading, setIsManualLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [manualError, setManualError] = useState('')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBestStreak)
  const [gameOver, setGameOver] = useState(false)
  // Lado elegido en la balanza ('left'=referencia pesa más → retador menor).
  const [picked, setPicked] = useState(null)
  const mountedRef = useRef(false)
  const revealTimerRef = useRef(null)
  // Si el último acierto superó el récord previo. Se calcula en el handler (con
  // el `best` anterior al bump) porque en render `best` ya está actualizado.
  const [recordBeaten, setRecordBeaten] = useState(false)
  const round = roundOverride ?? initialRoundQuery.data ?? null
  const loadError = manualError || (initialRoundQuery.isError ? describeLoadError(initialRoundQuery.error) : '')
  const isLoading = isManualLoading || (!round && initialRoundQuery.isLoading)

  const fetchRound = useCallback(async ({ resetScore = false } = {}) => {
    try {
      const nextRound = await endpoints.eloDuelRound()
      if (!mountedRef.current) return
      setRoundOverride(nextRound)
      setResult(null)
      setRecordBeaten(false)
      setPicked(null)
      setGameOver(false)
      if (resetScore) setScore(0)
    } catch (error) {
      if (!mountedRef.current) return
      setManualError(describeLoadError(error))
    } finally {
      if (mountedRef.current) setIsManualLoading(false)
    }
  }, [])

  const loadRound = useCallback(async ({ resetScore = false } = {}) => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    if (mountedRef.current) {
      setIsManualLoading(true)
      setManualError('')
    }
    await fetchRound({ resetScore })
  }, [fetchRound])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [])

  const handleGuess = async (esMayor) => {
    if (!round || result !== null || isSubmitting) return
    setIsSubmitting(true)
    setManualError('')
    let guessResult
    try {
      guessResult = await endpoints.eloDuelGuess({
        roundToken: round.roundToken,
        choice: choiceFromGuess(esMayor),
      })
    } catch (error) {
      setManualError(describeLoadError(error))
      setIsSubmitting(false)
      return
    }

    setResult(guessResult)
    setIsSubmitting(false)

    if (guessResult.correct) {
      const newScore = score + 1
      setRecordBeaten(newScore > best)
      setScore(newScore)
      if (newScore > best) {
        setBest(newScore)
        safeStorage.set(ELO_DUEL_BEST_KEY, String(newScore))
      }
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null
        if (!mountedRef.current) return
        if (guessResult.nextRound) {
          setRoundOverride(guessResult.nextRound)
          setResult(null)
          setRecordBeaten(false)
          setPicked(null)
        } else {
          loadRound()
        }
      }, 1100)
    } else {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null
        if (!mountedRef.current) return
        setGameOver(true)
      }, 1100)
    }
  }

  const restart = () => {
    play('playClick')
    loadRound({ resetScore: true })
  }

  if (isLoading && !round) {
    return (
      <GameCatalogLoading
        kanji="戦"
        title="Preparando ELO Duel"
        description="Conectando con el ranking competitivo del servidor."
      />
    )
  }

  if (!round) {
    return <EloDuelUnavailable message={loadError} onRetry={restart} />
  }

  const reference = round.reference
  const challenger = round.challenger
  const revealed = result ? (result.correct ? 'correct' : 'wrong') : null
  const scoreLabel = round.scoreLabel || 'ELO competitivo'
  const roundStatus = buildRoundStatus({
    challenger,
    reference,
    revealed,
    score,
    scoreLabel,
    referenceElo: result?.referenceElo ?? round.referenceElo,
    challengerElo: result?.challengerElo ?? round.challengerElo,
    correctChoice: result?.correctChoice,
  })

  return (
    <section className="as-stage as-stage-visual as-stage-duel relative flex flex-1 flex-col px-3 py-5 sm:px-8 sm:py-10">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'ELO Duel', path: '/games/elo-duel' },
        ])}
      />
      <JsonLd
        id="game-elo-duel"
        schema={gameWebApplicationSchema({
          name: 'ELO Duel',
          alternateName: 'Anime Higher or Lower',
          path: '/games/elo-duel',
          description:
            'Juego endless de anime higher or lower para adivinar qué personaje tiene más ELO competitivo y construir una racha personal.',
          featureList: [
            'Duelos de personajes anime',
            'Pregunta higher or lower por ELO competitivo',
            'Racha personal guardada en el navegador',
            'Resultado compartible',
          ],
          keywords: [
            'anime higher or lower',
            'elo duel',
            'ranking ELO anime',
            'juego anime online',
          ],
        })}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-col items-start gap-2 sm:gap-3">
          <span className="as-kicker border-electric/45 bg-electric/10 text-electric">
            <Sparkles className="h-3 w-3" />
            <span lang="ja">戦</span> · ELO Duel · Endless
          </span>
          <h1 className="text-[clamp(2.4rem,7vw,4.45rem)] font-extrabold leading-tight tracking-tight">
            <span className="as-title-gradient">ELO</span> Duel
          </h1>
          <p className="max-w-2xl text-[13px] text-fg-muted sm:text-base">
            ¿El personaje misterio tiene <strong className="text-fg-strong">más</strong> o <strong className="text-fg-strong">menos</strong> ELO competitivo que el de la izquierda?
            Cada acierto el misterio se desvela y se convierte en el nuevo punto de comparación.
          </p>
        </header>

        <ScoreBar score={score} best={best} />
        {/* "+N monedas" al acertar: solo aparece si el server acreditó (logueado
            y dentro del tope diario). Anónimo o topado → monedasGanadas 0 → nada. */}
        <AnimatePresence>
          {result?.correct && result.monedasGanadas > 0 && (
            <motion.p
              key={`coins-${score}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-center font-mono text-sm font-bold text-gold"
              aria-live="polite"
            >
              +{result.monedasGanadas} monedas
            </motion.p>
          )}
        </AnimatePresence>
        <RoundStatusBanner
          message={roundStatus}
          tone={revealed}
        />

        {loadError && (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
          >
            {loadError}
          </div>
        )}

        <AnimatePresence mode="wait">
          {gameOver ? (
            <GameOver
              key="gameover"
              score={score}
              best={best}
              reference={reference}
              challenger={challenger}
              referenceElo={result?.referenceElo ?? round.referenceElo}
              challengerElo={result?.challengerElo}
              correctChoice={result?.correctChoice}
              scoreLabel={scoreLabel}
              onRestart={restart}
            />
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto w-full max-w-5xl"
            >
              {/* La balanza de oro: cero reveal especulativo — el brazo solo
                  pesa cuando llega el resultado del server, keyed por ronda. */}
              <GoldScale
                left={reference}
                right={challenger}
                leftElo={round.referenceElo}
                rightElo={null}
                picked={picked}
                result={
                  result
                    ? {
                        outcome: result.correct ? 'win' : 'lose',
                        leftElo: result.referenceElo ?? round.referenceElo,
                        rightElo: result.challengerElo,
                        // score ya es el valor post-acierto en este render.
                        streakAfter: score,
                        recordBeaten: result.correct && recordBeaten,
                        recordAfter: Math.max(score, best),
                        resultId: round.roundToken,
                      }
                    : null
                }
                onPick={(side) => {
                  setPicked(side)
                  handleGuess(side === 'right')
                }}
                streak={result?.correct ? score - 1 : score}
                disabled={isSubmitting || gameOver}
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

function buildRoundStatus({
  challenger,
  reference,
  revealed,
  score,
  scoreLabel,
  referenceElo,
  challengerElo,
  correctChoice,
}) {
  if (!challenger || !reference) return 'Preparando el siguiente duelo.'
  if (revealed === 'correct') {
    const comparison = buildComparisonText({
      challengerElo,
      referenceElo,
      correctChoice,
      referenceName: reference.nombre,
      scoreLabel,
    })
    return `Correcto: ${challenger.nombre} tiene ${comparison}. Racha actual: ${score}.`
  }
  if (revealed === 'wrong') {
    const comparison = buildComparisonText({
      challengerElo,
      referenceElo,
      correctChoice,
      referenceName: reference.nombre,
      scoreLabel,
    })
    return `Fallaste: ${challenger.nombre} tiene ${comparison}. La ronda termina con racha ${score}.`
  }
  return `Ronda lista: decide si ${challenger.nombre} tiene más o menos ${scoreLabel} que ${reference.nombre}.`
}

function buildComparisonText({
  challengerElo,
  referenceElo,
  correctChoice,
  referenceName,
  scoreLabel,
}) {
  if (correctChoice === CHOICE_HIGHER) {
    return `más ${scoreLabel} que ${referenceName}`
  }
  if (correctChoice === CHOICE_LOWER) {
    return `menos ${scoreLabel} que ${referenceName}`
  }
  if (Number.isFinite(challengerElo) && Number.isFinite(referenceElo)) {
    if (challengerElo > referenceElo) return `más ${scoreLabel} que ${referenceName}`
    if (challengerElo < referenceElo) return `menos ${scoreLabel} que ${referenceName}`
    return `el mismo ${scoreLabel} que ${referenceName}`
  }
  return `un resultado revelado frente a ${referenceName}`
}

function RoundStatusBanner({ message, tone }) {
  const toneClass = tone === 'correct'
    ? 'border-success/45 bg-success/10 text-success'
    : tone === 'wrong'
      ? 'border-danger/45 bg-danger/10 text-danger'
      : 'border-border bg-surface text-fg-muted'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Resultado del ELO Duel"
      className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${toneClass}`}
    >
      {message}
    </div>
  )
}

function EloDuelUnavailable({ message, onRetry }) {
  return (
    <section className="as-stage as-stage-visual as-stage-duel relative flex flex-1 flex-col items-center justify-center px-3 py-8 sm:px-8">
      <div className="as-panel flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border-danger/30 bg-danger/5 p-8 text-center">
        <span className="as-kicker border-danger/35 bg-danger/10 text-danger">
          <span lang="ja">戦</span> · ELO Duel
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-fg-strong">
          Ronda no disponible
        </h1>
        <p role="alert" className="text-sm text-fg-muted">
          {message || 'No se pudo cargar una ronda de ELO Duel.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </button>
          <Link
            to="/ranking"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
          >
            <Trophy className="h-4 w-4" />
            Ver ranking
          </Link>
        </div>
      </div>
    </section>
  )
}

function ScoreBar({ score, best }) {
  // Cerca del récord = a 2 o menos. Glow carmesí para crear tensión "no te
  // duermas, casi lo igualas". A partir del récord el glow se mantiene
  // como recompensa de "estás en territorio nuevo".
  const cerca = best > 0 && score >= best - 2
  return (
    <div
      className={`as-panel flex items-center justify-between gap-3 rounded-xl px-5 py-3 transition-all duration-300 ${
        cerca
          ? 'border-accent/60 shadow-aura'
          : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <Flame
          className={`h-4 w-4 ${cerca ? 'animate-pulse text-medal-bronze' : 'text-fg-muted'}`}
        />
        <span className="text-[11px] font-semibold text-fg-muted">
          Racha actual
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-fg-strong">
          {score}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-medal-gold" />
        <span className="text-[11px] font-semibold text-fg-muted">
          Récord
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-gold">
          {best}
        </span>
      </div>
    </div>
  )
}

function GameOver({
  score,
  best,
  reference,
  challenger,
  referenceElo,
  challengerElo,
  correctChoice,
  scoreLabel,
  onRestart,
}) {
  const challengerEsMayor = isHigherChoice(correctChoice)
  const compartir = async () => {
    await shareWithToast(
      {
        title: 'ELO Duel',
        text: buildGameShareText({
          game: 'ELO Duel',
          date: null,
          result: `racha ${score}`,
          detail: `Récord: ${best}. Fallé con ${challenger.nombre} vs ${reference.nombre}.`,
        }),
        url: '/games/elo-duel',
      },
      {
        clipboardSuccess: 'Resultado copiado',
        errorTitle: 'No se pudo compartir el resultado',
        nativeSuccess: 'Resultado compartido',
      },
    )
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="as-panel flex flex-col items-center gap-4 rounded-2xl border-danger/30 bg-danger/5 p-8 text-center"
    >
      <span className="inline-flex rounded-full border border-danger/40 bg-danger/10 px-3 py-1.5 text-[11px] font-semibold text-danger">
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
        <span className="font-bold text-fg-strong">{challenger.nombre}</span> tiene {scoreLabel}{' '}
        <span className="font-mono text-fg-strong">{challengerElo}</span> →{' '}
        {challengerEsMayor ? (
          <span className="text-success">era MAYOR</span>
        ) : (
          <span className="text-danger">era MENOR</span>
        )}{' '}
        que <span className="font-bold text-fg-strong">{reference.nombre}</span> ({referenceElo}).
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
          Ver ranking
        </Link>
        <button
          type="button"
          onClick={compartir}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
        >
          <Share2 className="h-4 w-4" />
          Compartir racha
        </button>
      </div>
    </motion.div>
  )
}

export default HigherOrLowerPage
