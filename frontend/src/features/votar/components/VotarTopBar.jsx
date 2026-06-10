import { ArrowRight, EyeOff, SkipForward, Swords, Zap } from 'lucide-react'

/**
 * Top bar de la arena: badge de estado + "Reta a un amigo" + toggles de
 * modo rápido / voto a ciegas + saltar duelo. En móvil las acciones son
 * icon-first (texto sr-only hasta el breakpoint sm).
 */
function VotarTopBar({
  arenaStatusLabel,
  showChallenge,
  onChallenge,
  fastMode,
  onToggleFastMode,
  blindMode,
  onToggleBlindMode,
  onNext,
  controlsDisabled,
  votedFor,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold text-fg-muted sm:text-[11px]">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        {arenaStatusLabel}
      </span>

      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        {showChallenge && (
          <button
            type="button"
            onClick={onChallenge}
            title="Comparte este duelo para retar a un amigo a votarlo"
            className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-0 py-2 text-[12px] font-semibold text-gold transition-all hover:border-accent hover:bg-accent/15 sm:w-auto sm:px-3.5"
          >
            <Swords className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">Reta a un amigo</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleFastMode}
          aria-pressed={fastMode}
          title={fastMode ? 'Auto-siguiente activo · clic para desactivar' : 'Auto-siguiente desactivado · clic para activar'}
          className={`inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-0 py-2 text-[12px] font-semibold transition-all sm:w-auto sm:px-3.5 ${
            fastMode
              ? 'border-medal-gold/60 bg-medal-gold/10 text-medal-gold'
              : 'border-border bg-surface text-fg-muted hover:border-medal-gold/40 hover:text-medal-gold'
          }`}
        >
          <Zap className={`h-3.5 w-3.5 ${fastMode ? 'fill-medal-gold' : ''}`} />
          <span className="sr-only sm:not-sr-only">Modo rápido</span>
        </button>
        <button
          type="button"
          onClick={onToggleBlindMode}
          aria-pressed={blindMode}
          title={blindMode ? 'Voto a ciegas activo · clic para desactivar' : 'Voto a ciegas desactivado · clic para activar'}
          className={`inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-0 py-2 text-[12px] font-semibold transition-all sm:w-auto sm:px-3.5 ${
            blindMode
              ? 'border-accent/60 bg-accent-soft text-gold'
              : 'border-border bg-surface text-fg-muted hover:border-accent/40 hover:text-gold'
          }`}
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">Voto a ciegas</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={controlsDisabled}
          className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-0 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-gold disabled:opacity-50 sm:w-auto sm:px-3.5"
        >
          <SkipForward className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">
            {votedFor ? 'Siguiente duelo' : 'Saltar duelo'}
          </span>
          <ArrowRight className="hidden h-3 w-3 sm:block" />
        </button>
      </div>
    </div>
  )
}

export default VotarTopBar
