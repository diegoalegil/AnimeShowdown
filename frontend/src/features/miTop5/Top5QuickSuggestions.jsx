import { Sparkles } from 'lucide-react'
import PersonajeImg from '../../components/PersonajeImg'

function Top5QuickSuggestions({ slotsVacios, sugerencias, onAdd }) {
  if (slotsVacios <= 0 || sugerencias.length === 0) return null

  return (
    <div className="mb-5 rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold" />
        <p className="text-[13px] font-semibold text-fg-strong">
          Empieza con tu favorito
        </p>
        <span className="text-[11px] text-fg-muted">
          ({slotsVacios} {slotsVacios === 1 ? 'slot libre' : 'slots libres'})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sugerencias.map((personaje) => (
          <button
            key={personaje.slug}
            type="button"
            onClick={() => onAdd(personaje.slug)}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-bg px-2 py-1 text-[12px] font-medium text-fg-strong transition-colors hover:border-accent hover:text-gold"
          >
            <PersonajeImg
              slug={personaje.slug}
              src={personaje.imagenUrl ?? personaje.imagen}
              alt={personaje.nombre}
              loading="lazy"
              className="h-5 w-5 rounded-full object-cover object-top"
            />
            {personaje.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Top5QuickSuggestions
