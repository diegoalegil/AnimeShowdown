import { useEffect, useMemo, useRef, useState } from 'react'
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
  Share2,
} from 'lucide-react'
import {
  getStatsPersonaje,
} from '../lib/personajes-core'
import {
  buildGameShareText,
  ELO_DUEL_BEST_KEY,
  ELO_DUEL_LEGACY_BEST_KEY,
  safeStorage,
} from '../lib/games'
import PersonajeImg from '../components/PersonajeImg'
import GameCatalogLoading from '../components/GameCatalogLoading'
import { useSound } from '../contexts/SoundContext'
import { useSeo } from '../hooks/useSeo'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { shareWithToast } from '../lib/shareWithToast'
import JsonLd from '../components/JsonLd'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import { getGameVisual } from '../data/visual-assets'

const SEO_IMAGE = getGameVisual('/games/elo-duel').image

function pickRandom(catalogoPersonajes, exclude = null) {
  const pool = exclude
    ? catalogoPersonajes.filter((p) => p.slug !== exclude.slug)
    : catalogoPersonajes
  const p = pool[Math.floor(Math.random() * pool.length)]
  if (!p) return null
  return { ...p, ...getStatsPersonaje(p.slug) }
}

// El ELO base es sintético (deriva de la popularidad) y hace que >85% del
// catálogo empate en una franja estrecha. Sin un delta mínimo, muchos duelos
// eran cara-o-cruz: dos personajes con ELO casi idéntico y respuesta ambigua.
// Exigimos una diferencia mínima para que "más o menos" siempre tenga una
// respuesta defendible. Si tras varios intentos no la hallamos (catálogo
// diminuto), devolvemos el de mayor diferencia encontrada.
const MIN_ELO_DELTA = 40

function pickDistinctElo(catalogoPersonajes, reference) {
  let best = null
  let bestDelta = -1
  for (let i = 0; i < 24; i++) {
    const p = pickRandom(catalogoPersonajes, reference)
    if (!p) break
    const delta = Math.abs(p.elo - reference.elo)
    if (delta >= MIN_ELO_DELTA) return p
    if (delta > bestDelta) {
      best = p
      bestDelta = delta
    }
  }
  return best
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
      'Mini-juego de adivinar quién tiene más ELO base entre dos personajes anime. Sube tu mejor racha personal.',
    canonical: 'https://animeshowdown.dev/games/elo-duel',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const parejaInicial = useMemo(() => {
    const reference = pickRandom(catalogoPersonajes)
    if (!reference) return null
    const challenger = pickDistinctElo(catalogoPersonajes, reference)
    if (!challenger) return null
    return { reference, challenger }
  }, [catalogoPersonajes])

  if (!parejaInicial) {
    return (
      <GameCatalogLoading
        kanji="戦"
        title="Preparando ELO Duel"
        description="Cargando ranking de personajes para iniciar el duelo."
      />
    )
  }

  return (
    <HigherOrLowerGame
      catalogoPersonajes={catalogoPersonajes}
      initialChallenger={parejaInicial.challenger}
      initialReference={parejaInicial.reference}
    />
  )
}

function HigherOrLowerGame({
  catalogoPersonajes,
  initialChallenger,
  initialReference,
}) {
  const { play } = useSound()

  // Mecánica clásica de Higher or Lower:
  //   - reference = personaje conocido en la izquierda (su ELO se ve)
  //   - challenger = personaje misterio en la derecha (ELO oculto hasta acertar)
  //   - User predice: ¿el challenger tiene MÁS o MENOS ELO que reference?
  //   - Si acierta: challenger se convierte en el nuevo reference, aparece nuevo challenger
  //   - Esto rota la cadena así no hay racha infinita con un top-tier en izquierda
  const [reference, setReference] = useState(initialReference)
  const [challenger, setChallenger] = useState(initialChallenger)
  const [revealed, setRevealed] = useState(null) // null | 'correct' | 'wrong'
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBestStreak)
  const [gameOver, setGameOver] = useState(false)
  // los setTimeout de reveal (1100ms) no se
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
        const nuevoChallenger = pickDistinctElo(catalogoPersonajes, challenger)
        if (!nuevoChallenger) return
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
    const nuevoRef = pickRandom(catalogoPersonajes)
    if (!nuevoRef) return
    const nuevoChallenger = pickDistinctElo(catalogoPersonajes, nuevoRef)
    if (!nuevoChallenger) return
    setReference(nuevoRef)
    setChallenger(nuevoChallenger)
    setScore(0)
    setRevealed(null)
    setGameOver(false)
  }

  const roundStatus = buildRoundStatus({
    challenger,
    reference,
    revealed,
    score,
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
            'Juego endless de anime higher or lower para adivinar qué personaje tiene más ELO base y construir una racha personal.',
          featureList: [
            'Duelos de personajes anime',
            'Pregunta higher or lower por ELO base',
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
            ¿El personaje misterio tiene <strong className="text-fg-strong">más</strong> o <strong className="text-fg-strong">menos</strong> ELO base que el de la izquierda?
            Cada acierto el misterio se desvela y se convierte en el nuevo punto de comparación.
          </p>
        </header>

        <ScoreBar score={score} best={best} />
        <RoundStatusBanner
          message={roundStatus}
          tone={revealed}
        />

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

function buildRoundStatus({ challenger, reference, revealed, score }) {
  if (!challenger || !reference) return 'Preparando el siguiente duelo.'
  if (revealed === 'correct') {
    const relation = challenger.elo > reference.elo ? 'más' : 'menos'
    return `Correcto: ${challenger.nombre} tiene ${relation} ELO que ${reference.nombre}. Racha actual: ${score}.`
  }
  if (revealed === 'wrong') {
    const relation = challenger.elo > reference.elo ? 'más' : 'menos'
    return `Fallaste: ${challenger.nombre} tiene ${relation} ELO que ${reference.nombre}. La ronda termina con racha ${score}.`
  }
  return `Ronda lista: decide si ${challenger.nombre} tiene más o menos ELO que ${reference.nombre}.`
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
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Racha actual
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-fg-strong">
          {score}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-medal-gold" />
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
            ? 'border-success bg-success/20 text-success'
            : revealed === 'wrong'
              ? 'border-danger bg-danger/20 text-danger'
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
            ELO base
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
    ? 'border-success'
    : isWrong
      ? 'border-danger'
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
                ELO base oculto
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
                isCorrect ? 'bg-success/90' : 'bg-danger/90'
              }`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/80 sm:text-[10px] sm:tracking-[0.2em]">
                ELO base
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
            className="group inline-flex items-center justify-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-2 text-[12px] font-semibold text-success transition-all hover:-translate-y-0.5 hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Más ELO
          </button>
          <button
            type="button"
            onClick={onMenor}
            disabled={isRevealed}
            className="group inline-flex items-center justify-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-2 py-2 text-[12px] font-semibold text-danger transition-all hover:-translate-y-0.5 hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm"
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
      <span className="inline-flex rounded-full border border-danger/40 bg-danger/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-danger">
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
        <span className="font-bold text-fg-strong">{challenger.nombre}</span> tiene ELO base{' '}
        <span className="font-mono text-fg-strong">{challenger.elo}</span> →{' '}
        {challengerEsMayor ? (
          <span className="text-success">era MAYOR</span>
        ) : (
          <span className="text-danger">era MENOR</span>
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
