import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import PersonajeImg from '../../../components/PersonajeImg'
import VoteFeedbackBurst from '../../../components/VoteFeedbackBurst'
import { useSound } from '../../../contexts/SoundContext'
import { useInstantSoundPress } from '../../../hooks/useInstantSoundPress'
import { imagenPersonaje } from '../../../lib/personajes-core'

const FALLBACK_DOMINANT_COLOR = 'var(--color-surface)'

const VoteCard = memo(function VoteCard({
  personaje,
  onClick,
  disabled,
  isVoted,
  isLoser,
  showResult,
  side,
  anonymousLimited,
  voteResult,
}) {
  const imgSrc = personaje.imagenUrl ?? imagenPersonaje(personaje.slug)
  const dominantColor = personaje.imagenColorDominante ?? FALLBACK_DOMINANT_COLOR
  const { warm } = useSound()
  const { onPointerDown: onSoundPointerDown, onClick: onSoundClick } = useInstantSoundPress('playVote')
  const reduceMotion = useReducedMotion()

  const handlePointerDown = (disabled || showResult) ? undefined : onSoundPointerDown
  const handleClick = (e) => {
    onSoundClick(e)
    onClick(e)
  }

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerEnter={warm}
        onFocus={warm}
        disabled={disabled || showResult}
        animate={
          isVoted
            ? { scale: reduceMotion ? 1 : 1.05 }
            : { scale: 1 }
        }
        transition={{ duration: reduceMotion ? 0.18 : 0.32, ease: 'easeOut' }}
        aria-label={
          anonymousLimited
            ? `Votar como invitado por ${personaje.nombre} de ${personaje.anime}`
            : `Votar por ${personaje.nombre} de ${personaje.anime}`
        }
        className={`group relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface transition-[transform,border-color,box-shadow,opacity,filter] ${
          isVoted
            ? 'border-accent shadow-[0_0_60px_-10px_rgba(159,29,44,0.7)] ring-2 ring-accent/40'
            : isLoser
              ? 'border-border opacity-40 grayscale'
              : 'border-border motion-safe:hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_0_40px_-15px_rgba(159,29,44,0.55)]'
        } disabled:cursor-default`}
      >
        <div
          className="relative aspect-[2/3] max-h-[min(44svh,28rem)] w-full overflow-hidden sm:max-h-[min(55svh,34rem)]"
          style={{ backgroundColor: dominantColor }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 36%, ${dominantColor} 0%, rgba(13, 13, 18, 0.72) 45%, rgba(13, 13, 18, 0.96) 100%)`,
            }}
          />
          <PersonajeImg
            slug={personaje.slug}
            src={imgSrc}
            alt={personaje.nombre}
            nombre={personaje.nombre}
            colorDominante={dominantColor}
            loading="eager"
            decoding="async"
            fetchPriority={side === 'left' ? 'high' : 'auto'}
            sizes="(max-width: 640px) 42vw, (max-width: 1024px) 38vw, 320px"
            className="relative h-full w-full object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
          />
          {isVoted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4"
            >
              <span className="rounded-full border-2 border-accent bg-black/70 px-3 py-1 font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold backdrop-blur-sm">
                ✓ Tu voto
              </span>
            </motion.div>
          )}
          <VoteFeedbackBurst
            active={Boolean(voteResult)}
            delta={voteResult?.delta}
            value={voteResult?.votosGanador}
            votosPerdedor={voteResult?.votosPerdedor}
            animateValue={false}
            particles={false}
            label="Voto registrado"
          />
          {anonymousLimited && !showResult && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-gold/50 bg-black/70 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-gold backdrop-blur-sm">
              Voto invitado
            </div>
          )}
        </div>
      </motion.button>
      <div
        className={`flex min-w-0 flex-col px-1 ${
          side === 'right' ? 'items-end text-right' : 'items-start text-left'
        }`}
      >
        <h2 className="line-clamp-1 w-full text-base font-bold text-fg-strong sm:text-lg">
          {personaje.nombre}
        </h2>
        <p className="line-clamp-1 w-full text-[12px] text-fg-muted">
          {personaje.anime}
        </p>
        {showResult && (
          <Link
            to={`/personajes/${personaje.slug}`}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
          >
            Ver ficha
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
})

export default VoteCard
