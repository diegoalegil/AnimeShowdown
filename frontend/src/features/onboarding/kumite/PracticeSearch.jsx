import { useEffect, useRef, useState } from 'react'

/**
 * PracticeSearch — la paleta simulada del ejercicio 3 (LA BÚSQUEDA).
 *
 * <p>El alumno abre el buscador (⌘K real interceptado dentro del kumite, o el
 * botón) y escribe ≥2 letras del personaje objetivo; al aparecer y elegirlo,
 * onGesto('busqueda') avisa al padre. NUNCA llama a la red: busca SOLO contra el
 * personaje de práctica que pasa el padre (sin inventar personajes). El
 * placeholder guía con su nombre — es un entrenamiento, no un acertijo.
 *
 * <p>⌘K se intercepta a nivel window SOLO mientras este ejercicio está montado
 * (el padre lo monta solo en el paso 3), con preventDefault para que no abra la
 * paleta real de la app. Teclado completo; el panel es role=dialog.
 *
 * @param {object} props
 * @param {{slug:string,nombre:string,anime?:string}} props.objetivo  Personaje a encontrar.
 * @param {(id:'busqueda')=>void} props.onGesto  Notifica la superación.
 */
function PracticeSearch({ objetivo, onGesto }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  // ⌘K / Ctrl-K abre la paleta simulada (solo mientras este paso está montado).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        // Captura + stop: durante este paso ganamos al listener global de ⌘K
        // (CommandPalette) para que NO se abran las dos paletas a la vez.
        e.stopImmediatePropagation()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Foco al input al abrir (rAF, no síncrono en el cuerpo del effect).
  useEffect(() => {
    if (!open) return undefined
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const query = q.trim().toLowerCase()
  const match = query.length >= 2 && objetivo.nombre.toLowerCase().includes(query)

  const elegir = () => {
    onGesto?.('busqueda')
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="kumite-search">
        <button type="button" className="kumite-search__abrir" onClick={() => setOpen(true)}>
          <kbd className="kumite-search__kbd" aria-hidden="true">⌘K</kbd>
          Abrir el buscador
        </button>
      </div>
    )
  }

  return (
    <div className="kumite-search">
      <div className="kumite-search__panel" role="search" aria-label="Buscador de práctica">
        <input
          ref={inputRef}
          type="text"
          className="kumite-search__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Escribe 2 letras de ${objetivo.nombre}…`}
          aria-label={`Buscar personaje. Escribe al menos dos letras de ${objetivo.nombre}`}
          autoComplete="off"
        />
        <ul className="kumite-search__res">
          {match ? (
            <li>
              <button type="button" className="kumite-search__hit" onClick={elegir}>
                <span className="kumite-search__hit-nombre">{objetivo.nombre}</span>
                {objetivo.anime ? <span className="kumite-search__hit-anime">{objetivo.anime}</span> : null}
              </button>
            </li>
          ) : (
            <li className="kumite-search__vacio" aria-live="polite">
              {query.length >= 2 ? 'Sin coincidencias — prueba otras letras.' : 'Escribe al menos 2 letras.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default PracticeSearch
