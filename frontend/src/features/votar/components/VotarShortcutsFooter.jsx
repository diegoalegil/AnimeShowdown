import { Link } from 'react-router-dom'

/**
 * Pie de la arena: atajos de teclado (solo desktop) y, cuando no hay
 * torneos en juego, el link de escape a /torneos.
 */
function VotarShortcutsFooter({ votedFor, sinMatchesAbiertos }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="hidden text-[11px] text-fg-muted sm:block">
        Atajos:{' '}
        <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
          ←
        </kbd>{' '}
        izquierda ·{' '}
        <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
          →
        </kbd>{' '}
        derecha ·{' '}
        <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
          S
        </kbd>{' '}
        saltar
        {votedFor && (
          <>
            {' '}·{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              Espacio
            </kbd>{' '}
            siguiente
          </>
        )}
      </p>
      {sinMatchesAbiertos && (
        <Link
          to="/torneos"
          className="text-[12px] text-gold hover:underline"
        >
          Ver torneos disponibles →
        </Link>
      )}
    </div>
  )
}

export default VotarShortcutsFooter
