import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { personajes } from '../lib/personajes-core'
import { normalizar } from '../lib/games'

// Lista de animes únicos del catálogo + count para ranking en autocomplete.
const ANIMES = (() => {
  const counts = {}
  for (const p of personajes) {
    counts[p.anime] = (counts[p.anime] || 0) + 1
  }
  return Object.entries(counts)
      .map(([anime, n]) => ({ anime, n }))
      .sort((a, b) => b.n - a.n)
})()

/**
 * Combobox de selección de anime para juegos y formularios.
 *
 * <p>Devuelve el nombre exacto del anime en {@code onSelect} para
 * comparar con {@code personaje.anime}. Igual UX que
 * {@code AutocompletePersonaje} pero sobre el set de animes únicos.
 */
function AutocompleteAnime({
  onSelect,
  placeholder = 'Busca un anime…',
  disabled = false,
  autoFocus = false,
  filtroExtra,
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [activo, setActivo] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const deferredQuery = useDeferredValue(query)
  const [queryPrevia, setQueryPrevia] = useState('')
  if (query !== queryPrevia) {
    setQueryPrevia(query)
    setActivo(0)
  }
  const inputRef = useRef(null)
  // Ajuste (2026-05-17): cleanup del onBlur setTimeout para evitar
  // setState en componente desmontado tras navegación rápida (mismo
  // patrón que AutocompletePersonaje).
  const blurTimeoutRef = useRef(null)
  useEffect(() => () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
  }, [])

  const opciones = useMemo(() => {
    const q = normalizar(deferredQuery)
    if (!q) return []
    const base = filtroExtra ? ANIMES.filter((a) => filtroExtra(a.anime)) : ANIMES
    const matches = []
    for (const a of base) {
      const animeN = normalizar(a.anime)
      const idx = animeN.indexOf(q)
      if (idx === -1) continue
      const score = (idx === 0 ? 0 : idx + 1) - a.n * 0.001
      matches.push({ anime: a.anime, n: a.n, score })
    }
    matches.sort((x, y) => x.score - y.score)
    return matches.slice(0, 8)
  }, [deferredQuery, filtroExtra])

  const elegir = (anime) => {
    if (!anime) return
    onSelect(anime)
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
      if (elegido) elegir(elegido.anime)
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  const listboxId = `${inputId}-list`
  const optionId = (idx) => `${inputId}-option-${idx}`

  return (
    <div className="relative">
      {/*
        mismo patrón combobox WAI-ARIA 1.2 que
        AutocompletePersonaje. role='combobox' + aria-haspopup='listbox'
        + aria-activedescendant para que SR anuncie la opción navegada
        sin mover el foco del input.
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
          {opciones.map((o, idx) => (
            <li
              key={o.anime}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === activo}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActivo(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(o.anime)
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] ${
                  idx === activo ? 'bg-bg' : 'hover:bg-bg'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-fg-strong">
                  {o.anime}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg-muted">
                  {o.n}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AutocompleteAnime
