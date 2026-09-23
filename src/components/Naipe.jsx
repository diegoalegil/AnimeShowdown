import { esEspecial, numeroCarta } from '../lib/catalog.js'
import { Carta } from './Carta.jsx'
import { nombreCarta } from '../lib/titulos.js'
import { SelloMarca } from './Hanko.jsx'

/** Pose de cada carta en el abanico (solo en pantallas anchas, ver sobres.css). */
export function poseAbanico(i, total) {
  const centro = (total - 1) / 2
  const d = i - centro
  return { '--giro': `${(d * 2.6).toFixed(2)}deg`, '--arco': `${(d * d * 7).toFixed(1)}px` }
}

/**
 * Una carta del sobre sobre la mesa. Empieza boca abajo; al revelarla da
 * media vuelta (dorso → cara) y estampa sus sellos. Todo el movimiento lo
 * hace el CSS a partir de data-revelada; el vuelo desde el sobre y hacia la
 * colección, lib/coreografia sobre el <li>.
 *
 * El botón cubre la carta entera y sigue ahí tras voltearla (con
 * aria-disabled), para que el foco del teclado no se pierda.
 */
export function Naipe({ carta, indice, total, nueva, revelada, retardo, copias, onRevelar }) {
  const especial = esEspecial(carta)
  const nombre = nombreCarta(carta)
  const etiqueta = revelada
    ? `Carta ${indice + 1} de ${total}: ${nombre}, de ${carta.anime}${especial ? ', especial' : ''}${nueva ? ', nueva' : `, repetida (tienes ${copias})`}`
    : `Carta ${indice + 1} de ${total}, boca abajo. Dale la vuelta.`

  return (
    <li
      className="naipe"
      data-indice={indice}
      data-revelada={revelada || undefined}
      data-especial={especial || undefined}
      style={{ ...poseAbanico(indice, total), '--retardo': `${retardo}ms` }}
    >
      <div className="naipe-pose">
        <div className="naipe-cuerpo" data-inclinar="">
          {especial && <span className="naipe-destello" aria-hidden="true" />}
          <div className="naipe-dorso" aria-hidden="true">
            <span className="naipe-dorso-motivo" />
            <SelloMarca className="naipe-dorso-sello" />
            <span className="naipe-dorso-marca">AnimeShowdown</span>
          </div>
          <div className="naipe-cara" aria-hidden="true">
            <Carta carta={carta} tamano="sobre" nueva={nueva} enlace={false} cartela={false} prioridad />
          </div>
          <button
            type="button"
            className="naipe-boton"
            aria-label={etiqueta}
            aria-disabled={revelada || undefined}
            onClick={(evento) => {
              if (!revelada) onRevelar(indice, evento)
            }}
          />
        </div>
      </div>

      <div className="naipe-cartela" aria-hidden="true">
        {revelada && (
          <>
            <span className="naipe-numero cifra">{numeroCarta(carta)}</span>
            <span className="naipe-nombre">{nombre}</span>
            <span className="naipe-serie">{carta.anime}</span>
            <span className="naipe-estado" data-nueva={nueva || undefined}>
              {nueva ? 'Nueva' : <span className="cifra">Repetida · ×{copias}</span>}
            </span>
          </>
        )}
      </div>
    </li>
  )
}
