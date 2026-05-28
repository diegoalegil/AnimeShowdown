import { memo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import VoteCard from './VoteCard'
import VsBadge from './VsBadge'

/**
 * VoteArena — el grid de duelo (dos VoteCard + VS badge).
 *
 * Extraído de VotarPage para aislar los re-renders de estado de voto:
 * cuando cambia `votedFor` en VotarPage, solo este subcomponente (y sus
 * hijos) se re-renderizan; QuickModes, DailyMissionPanel y el resto de
 * la página quedan fuera del ciclo.
 *
 * AnimatePresence mode="popLayout" + exit: el par actual hace fade-out/up
 * mientras el siguiente hace fade-in/down, evitando el corte abrupto.
 */
const VoteArena = memo(function VoteArena({
  a,
  b,
  votedFor,
  voteResult,
  controlsDisabled,
  votoInvitadoActivo,
  handleVoteLeft,
  handleVoteRight,
}) {
  const reduceMotion = useReducedMotion()
  const arenaKey = a && b ? `${a.slug}-${b.slug}` : 'empty'

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={arenaKey}
        data-votar-arena
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeInOut' }}
        className="relative grid grid-cols-2 items-start gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-6"
      >
        <div className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2 sm:hidden">
          <VsBadge votedFor={votedFor} compact />
        </div>
        <VoteCard
          personaje={a}
          onClick={handleVoteLeft}
          disabled={controlsDisabled}
          isVoted={votedFor === a.slug}
          isLoser={Boolean(votedFor && votedFor !== a.slug)}
          showResult={Boolean(votedFor)}
          side="left"
          anonymousLimited={votoInvitadoActivo}
          voteResult={voteResult?.ganadorSlug === a.slug ? voteResult : null}
        />
        <div className="hidden self-center justify-self-center sm:flex">
          <VsBadge votedFor={votedFor} />
        </div>
        <VoteCard
          personaje={b}
          onClick={handleVoteRight}
          disabled={controlsDisabled}
          isVoted={votedFor === b.slug}
          isLoser={Boolean(votedFor && votedFor !== b.slug)}
          showResult={Boolean(votedFor)}
          side="right"
          anonymousLimited={votoInvitadoActivo}
          voteResult={voteResult?.ganadorSlug === b.slug ? voteResult : null}
        />
      </motion.div>
    </AnimatePresence>
  )
})

export default VoteArena
