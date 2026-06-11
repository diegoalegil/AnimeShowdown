import { Link } from 'react-router-dom'
import { ArrowRight, ImageDown, Swords } from 'lucide-react'
import { formatPersonalVoteImpact, formatVoteScore } from '../vote-format'
import HeadToHeadBar from './HeadToHeadBar'

/**
 * Panel de resultado de VICTORIA: región live para lectores de pantalla con
 * los totales del match, el impacto en el ranking personal y las CTAs de
 * compartir / mi-ranking.
 */
function VoteResultPanel({
  votedPersonaje,
  losingPersonaje,
  voteResult,
  personalVoteImpact,
  onShareVote,
  onShareResultImage,
  generandoCard = false,
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1"
      >
        <p className="text-sm font-black text-fg-strong">
          {votedPersonaje.nombre} ganó tu duelo.
        </p>
        <p className="text-[12px] text-fg-muted">
          {voteResult?.votosGanador != null
            ? `${formatVoteScore(voteResult.votosGanador)} votos para ${votedPersonaje.nombre}${losingPersonaje ? ` · rival: ${losingPersonaje.nombre}` : ''}`
            : 'Voto registrado en modo casual. Sigue para completar tu misión diaria.'}
        </p>
        {/* Barra split cabeza-a-cabeza — solo cuando el backend devuelve ambos totales */}
        {voteResult?.votosGanador != null && voteResult?.votosPerdedor != null && losingPersonaje && (
          <HeadToHeadBar
            ganadorNombre={votedPersonaje.nombre}
            perdedorNombre={losingPersonaje.nombre}
            votosGanador={voteResult.votosGanador}
            votosPerdedor={voteResult.votosPerdedor}
          />
        )}
        {personalVoteImpact?.slug === votedPersonaje.slug && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-2.5 py-1 text-[11px] font-black text-gold">
            {formatPersonalVoteImpact(personalVoteImpact)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onShareVote}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-4 py-2 text-[13px] font-black text-white transition-colors hover:bg-accent-hover"
        >
          <Swords className="h-3.5 w-3.5" />
          Reta a un amigo
        </button>
        {/* Card 1080×1080 del duelo pintada en canvas (duel-share-card).
            Solo con rival conocido: sin él no hay cara derecha que pintar. */}
        {onShareResultImage && losingPersonaje && (
          <button
            type="button"
            onClick={onShareResultImage}
            disabled={generandoCard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-gold/55 hover:text-gold disabled:cursor-wait disabled:opacity-60"
          >
            <ImageDown className="h-3.5 w-3.5" />
            {generandoCard ? 'Generando…' : 'Card del duelo'}
          </button>
        )}
        <Link
          to="/mi-ranking"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
        >
          Mi ranking
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

export default VoteResultPanel
