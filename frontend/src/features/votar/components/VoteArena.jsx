import { memo, useMemo } from 'react'
import { useSound } from '../../../contexts/SoundContext'
import { ArrowRight, Scale } from 'lucide-react'
import { AppLink } from '../../../components/AppLink'
import VoteCard from './VoteCard'
import VsBadge from './VsBadge'
import DuelEntrance from './DuelEntrance'
import { getAnimeIdentity } from '../../../data/anime-identities'
import { slugifyAnime } from '../../../lib/animes'

/**
 * VoteArena — el grid de duelo (dos VoteCard + VS badge).
 *
 * Extraído de VotarPage para aislar los re-renders de estado de voto:
 * cuando cambia `votedFor` en VotarPage, solo este subcomponente (y sus
 * hijos) se re-renderizan; QuickModes, DailyMissionPanel y el resto de
 * la página quedan fuera del ciclo.
 *
 * El montaje del par lo coreografía DuelEntrance (entrada de
 * combatientes: caminata desde los laterales + squash + VS de tinta +
 * nombres por corte) — sustituye al AnimatePresence popLayout. Los
 * nombres los pinta DuelEntrance (VoteCard va con captionHidden), así
 * que en modo a ciegas recibe las identidades YA enmascaradas (Opción
 * A/B, sin kanji de universo) y el revelado llega como espejo en seco.
 */
function toFigura(p, sideLabel, oculto) {
  if (!p) return p
  if (oculto) {
    return {
      slug: p.slug,
      personaje: p,
      nombre: `Opción ${sideLabel}`,
      anime: 'Identidad oculta',
      kanji: null,
    }
  }
  return {
    slug: p.slug,
    personaje: p,
    nombre: p.nombre,
    anime: p.anime,
    // Mismo patrón que DueloVersusPage: kanji de universo curado (o el
    // genérico de la casa) por slug de anime.
    kanji: getAnimeIdentity(slugifyAnime(p.anime), p.anime)?.kanji ?? null,
  }
}

const VoteArena = memo(function VoteArena({
  a,
  b,
  votedFor,
  voteResult,
  controlsDisabled,
  votoInvitadoActivo,
  blindMode,
  blindReveal = false,
  handleVoteLeft,
  handleVoteRight,
  handleTieVote,
  canTie = false,
  fastMode = false,
  ownsEspecialA = false,
  ownsEspecialB = false,
}) {
  const { play } = useSound()
  const arenaKey = a && b ? `${a.slug}-${b.slug}` : 'empty'
  // El empate también cuenta desde el voto optimista (votedFor con el
  // sentinel que no es ninguna de las dos cartas): sin esto, mientras el
  // POST resuelve ambas cartas pasarían por el estado de perdedor
  // (grayscale + shake) y al confirmar saltarían a doradas.
  const tieResolved = Boolean(voteResult?.empate)
  const tiePending = Boolean(
    votedFor && votedFor !== a?.slug && votedFor !== b?.slug,
  )
  const isTie = tieResolved || tiePending
  const leftVoteResult = tieResolved
    ? { ...voteResult, delta: 0.5, votosGanador: voteResult?.votosGanador }
    : voteResult?.ganadorSlug === a?.slug
      ? voteResult
      : null
  const rightVoteResult = tieResolved
    ? { ...voteResult, delta: 0.5, votosGanador: voteResult?.votosPerdedor, votosPerdedor: voteResult?.votosGanador }
    : voteResult?.ganadorSlug === b?.slug
      ? voteResult
      : null

  // Identidades para DuelEntrance, memoizadas: una identidad nueva por
  // render dispararía el espejo en seco del coreógrafo en cada ciclo.
  const oculto = Boolean(blindMode && !blindReveal)
  const figuraA = useMemo(() => toFigura(a, 'A', oculto), [a, oculto])
  const figuraB = useMemo(() => toFigura(b, 'B', oculto), [b, oculto])

  const renderCard = (side, fig) =>
    side === 'left' ? (
      <VoteCard
        personaje={fig.personaje}
        ownsEspecial={ownsEspecialA}
        onClick={handleVoteLeft}
        disabled={controlsDisabled}
        isVoted={votedFor === a.slug}
        isLoser={Boolean(votedFor && votedFor !== a.slug && !isTie)}
        isTie={isTie}
        showResult={Boolean(votedFor)}
        side="left"
        anonymousLimited={votoInvitadoActivo}
        blindMode={blindMode}
        blindReveal={blindReveal}
        voteResult={leftVoteResult}
        captionHidden
      />
    ) : (
      <VoteCard
        personaje={fig.personaje}
        ownsEspecial={ownsEspecialB}
        onClick={handleVoteRight}
        disabled={controlsDisabled}
        isVoted={votedFor === b.slug}
        isLoser={Boolean(votedFor && votedFor !== b.slug && !isTie)}
        isTie={isTie}
        showResult={Boolean(votedFor)}
        side="right"
        anonymousLimited={votoInvitadoActivo}
        blindMode={blindMode}
        blindReveal={blindReveal}
        voteResult={rightVoteResult}
        captionHidden
      />
    )

  return (
    <div className="relative">
      <DuelEntrance
        pairKey={arenaKey}
        a={figuraA}
        b={figuraB}
        renderCard={renderCard}
        fastMode={fastMode}
        onPhase={(fase) => {
          // El VS de tinta nace con un whoosh; rápido/calma no emiten fases.
          if (fase === 'vs') play('playWhoosh')
        }}
        vsBadge={<VsBadge votedFor={votedFor} isTie={isTie} caption={false} />}
        vsBadgeCompact={<VsBadge votedFor={votedFor} isTie={isTie} compact caption={false} />}
        nameExtra={(side, fig) =>
          votedFor ? (
            <AppLink
              to={`/personajes/${fig.personaje.slug}`}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
            >
              Ver ficha
              <ArrowRight className="h-3 w-3" />
            </AppLink>
          ) : null
        }
        tieSlot={
          canTie && !votedFor ? (
            <button
              type="button"
              onClick={handleTieVote}
              disabled={controlsDisabled}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-3 py-2 text-[11px] font-black text-gold transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Scale className="h-3.5 w-3.5" />
              No puedo decidir
            </button>
          ) : null
        }
      />
      {canTie && !votedFor && (
        <button
          type="button"
          onClick={handleTieVote}
          disabled={controlsDisabled}
          className="mt-3 inline-flex w-full min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-3 py-2 text-[12px] font-black text-gold transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
        >
          <Scale className="h-3.5 w-3.5" />
          No puedo decidir
        </button>
      )}
    </div>
  )
})

export default VoteArena
