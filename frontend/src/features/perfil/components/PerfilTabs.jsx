import { PERFIL_TABS } from '../perfil-tabs'

function PerfilTabs({ activeTab, onChange }) {
  return (
    <div
      role="tablist"
      className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {PERFIL_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            activeTab === t.id
              ? 'bg-accent text-bg'
              : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default PerfilTabs
