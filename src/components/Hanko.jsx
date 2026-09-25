// Sellos (hanko) en bermellón. Los bordes son trazados fijos ligeramente
// irregulares, como un sello real estampado a mano; no hay filtros en tiempo
// de ejecución.

const BORDE_CUADRADO =
  'M3.6 2.9 20.4 3.3 36.6 2.7c.9 0 1.3.5 1.3 1.4l-.4 16.1.3 15.7c0 .9-.5 1.3-1.4 1.3l-16.2-.3-16.3.4c-.9 0-1.3-.5-1.3-1.4l.4-16.1-.3-15.6c0-.9.4-1.3 1.2-1.3Z'
const BORDE_REDONDO =
  'M20.2 2.6c9.9-.2 17.4 7.6 17.2 17.6-.1 9.8-7.9 17.3-17.6 17.2C9.9 37.3 2.5 29.6 2.6 19.8 2.7 10.2 10.5 2.8 20.2 2.6Z'

/**
 * Sello con un carácter. `lleno` = fondo bermellón y carácter en papel
 * (shubun); `linea` = contorno y carácter en bermellón (hakubun invertido).
 */
export function Hanko({ kanji, forma = 'cuadrado', estilo = 'lleno', etiqueta, className = '' }) {
  const lleno = estilo === 'lleno'
  const borde = forma === 'redondo' ? BORDE_REDONDO : BORDE_CUADRADO
  return (
    <svg
      viewBox="0 0 40 40"
      className={`hanko ${className}`}
      data-estilo={estilo}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
    >
      <path
        d={borde}
        className={lleno ? 'hanko-fondo' : 'hanko-contorno'}
        transform={lleno ? undefined : 'translate(20 20) scale(0.92) translate(-20 -20)'}
      />
      <text x="20" y="21" className={lleno ? 'hanko-letra-papel' : 'hanko-letra-tinta'} lang="ja">
        {kanji}
      </text>
    </svg>
  )
}
