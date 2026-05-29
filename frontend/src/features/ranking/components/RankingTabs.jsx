import { RANKING_TABS } from '../ranking-tabs'

function RankingTabs({ activo, onChange }) {
  return (
    <div className="scrollbar-hide scroll-x-affordance scroll-x-fade-mobile -mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Secciones del ranking"
        className="inline-flex w-max gap-1 whitespace-nowrap rounded-lg border border-border bg-surface p-1 sm:flex sm:w-full sm:flex-wrap"
      >
        {RANKING_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activo === id}
            onClick={() => onChange(id)}
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
