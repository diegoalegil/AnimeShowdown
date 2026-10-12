import { useId, useRef, useState } from 'react'

const ICONO = (
  <svg className="campo-icono" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

/**
 * Campo de texto con sugerencias (patrón combobox de WAI-ARIA): se escribe,
 * aparece una lista, se recorre con ↑ ↓, se elige con Intro o con el ratón
 * y se cierra con Escape. Es el cuerpo de BuscadorPersonajes y
 * SelectorSeries; los juegos no suelen usarlo directamente.
 *
 * Props:
 * - `buscar(consulta)`: devuelve los elementos que coinciden (ya ordenados).
 * - `clave(item)`, `principal(item)`, `secundario(item)`: id, texto principal
 *   y texto secundario de cada sugerencia; `miniatura(item)` devuelve
 *   { src, srcSet, alt } opcional.
 * - `onElegir(item)`: al elegir; el campo se vacía salvo con `conservar`.
 * - `etiqueta`: para los lectores de pantalla; `placeholder`: texto de ayuda.
 * - `maximo`: sugerencias que se muestran (8); `desactivado`; `autoEnfocar`.
 * - `vacio`: texto cuando nada coincide.
 */
export function Autocompletar({
  buscar,
  clave,
  principal,
  secundario,
  miniatura,
  onElegir,
  etiqueta,
  placeholder = 'Escribe para buscar',
  maximo = 8,
  desactivado = false,
  autoEnfocar = false,
  conservar = false,
  vacio = 'Nada coincide con esa búsqueda.',
}) {
  const id = useId()
  const idLista = `${id}-lista`
  const campo = useRef(null)
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(-1)

  const consulta = texto.trim()
  const resultados = consulta ? buscar(consulta).slice(0, maximo) : []
  const desplegado = abierto && consulta.length > 0
  const indiceActivo = activo < resultados.length ? activo : -1

  function elegir(item) {
    onElegir(item)
    setTexto(conservar ? principal(item) : '')
    setAbierto(false)
    setActivo(-1)
    campo.current?.focus()
  }

  function alTeclear(evento) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (!resultados.length) return
      const paso = evento.key === 'ArrowDown' ? 1 : -1
      // Sin ninguna resaltada, ↓ va a la primera y ↑ a la última.
      const desde = indiceActivo >= 0 ? indiceActivo : paso > 0 ? -1 : 0
      setAbierto(true)
      setActivo((desde + paso + resultados.length) % resultados.length)
    } else if (evento.key === 'Enter') {
      if (!desplegado || !resultados.length) return
      evento.preventDefault()
      elegir(resultados[indiceActivo >= 0 ? indiceActivo : 0])
    } else if (evento.key === 'Escape') {
      if (desplegado) {
        evento.preventDefault()
        setAbierto(false)
      } else if (texto) {
        evento.preventDefault()
        setTexto('')
      }
    } else if (evento.key === 'Home' && desplegado && resultados.length) {
      setActivo(0)
    } else if (evento.key === 'End' && desplegado && resultados.length) {
      setActivo(resultados.length - 1)
    }
  }

  return (
    <div className="autocompletar">
      <label className="campo campo--buscar autocompletar-campo">
        <span className="campo-etiqueta">{etiqueta}</span>
        {ICONO}
        <input
          ref={campo}
          type="text"
          role="combobox"
          value={texto}
          placeholder={placeholder}
          disabled={desactivado}
          autoFocus={autoEnfocar}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="go"
          maxLength={80}
          aria-expanded={desplegado}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={desplegado && indiceActivo >= 0 ? `${idLista}-${indiceActivo}` : undefined}
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
            setActivo(-1)
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onKeyDown={alTeclear}
        />
      </label>

      <ul id={idLista} role="listbox" aria-label={etiqueta} className="autocompletar-lista" hidden={!desplegado || !resultados.length}>
        {resultados.map((item, i) => {
          const mini = miniatura?.(item)
          return (
            <li
              key={clave(item)}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === indiceActivo}
              className="autocompletar-opcion"
              // mousedown, no click: el campo no pierde el foco antes de elegir.
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(item)
              }}
              onMouseMove={() => {
                if (i !== indiceActivo) setActivo(i)
              }}
            >
              {mini && <img className="autocompletar-miniatura" src={mini.src} srcSet={mini.srcSet} sizes="40px" alt="" loading="lazy" decoding="async" />}
              <span className="autocompletar-principal">{principal(item)}</span>
              {secundario && <span className="autocompletar-secundario">{secundario(item)}</span>}
            </li>
          )
        })}
      </ul>
      {desplegado && !resultados.length && <p className="autocompletar-vacio">{vacio}</p>}

      <p className="solo-lectores" aria-live="polite" aria-atomic="true">
        {desplegado && (resultados.length ? `${resultados.length} sugerencias. Usa las flechas y pulsa Intro.` : vacio)}
      </p>
    </div>
  )
}
