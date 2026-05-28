import { useRef } from 'react'
import { PERFIL_TABS } from '../perfil-tabs'

/**
 * Barra de tabs del perfil con ARIA completo:
 *   - role="tablist" en el contenedor.
 *   - role="tab" + aria-selected + aria-controls en cada botón.
 *   - Roving tabindex: solo el tab activo es tabulable (tabindex=0),
 *     el resto tabindex=-1. Las flechas mueven el foco entre tabs.
 *   - El panel asociado debe tener id="perfilpanel-{id}" y role="tabpanel".
 */
function PerfilTabs({ activeTab, onChange }) {
  const tabRefs = useRef([])

  const handleKeyDown = (e, currentIndex) => {
    const count = PERFIL_TABS.length
    let nextIndex

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % count
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + count) % count
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = count - 1
    } else {
      return
    }

    e.preventDefault()
    const nextTab = PERFIL_TABS[nextIndex]
    onChange(nextTab.id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Secciones del perfil"
      className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {PERFIL_TABS.map((t, idx) => {
        const isActive = activeTab === t.id
        return (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[idx] = el }}
            type="button"
            role="tab"
            id={`perfiltab-${t.id}`}
            aria-selected={isActive}
            aria-controls={`perfilpanel-${t.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              isActive
                ? 'bg-accent text-white'
                : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export default PerfilTabs
