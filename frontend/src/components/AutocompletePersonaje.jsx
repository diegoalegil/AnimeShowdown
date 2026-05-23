import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { normalizar } from '../lib/games'
import PersonajeImg from './PersonajeImg'

/**
 * Combobox de selección de personaje para juegos y formularios.
 *
 * <p>Catálogo cliente-side completo. La dropdown muestra hasta 8 resultados
 * ordenados por coincidencia (startsWith antes que includes).
 *
 * <p>Devuelve el slug en {@code onSelect}; el caller hace el lookup en
 * el catálogo si necesita más datos.
 *
 * @param {Object} props
 * @param {(slug: string) => void} props.onSelect — callback al elegir
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.autoFocus]
 * @param {(personaje) => boolean} [props.filtroExtra] — filtro adicional
 *        para excluir personajes ya intentados, por ejemplo.
 */
function AutocompletePersonaje({
  onSelect,
  placeholder = 'Busca un personaje…',
  disabled = false,
  autoFocus = false,
  filtroExtra,
}) {
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [activo, setActivo] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const deferredQuery = useDeferredValue(query)
  // Reset del cursor cuando cambia la query — patrón "store snapshot"
  // durante el render (no useEffect+setState que React 19 marca como
  // anti-pattern por cascading renders).
  const [queryPrevia, setQueryPrevia] = useState('')
  if (query !== queryPrevia) {
    setQueryPrevia(query)
    setActivo(0)
  }
  const inputRef = useRef(null)
  // el onBlur setTimeout queda colgando si el
  // componente se desmonta antes de 120ms (típico al cerrar modal).
  // Trackeamos en ref y limpiamos en cleanup del unmount.
  const blurTimeoutRef = useRef(null)
  useEffect(() => () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
  }, [])

  const opciones = useMemo(() => {
    const q = normalizar(deferredQuery)
    if (!q) return []
    const base = filtroExtra
      ? catalogoPersonajes.filter(filtroExtra)
      : catalogoPersonajes
    const matches = []
    for (const p of base) {
      const nombreN = normalizar(p.nombre)
      const animeN = normalizar(p.anime)
      const idxNombre = nombreN.indexOf(q)
      const idxAnime = animeN.indexOf(q)
      if (idxNombre === -1 && idxAnime === -1) continue
      // Score: startsWith en nombre > en anime > includes en nombre > includes en anime
      const score =
        (idxNombre === 0 ? 0 : idxNombre === -1 ? 9999 : idxNombre + 1) * 2 +
        (idxAnime === 0 ? 0 : idxAnime === -1 ? 9999 : idxAnime + 1)
      matches.push({ p, score })
      if (matches.length > 50) break // cap antes del sort
    }
    matches.sort((a, b) => a.score - b.score)
    return matches.slice(0, 8).map((m) => m.p)
  }, [catalogoPersonajes, deferredQuery, filtroExtra])

  const elegir = (slug) => {
    if (!slug) return
    onSelect(slug)
    setQuery('')
    setAbierto(false)
    if (inputRef.current) inputRef.current.focus()
  }

  const handleKey = (e) => {
    if (!abierto || opciones.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((a) => Math.min(opciones.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const elegido = opciones[activo]
      if (elegido) elegir(elegido.slug)
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  const listboxId = `${inputId}-list`
  const optionId = (idx) => `${inputId}-option-${idx}`

  return (
    <div className="relative">
      {/*
        Patrón combobox WAI-ARIA 1.2:
        - role="combobox" en el input + aria-haspopup="listbox".
        - aria-activedescendant referencia el <li> activo por id, para
          que SR anuncie la opción navegada con flechas sin mover el
          foco (que sigue en el input).
        - <li> cada uno con id estable y aria-selected en el activo.
      */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5">
        <Search className="h-4 w-4 text-fg-muted" />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
            blurTimeoutRef.current = setTimeout(() => {
              blurTimeoutRef.current = null
              setAbierto(false)
            }, 120)
          }}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={abierto}
          aria-haspopup="listbox"
          aria-activedescendant={
            abierto && opciones.length > 0 ? optionId(activo) : undefined
          }
          className="flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      {abierto && opciones.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl"
        >
          {opciones.map((p, idx) => (
            <li
              key={p.slug}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === activo}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActivo(idx)}
                onMouseDown={(e) => {
                  // mousedown antes que onBlur del input para no cerrar.
                  e.preventDefault()
                  elegir(p.slug)
                }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] ${
                  idx === activo ? 'bg-bg' : 'hover:bg-bg'
                }`}
              >
                <PersonajeImg
                  slug={p.slug}
                  src={p.imagenUrl ?? p.imagen}
                  alt={p.nombre}
                  loading="lazy"
                  sizes="36px"
                  className="h-9 w-7 shrink-0 rounded object-cover object-top"
                />
                <span className="min-w-0 flex-1 truncate font-semibold text-fg-strong">
                  {p.nombre}
                </span>
                <span className="hidden truncate text-[11px] text-fg-muted sm:inline">
                  {p.anime}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AutocompletePersonaje
