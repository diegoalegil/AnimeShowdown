import { useState } from 'react'
import DailyMissionPanel from '../../../components/DailyMissionPanel'
import VotarQuickModes from './VotarQuickModes'

/**
 * MobileExtrasToggle — visible solo en móvil (sm:hidden).
 * Muestra un botón compacto que expande/contrae VotarQuickModes y
 * DailyMissionPanel para que la arena + resultado quepan sin scroll.
 */
function MobileExtrasToggle({
  a,
  b,
  fixedAnime,
  fixedPersonaje,
  exactDuelActive,
  hasFixedAnime,
  blindMode,
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent/40 hover:text-fg-strong"
        aria-expanded={open}
      >
        <span>{open ? 'Ocultar opciones' : 'Más opciones'}</span>
        <span aria-hidden="true" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <VotarQuickModes
            a={a}
            b={b}
            fixedAnime={fixedAnime}
            fixedPersonaje={fixedPersonaje}
            hasFixedDuel={exactDuelActive}
            hasFixedAnime={hasFixedAnime}
            blindMode={blindMode}
          />
          <DailyMissionPanel compact />
        </div>
      )}
    </div>
  )
}

export default MobileExtrasToggle
