import AutocompletePersonaje from '../../components/AutocompletePersonaje'

function Top5SearchPanel({ onSelect, filtroExtra }) {
  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="mb-3 text-[13px] font-semibold text-fg-strong">
        O busca cualquier personaje del catálogo
      </p>
      <AutocompletePersonaje
        onSelect={onSelect}
        placeholder="Busca y selecciona…"
        filtroExtra={filtroExtra}
      />
    </div>
  )
}

export default Top5SearchPanel
