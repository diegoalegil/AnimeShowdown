import { useEffect, useId, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { Check, ChevronDown } from 'lucide-react'

/**
 * BrandSelect — dropdown de marca que reemplaza al <select> nativo
 * (`.as-control`). Panel "glass" (backdrop-blur + borde oro + sombra aura) con
 * búsqueda type-to-filter en listas largas.
 *
 * <p>Accesible vía cmdk: el panel es un combobox (input enfocado al abrir,
 * flechas para navegar, Enter selecciona, teclear filtra). El trigger es un
 * <button> con aria-haspopup="listbox" / aria-expanded. En listas cortas el
 * input va oculto (sr-only) pero conserva la navegación por teclado y el
 * type-ahead, sin mostrar caja de búsqueda.
 *
 * @param {string} value                       valor seleccionado
 * @param {(value: string) => void} onChange   recibe el value (no el evento)
 * @param {{ value: string, label: string }[]} options
 * @param {string} [ariaLabel]
 * @param {string} [className]                 clases del wrapper (tamaño/anchura)
 * @param {string} [placeholder]
 * @param {boolean} [searchable]               por defecto: auto (> 8 opciones)
 * @param {boolean} [disabled]
 */
function BrandSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  placeholder = 'Selecciona…',
  searchable,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const listboxId = useId()
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const selected = options.find((o) => o.value === value)
  const canSearch = searchable ?? options.length > 8
  const panelOpen = open && !disabled

  // Cerrar al hacer click fuera o pulsar Escape (devolviendo el foco al trigger).
  useEffect(() => {
    if (!panelOpen) return undefined
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [panelOpen])

  const choose = (next) => {
    if (disabled) return
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="as-control flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-fg-strong transition-colors hover:border-gold/45 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-fg-muted transition-transform duration-200 ${panelOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {panelOpen && (
        <Command
          label={ariaLabel}
          className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-gold/30 bg-bg/90 shadow-aura-lg backdrop-blur-xl [--aura-color:var(--color-gold-aura)]"
        >
          <div className={canSearch ? 'border-b border-border/60 p-2' : 'sr-only'}>
            <Command.Input
              autoFocus
              placeholder="Buscar…"
              className="w-full rounded-md bg-surface/70 px-3 py-2 text-sm text-fg-strong outline-none placeholder:text-fg-muted"
            />
          </div>
          <Command.List id={listboxId} className="scrollbar-hide max-h-72 overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">
              Sin resultados.
            </Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value === '' ? '__all__' : o.value}
                value={o.label}
                onSelect={() => choose(o.value)}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold text-fg-strong aria-selected:bg-accent/15 aria-selected:text-gold"
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {o.value === value && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-gold" />}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      )}
    </div>
  )
}

export default BrandSelect
