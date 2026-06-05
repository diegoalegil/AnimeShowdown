import { useState } from 'react'

import { INTENCIONES } from '../../../data/voto-intenciones.js'

// Tono → clases estáticas (JIT-safe; nada de `bg-${tono}` dinámico). Reusa los
// tokens arc-* del design system (los mismos que /ranking) para que cada
// intención lleve su color propio — identidad data-driven, no pill genérico
// (REGLA #7).
const TONO_PILL = {
  orange: 'text-arc-rival border-arc-rival/40 bg-arc-rival/10 hover:bg-arc-rival/20',
  violet: 'text-arc-husbando border-arc-husbando/40 bg-arc-husbando/10 hover:bg-arc-husbando/20',
  amber: 'text-arc-protagonist border-arc-protagonist/40 bg-arc-protagonist/10 hover:bg-arc-protagonist/20',
  sky: 'text-arc-hero border-arc-hero/40 bg-arc-hero/10 hover:bg-arc-hero/20',
  rose: 'text-arc-villain border-arc-villain/40 bg-arc-villain/10 hover:bg-arc-villain/20',
  pink: 'text-arc-waifu border-arc-waifu/40 bg-arc-waifu/10 hover:bg-arc-waifu/20',
}

/**
 * Selector de intención de voto (feature #15): por qué votaste.
 *
 * Fila de pills de 1 tap, OPCIONAL y skippable, que aparece en el panel de
 * resultado tras votar (no antes → no añade fricción al arena instantáneo).
 * Presentacional: gestiona en UI qué pill quedó elegida (set-once) y notifica
 * al padre vía {@code onSelect(id)}; el padre dispara el PATCH set-once contra
 * el backend. Una vez elegida, no se puede cambiar (los votos son inmutables).
 */
export default function IntencionSelector({ onSelect, disabled = false }) {
  const [chosen, setChosen] = useState(null)
  const bloqueado = disabled || chosen != null

  function elegir(id) {
    if (bloqueado) return
    setChosen(id)
    onSelect?.(id)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt/40 px-4 py-3">
      <p className="text-[12px] font-black text-fg-muted">
        {chosen ? '¡Gracias! Tu motivo quedó guardado' : '¿Por qué votaste? (opcional)'}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Intención de voto">
        {INTENCIONES.map((intencion) => {
          const activo = chosen === intencion.id
          const tonoClase = TONO_PILL[intencion.tono] ?? TONO_PILL.sky
          return (
            <button
              key={intencion.id}
              type="button"
              disabled={bloqueado && !activo}
              aria-pressed={activo}
              onClick={() => elegir(intencion.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-40 ${tonoClase} ${
                activo ? 'ring-2 ring-current' : ''
              }`}
            >
              <span aria-hidden="true">{intencion.emoji}</span>
              {intencion.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
