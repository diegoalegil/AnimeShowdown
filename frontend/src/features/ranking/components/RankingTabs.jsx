import { useRef } from 'react'
import { RANKING_TABS } from '../ranking-tabs'

function RankingTabs({ activo, onChange }) {
  const tabRefs = useRef([])

  // Roving tabindex + flechas (patrón APG, igual que PerfilTabs): el foco se
  // mueve entre tabs con ←/→/Home/End y la selección sigue al foco.
  const handleKeyDown = (e, idx) => {
    const n = RANKING_TABS.length
    let next
    if (e.key === 'ArrowRight') next = (idx + 1) % n
    else if (e.key === 'ArrowLeft') next = (idx - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    onChange(RANKING_TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="scrollbar-hide scroll-x-affordance scroll-x-fade-mobile -mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Secciones del ranking"
        className="inline-flex w-max gap-1 whitespace-nowrap rounded-lg border border-border bg-surface p-1 sm:flex sm:w-full sm:flex-wrap"
      >
        {RANKING_TABS.map(({ id, label, icon: Icon }, idx) => (
          <button
            key={id}
            ref={(el) => { tabRefs.current[idx] = el }}
            type="button"
            role="tab"
            id={`rankingtab-${id}`}
            aria-selected={activo === id}
            aria-controls="rankingtabpanel"
            tabIndex={activo === id ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            title={
              id === 'elo'
                ? 'Calculado desde los datos del catálogo. Siempre disponible.'
                : id === 'categorias'
                  ? 'Rankings por arquetipo: héroes, villanos, estrategas y más.'
                  : id === 'all'
                    ? 'Top de votos desde que abrió AnimeShowdown.'
                    : id === 'mes'
                      ? 'Top de votos en los últimos 30 días.'
                      : 'Selecciona un anime para ver su ranking interno.'
            }
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition-colors ${
              activo === id
                ? 'bg-accent text-white'
                : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default RankingTabs
