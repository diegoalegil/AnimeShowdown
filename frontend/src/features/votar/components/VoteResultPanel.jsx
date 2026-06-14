import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ImageDown, Swords } from 'lucide-react'
import { formatPersonalVoteImpact, formatVoteScore } from '../vote-format'
import VoteVerdict from './VoteVerdict'

const NARROW_QUERY = '(max-width: 639px)'
const subscribeNarrow = (cb) => {
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const readNarrow = () => window.matchMedia(NARROW_QUERY).matches

/**
 * Panel de resultado de VICTORIA: región live para lectores de pantalla con
 * los totales del match, el impacto en el ranking personal y las CTAs de
 * compartir / mi-ranking. El split cabeza-a-cabeza es la balanza de tinta
 * (VoteVerdict): las CTAs se sueltan al asentarse el veredicto (~600ms)
 * para no competir con la coreografía.
 */
function VoteResultPanel({
  votedPersonaje,
  losingPersonaje,
  voteResult,
  personalVoteImpact,
  onShareVote,
  onShareResultImage,
}) {
  const vertical = useSyncExternalStore(subscribeNarrow, readNarrow)
  const conVeredicto =
    voteResult?.votosGanador != null && voteResult?.votosPerdedor != null && losingPersonaje
  // Sin veredicto (modo casual sin totales) las CTAs no esperan a nadie.
  const [settled, setSettled] = useState(false)
  const ctasListas = settled || !conVeredicto
  const totalVotos = conVeredicto
    ? voteResult.votosGanador + voteResult.votosPerdedor
    : null
  // El redondeo de la casa (HeadToHeadBar): ganador redondeado, resto al rival.
  const pctGanador = conVeredicto ? Math.round((voteResult.votosGanador / totalVotos) * 100) : 0

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
        {/* La balanza de tinta — solo cuando el backend devuelve ambos totales.
            Remontada por key en cada duelo (la pieza es one-shot). */}
        {conVeredicto && (
          <div className="mt-2">
            <VoteVerdict
              key={`${votedPersonaje.slug}-${voteResult.votosGanador}-${voteResult.votosPerdedor}`}
              ladoA={{ nombre: votedPersonaje.nombre, pct: pctGanador }}
              ladoB={{ nombre: losingPersonaje.nombre, pct: 100 - pctGanador }}
              miLado="A"
              totalVotos={totalVotos}
              primerVoto={totalVotos === 1}
              vertical={vertical}
              onSettled={() => setSettled(true)}
            />
          </div>
        )}
        {personalVoteImpact?.slug === votedPersonaje.slug && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-2.5 py-1 text-[11px] font-black text-gold">
            {formatPersonalVoteImpact(personalVoteImpact)}
          </p>
        )}
      </div>
      <div
        className={`flex flex-wrap justify-center gap-2 transition-opacity duration-300 ${
          ctasListas ? 'opacity-100' : 'pointer-events-none opacity-40'
        }`}
      >
        <button
          type="button"
          onClick={onShareVote}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-4 py-2 text-[13px] font-black text-white transition-colors hover:bg-accent-hover"
        >
          <Swords className="h-3.5 w-3.5" />
          Reta a un amigo
        </button>
        {/* Card 1080×1080 del duelo pintada en canvas (duel-share-card).
            Solo con rival conocido: sin él no hay cara derecha que pintar.
            Abre la hoja de impresión (PressSheet), que pinta y comparte. */}
        {onShareResultImage && losingPersonaje && (
          <button
            type="button"
            onClick={onShareResultImage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-gold/55 hover:text-gold"
          >
            <ImageDown className="h-3.5 w-3.5" />
            Card del duelo
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
