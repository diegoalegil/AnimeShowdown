import { useEffect } from 'react'

/**
 * LibrarianLantern — el buscador como "linterna de la bibliotecaria". Al
 * teclear, el padre atenúa los tomos que no casan y enciende un barrido de
 * farol (lo dispara `onSweep`, debounced 250 ms). El conteo de resultados se
 * anuncia por aria-live ("7 universos"). Es un input controlado por el padre
 * (query) que NO desmonta tomos: solo conmuta el filtro.
 *
 * @param {Object} props
 * @param {string} props.query         Texto actual del buscador (controlado).
 * @param {(q:string)=>void} props.onQuery  Cambia la query (cada keystroke).
 * @param {()=>void} props.onSweep     Dispara un barrido (debounced 250 ms).
 * @param {number} props.visibles      Nº de universos que casan (para aria-live).
 * @param {number} props.total         Nº total de universos.
 */
export default function LibrarianLantern({
  query,
  onQuery,
  onSweep,
  visibles,
  total,
}) {
  // Debounce 250 ms: el barrido (caro visualmente) corre UNA vez por ráfaga de
  // tecleo, no por carácter. El timer dispara onSweep cuando la query "asentada"
  // no está vacía. Limpiamos en cada keystroke → solo la última pulsación de la
  // ráfaga sobrevive. Sin refs en render (react-hooks/refs) ni setState síncrono
  // en cuerpo de effect: el onSweep va dentro del setTimeout.
  useEffect(() => {
    if (!query.trim()) return undefined
    const id = setTimeout(() => onSweep?.(), 250)
    return () => clearTimeout(id)
  }, [query, onSweep])

  const count = `${visibles} ${visibles === 1 ? 'universo' : 'universos'}`

  return (
    <div className="lib-lantern">
      <label className="lib-lantern__field">
        <svg
          className="lib-lantern__icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <circle
            cx="11"
            cy="11"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M16 16l4.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          className="lib-lantern__input"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar universo, personaje o alias…"
          aria-label="Buscar universo, personaje o alias en la biblioteca"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            className="lib-lantern__clear"
            onClick={() => onQuery('')}
            aria-label="Limpiar búsqueda"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </label>
      <output className="lib-lantern__count" aria-live="polite">
        {query.trim() ? count : `${total} universos`}
      </output>
    </div>
  )
}
