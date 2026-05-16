import { useId, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { personajes, imagenPersonaje } from '../data/personajes'
import { normalizar } from '../lib/games'

/**
 * Combobox de selección de personaje (Bloque 14).
 *
 * <p>Catálogo cliente-side de 642+ personajes. Filtro local sin debounce
 * — el cómputo es O(n) sobre un array memoizado y corre en <5ms en
 * mid-range. La dropdown muestra hasta 8 resultados ordenados por
 * coincidencia (startsWith antes que includes).
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
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [activo, setActivo] = useState(0)
  const [abierto, setAbierto] = useState(false)
  // Reset del cursor cuando cambia la query — patrón "store snapshot"
  // durante el render (no useEffect+setState que React 19 marca como
  // anti-pattern por cascading renders).
  const [queryPrevia, setQueryPrevia] = useState('')
  if (query !== queryPrevia) {
    setQueryPrevia(query)
    setActivo(0)
  }
  const inputRef = useRef(null)

  const opciones = useMemo(() => {
    const q = normalizar(query)
    if (!q) return []
    const base = filtroExtra ? personajes.filter(filtroExtra) : personajes
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
  }, [query, filtroExtra])

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

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5">
        <Search className="h-4 w-4 text-fg-muted" />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${inputId}-list`}
          aria-expanded={abierto}
          className="flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      {abierto && opciones.length > 0 && (
        <ul
          id={`${inputId}-list`}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl"
        >
          {opciones.map((p, idx) => (
            <li key={p.slug} role="option" aria-selected={idx === activo}>
              <button
                type="button"
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
                <img
                  src={imagenPersonaje(p.slug)}
                  alt=""
                  loading="lazy"
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
