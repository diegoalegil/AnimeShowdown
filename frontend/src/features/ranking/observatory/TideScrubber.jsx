import { memo } from 'react'
import './observatory.css'

/**
 * Etiqueta de un día del escrutador: el último índice es «hoy», los anteriores
 * cuentan hacia atrás en días.
 * @param {number} indice
 * @param {number} total
 * @returns {string}
 */
function etiquetaDia(indice, total) {
  const atras = total - 1 - indice
  return atras === 0 ? 'hoy' : `-${atras} d`
}

/**
 * TideScrubber — el «escrutador de mareas»: un slider temporal sobre los últimos
 * días del ranking. Es CONTROLADO (el observatorio dueño del día recalcula las
 * posiciones y las estrellas derivan); este componente solo presenta el control,
 * las marcas por día y un resumen por aria-live. Si no hay serie temporal, se
 * deshabilita con una nota honesta (estado del spec). Cero datos inventados.
 *
 * @param {Object} props
 * @param {number} props.dias                número de días de la serie
 * @param {number} props.valor               día activo (0..dias-1; dias-1 = hoy)
 * @param {(dia:number)=>void} props.onCambio
 * @param {boolean} [props.habilitado=true]  false ⇒ sin histórico → deshabilitado
 * @param {string} [props.resumen='']        texto del día para aria-live
 */
function TideScrubberBase({ dias, valor, onCambio, habilitado = true, resumen = '' }) {
  if (!habilitado || !(dias >= 2)) {
    return (
      <div className="tide-scrubber tide-scrubber--off">
        <p className="tide-scrubber__nota">
          Sin histórico de movimientos todavía: el cielo muestra el meta de hoy.
        </p>
      </div>
    )
  }

  const max = dias - 1
  return (
    <div className="tide-scrubber">
      <label className="tide-scrubber__titulo" htmlFor="tide-scrubber-input">
        Escrutador de mareas
      </label>
      <input
        id="tide-scrubber-input"
        className="tide-scrubber__input"
        type="range"
        min={0}
        max={max}
        step={1}
        value={valor}
        onChange={(e) => onCambio?.(Number(e.currentTarget.value))}
        aria-valuetext={etiquetaDia(valor, dias)}
      />
      <div className="tide-scrubber__escala" aria-hidden="true">
        {Array.from({ length: dias }, (_, i) => (
          <span
            key={i}
            className={`tide-scrubber__marca${i === valor ? ' is-activa' : ''}`}
          >
            <span className="tide-scrubber__tick" />
            {i === 0 || i === max || i === valor ? (
              <span className="tide-scrubber__dia font-mono">{etiquetaDia(i, dias)}</span>
            ) : null}
          </span>
        ))}
      </div>
      <p className="tide-scrubber__resumen font-mono" aria-live="polite">
        {resumen}
      </p>
    </div>
  )
}

const TideScrubber = memo(TideScrubberBase)
export default TideScrubber
