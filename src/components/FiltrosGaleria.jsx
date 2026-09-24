import { catalogo } from '../lib/catalog.js'
import { ESPECIALES, hayFiltros } from '../lib/filtros.js'

/**
 * Barra de filtros de la galería: búsqueda y serie. Controlada desde la URL
 * (la página le pasa los filtros y recibe los cambios); se queda fija arriba
 * mientras se recorre la rejilla.
 */
export function FiltrosGaleria({ filtros, onCambiar, total, buscador, selectorSerie }) {
  const activos = hayFiltros(filtros)

  return (
    <search id="cartas" className="filtros" aria-label="Filtrar cartas">
      <div className="wrap filtros-fila">
        <label className="campo campo--buscar">
          <span className="campo-etiqueta">Buscar</span>
          <input
            ref={buscador}
            type="search"
            value={filtros.q}
            onChange={(e) => onCambiar({ q: e.target.value })}
            placeholder="Nombre o serie"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            enterKeyHint="search"
            maxLength={80}
          />
          <kbd className="campo-atajo" aria-hidden="true">
            /
          </kbd>
        </label>

        <label className="campo campo--serie">
          <span className="campo-etiqueta">Serie</span>
          <select ref={selectorSerie} value={filtros.serie} onChange={(e) => onCambiar({ serie: e.target.value })}>
            <option value="">Todas las series</option>
            <option value={ESPECIALES}>Especiales · {catalogo.especiales.length}</option>
            <optgroup label="Series">
              {catalogo.animes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titulo} · {a.count}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <p className="filtros-cuenta" aria-live="polite">
          <span>
            <span className="cifra">{total}</span>
            <span className="filtros-palabra"> {total === 1 ? 'carta' : 'cartas'}</span>
          </span>
          {activos && (
            <button type="button" className="filtros-quitar" onClick={() => onCambiar({ q: '', serie: '' })}>
              Quitar<span className="filtros-palabra"> filtros</span>
            </button>
          )}
        </p>
      </div>
    </search>
  )
}
