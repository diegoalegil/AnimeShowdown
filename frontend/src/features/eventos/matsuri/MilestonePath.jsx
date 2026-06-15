import { NUMERALES } from './festival-core'

/**
 * MilestonePath — la senda de piedras por el centro de la calle = la procesion
 * del evento. Cada hito ALCANZADO enciende su piedra (capa dorada que cruza
 * opacidad sobre la apagada).
 *
 * Adaptacion al dominio REAL (decision del owner): los hitos son fases de FECHA
 * derivadas de la linea temporal real del evento (deriveHitosEvento): Apertura,
 * Ecuador, Recta final, Cierre. NO hay cruce de hito en vivo ni `hitoNuevoId`:
 * las piedras de fases pasadas estan encendidas YA al montar, SIN ceremonia
 * (opacity 1 sin transicion). Por eso este componente es puro/presentacional:
 * cero effect, cero sonido, cero estado.
 *
 * Es un <ol> (lista ordenada) con aria-current="step" en el ultimo alcanzado.
 *
 * @param {object} props
 * @param {Array<{id:string, etiqueta:string, alcanzado:boolean}>} props.hitos
 */
export default function MilestonePath({ hitos }) {
  if (!hitos || hitos.length === 0) return null

  // ultimo alcanzado para aria-current="step"
  let lastReached = -1
  hitos.forEach((h, i) => { if (h.alcanzado) lastReached = i })

  return (
    <ol className="fest-path" aria-label="Procesion del evento: hitos">
      {hitos.map((h, i) => (
        <li
          key={h.id}
          data-hito={h.id}
          className={`fest-stone${h.alcanzado ? ' is-on' : ''}`}
          aria-current={i === lastReached ? 'step' : undefined}
        >
          <span className="fest-stone__lit" aria-hidden="true" />
          <span className="fest-stone__num" aria-hidden="true">{NUMERALES[i] ?? i + 1}</span>
          <span className="fest-sr">{h.etiqueta}{h.alcanzado ? ' (alcanzado)' : ''}</span>
        </li>
      ))}
    </ol>
  )
}
