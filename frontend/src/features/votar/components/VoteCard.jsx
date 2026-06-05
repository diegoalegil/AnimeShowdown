import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import PersonajeCutImg from '../../../components/PersonajeCutImg'
import PersonajeImg from '../../../components/PersonajeImg'
import VoteFeedbackBurst from '../../../components/VoteFeedbackBurst'
import { useSound } from '../../../contexts/SoundContext'
import { useInstantSoundPress } from '../../../hooks/useInstantSoundPress'
import { hasCut } from '../../../lib/cuts'
import { imagenPersonaje } from '../../../lib/personajes-core'

const FALLBACK_DOMINANT_COLOR = 'var(--color-surface)'

const VoteCard = memo(function VoteCard({
  personaje,
  onClick,
  disabled,
  isVoted,
  isLoser,
  isTie,
  showResult,
  side,
  anonymousLimited,
  blindMode = false,
  voteResult,
  ownsEspecial = false,
}) {
  const imgSrc = personaje.imagenUrl ?? imagenPersonaje(personaje.slug)
  const dominantColor = personaje.imagenColorDominante ?? FALLBACK_DOMINANT_COLOR
  // Glow ambiente teñido con el color dominante, suavizado con alpha vía
  // color-mix para que cada carta brille en su color también en reposo sin
  // resultar agresivo. El borde de "votado" usa el color sólido.
  const glowColor = `color-mix(in srgb, ${dominantColor} 55%, transparent)`
  const { warm } = useSound()
  const { onPointerDown: onSoundPointerDown, onClick: onSoundClick } = useInstantSoundPress('playVote')
  const reduceMotion = useReducedMotion()
  const identityHidden = blindMode && !showResult
  const sideLabel = side === 'right' ? 'derecha' : 'izquierda'
  const optionLabel = `Opción ${sideLabel}`
  const canUseCut = identityHidden && hasCut(personaje.slug)
  const voteAriaLabel = identityHidden
    ? anonymousLimited
      ? `Votar como invitado a ciegas por la opción ${sideLabel}`
      : `Votar a ciegas por la opción ${sideLabel}`
    : anonymousLimited
      ? `Votar como invitado por ${personaje.nombre} de ${personaje.anime}`
      : `Votar por ${personaje.nombre} de ${personaje.anime}`

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
        aria-label={voteAriaLabel}
        className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-[transform,border-color,box-shadow,opacity,filter] ${
          isVoted
            ? 'shadow-aura-lg ring-2 ring-white/25'
            : isTie
              ? 'border-gold/60 shadow-aura'
            : isLoser
              ? 'border-transparent opacity-40 grayscale'
              : 'border-transparent shadow-aura motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-aura-lg'
        } disabled:cursor-default`}
        style={{
          // Glow y borde de selección personalizados con el color dominante de
          // cada carta (ranura --aura-color de la escala de sombras). La carta
          // va "a sangre": sin marco de superficie ni viñeta oscura.
          '--aura-color': glowColor,
          borderColor: isVoted ? dominantColor : undefined,
        }}
      >
        <div
          className="relative aspect-[2/3] max-h-[min(44svh,28rem)] w-full overflow-hidden sm:max-h-[min(55svh,34rem)]"
          style={{ backgroundColor: identityHidden ? 'var(--color-bg)' : dominantColor }}
        >
          {canUseCut ? (
            <PersonajeCutImg
              slug={personaje.slug}
              alt={`Silueta de la ${optionLabel.toLowerCase()}`}
              className="h-full w-full"
              imgClassName="scale-[1.04] brightness-0 blur-[1px] transition-all duration-300"
              loading="eager"
              decoding="async"
            />
          ) : (
            <PersonajeImg
              slug={personaje.slug}
              src={imgSrc}
              alt={identityHidden ? `Personaje oculto en la ${optionLabel.toLowerCase()}` : personaje.nombre}
              nombre={identityHidden ? optionLabel : personaje.nombre}
              colorDominante={dominantColor}
              loading="eager"
              decoding="async"
              fetchPriority={side === 'left' ? 'high' : 'auto'}
              sizes="(max-width: 640px) 42vw, (max-width: 1024px) 38vw, 320px"
              fit="contain"
              position="center"
              className={`relative h-full w-full object-cover transition-transform duration-300 ${
                identityHidden
                  ? 'scale-[1.04] brightness-0 blur-sm'
                  : 'motion-safe:group-hover:scale-[1.03]'
              }`}
            />
          )}
          {ownsEspecial && !identityHidden && (
            <span
              className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border bg-black/70 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm"
              style={{
                color: 'var(--color-electric)',
                borderColor: 'color-mix(in srgb, var(--color-electric) 55%, transparent)',
              }}
              title="Tienes la carta especial de este personaje"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Especial
            </span>
          )}
          {isVoted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4"
            >
              <span className="rounded-full border-2 border-accent bg-black/70 px-3 py-1 font-mono text-[11px] font-extrabold text-gold backdrop-blur-sm">
                ✓ Tu voto
              </span>
            </motion.div>
          )}
          {isTie && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4"
            >
              <span className="rounded-full border-2 border-gold bg-black/70 px-3 py-1 font-mono text-[11px] font-extrabold text-gold backdrop-blur-sm">
                ½ voto
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
            label={isTie ? 'Medio voto' : 'Voto registrado'}
          />
          {anonymousLimited && !showResult && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-gold/50 bg-black/70 px-3 py-1.5 text-center text-[11px] font-bold text-gold backdrop-blur-sm">
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
          {identityHidden ? optionLabel : personaje.nombre}
        </h2>
        <p className="line-clamp-1 w-full text-[12px] text-fg-muted">
          {identityHidden ? 'Identidad oculta' : personaje.anime}
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
