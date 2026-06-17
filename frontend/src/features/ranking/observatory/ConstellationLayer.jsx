import { memo } from 'react'
import { pathDeConstelacion } from './observatory-core'
import './observatory.css'

/**
 * ConstellationLayer — capa SVG decorativa (aria-hidden) que dibuja un trazo
 * hairline dorado por anime uniendo sus estrellas. Un único <svg> + un <path>
 * por constelación (criterio de perf: «60 estrellas = 60 nodos memo + 1 SVG»).
 * El dibujado usa pathLength normalizado (=1) para animar stroke-dashoffset sin
 * medir longitudes en JS; cada trazo entra ~200ms tras la última estrella de su
 * constelación (stagger por índice). `vector-effect:non-scaling-stroke` mantiene
 * el grosor fino aunque el lienzo haga zoom.
 *
 * @param {Object} props
 * @param {{anime:string, indice:number, segmentos:Object[]}[]} props.constelaciones
 * @param {number} props.ancho
 * @param {number} props.alto
 * @param {boolean} [props.animado=true]        false = ya encendido (sin dibujar)
 * @param {boolean} [props.reducedMotion=false]
 * @param {number} [props.staggerMs=90]         separación de encendido por constelación
 * @param {number} [props.retardoBaseMs=0]
 * @param {string|null} [props.animeFiltrado=null]  atenúa los trazos de los demás animes
 */
function ConstellationLayerBase({
  constelaciones,
  ancho,
  alto,
  animado = true,
  reducedMotion = false,
  staggerMs = 90,
  retardoBaseMs = 0,
  animeFiltrado = null,
}) {
  const dibuja = animado && !reducedMotion
  return (
    <svg
      className="constellation-layer"
      viewBox={`0 0 ${ancho} ${alto}`}
      width={ancho}
      height={alto}
      aria-hidden="true"
      focusable="false"
    >
      {constelaciones.map((c) => {
        const d = pathDeConstelacion(c.segmentos)
        if (!d) return null
        const retardo = retardoBaseMs + c.indice * staggerMs + 200
        const atenuado = animeFiltrado != null && c.anime !== animeFiltrado
        return (
          <path
            key={c.anime}
            d={d}
            pathLength="1"
            className={`constellation-layer__trazo${dibuja ? ' is-dibujando' : ''}${atenuado ? ' is-atenuado' : ''}`}
            style={dibuja ? { animationDelay: `${retardo}ms` } : undefined}
          />
        )
      })}
    </svg>
  )
}

const ConstellationLayer = memo(ConstellationLayerBase)
export default ConstellationLayer
