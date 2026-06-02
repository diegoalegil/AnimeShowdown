import { Plus, X } from 'lucide-react'
import PersonajeImg from '../../components/PersonajeImg'

function Top5Slot({ slug, personaje, index, onQuitar }) {
  if (!slug) {
    return (
      <div className="flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-bg/30 text-fg-muted sm:gap-2 sm:rounded-xl">
        <Plus className="h-4 w-4 sm:h-6 sm:w-6" />
        <span className="text-[10px] font-semibold sm:text-[11px]">
          #{index + 1}
        </span>
      </div>
    )
  }
  return (
    <div className="group relative aspect-[2/3] overflow-hidden rounded-lg border border-border sm:rounded-xl">
      <PersonajeImg
        slug={slug}
        src={personaje?.imagenUrl ?? personaje?.imagen}
        alt={personaje?.nombre ?? slug}
        className="h-full w-full object-cover object-top"
      />
      <span className="absolute left-1 top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-accent px-1 text-[10px] font-extrabold text-bg sm:left-1.5 sm:top-1.5 sm:h-6 sm:min-w-[24px] sm:text-[11px]">
        #{index + 1}
      </span>
      <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 sm:block">
        <p className="line-clamp-1 text-[12px] font-bold text-fg-strong">
          {personaje?.nombre ?? slug}
        </p>
        <p className="line-clamp-1 text-[10px] text-fg-muted">
          {personaje?.anime}
        </p>
      </div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${personaje?.nombre ?? 'personaje'} del top`}
        className="group/remove absolute right-0 top-0 z-10 inline-flex h-11 w-11 items-start justify-end p-1 text-fg-muted transition-opacity hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg/80 backdrop-blur-md">
          <X className="h-3 w-3" />
        </span>
      </button>
    </div>
  )
}

export default Top5Slot
