import { useMemo } from 'react'
import { sparkVectors } from './forge-core'

/**
 * SparkBurst — chispas de UN golpe, una sola pasada.
 *
 * Pool FIJO de 8 spans reutilizados (nunca se crean nodos por golpe). El
 * restart NO remonta: alternando `data-fire` a<->b la animación CSS
 * (forge-spark-a / forge-spark-b, idénticas) reanuda desde el frame 0. Cada
 * span lleva su vector como custom props inline (deterministas por índice).
 * Solo transform/opacity. `aria-hidden`. En reduced-motion el CSS lo oculta.
 *
 * @param {Object} props
 * @param {number} props.strikeId  Número de golpe actual (0 = sin chispas).
 * @param {boolean} [props.calm]   Reduced-motion: sin chispas.
 */
export default function SparkBurst({ strikeId, calm = false }) {
  const vectors = useMemo(() => sparkVectors(), [])
  const fire = strikeId <= 0 || calm ? '' : strikeId % 2 ? 'a' : 'b'
  return (
    <div className="spark-burst" aria-hidden="true" data-fire={fire}>
      {vectors.map((v, i) => (
        <span
          key={i}
          className="spark-burst__bit"
          style={{
            '--sx': `${v.x}px`,
            '--sy': `${v.y}px`,
            '--spin': `${v.spin}deg`,
            '--spark-delay': `${v.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}
