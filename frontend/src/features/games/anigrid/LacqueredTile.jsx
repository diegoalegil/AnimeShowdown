import './anigrid-lacquered.css'

/**
 * Ficha de madera lacada para Anidel — transposición de la piel del
 * entregable de AniGrid a las celdas REALES del juego (comparación de
 * personajes: inicial / anime / dirección de ELO).
 *
 * <p>Contrato anti-re-animación: {@code reveal='flip'} SOLO en el envío
 * real (la fila recién juzgada); las filas restauradas llegan con
 * {@code 'static'} y pintan la cara final directa — el rotor 3D ni se
 * monta (cero preserve-3d en reposo, criterio Safari del entregable).
 *
 * <p>El rotor lleva backface-visibility prefijado en AMBAS caras y no
 * carga filter/overflow/opacity. Con reduced-motion el CSS anula el
 * flip y el estado llega directo.
 *
 * @param {object} props
 * @param {'correct'|'present'|'absent'} props.estado  Laca de la cara final.
 * @param {'flip'|'static'} [props.reveal='static']
 * @param {number} [props.delay=0]  Stagger del flip (ms).
 * @param {string} [props.title]    Tooltip + aria-label de la celda.
 * @param {import('react').ReactNode} props.children  Contenido de la cara.
 */
function LacqueredTile({ estado, reveal = 'static', delay = 0, title, children }) {
  const cara = `agx-skin-${estado}`
  if (reveal !== 'flip') {
    return (
      <span title={title} aria-label={title} className={`agx-tile inline-flex h-9 w-9 items-center justify-center ${cara}`}>
        {children}
      </span>
    )
  }
  return (
    <span title={title} aria-label={title} className="agx-tile inline-flex h-9 w-9">
      <span className="agx-rotor agx-rotor--flip h-full w-full" style={{ animationDelay: `${delay}ms` }}>
        <span className="agx-face agx-skin-idle inline-flex h-full w-full items-center justify-center" aria-hidden="true" />
        <span className={`agx-face agx-face--back inline-flex h-full w-full items-center justify-center ${cara}`}>
          {children}
        </span>
      </span>
    </span>
  )
}

export default LacqueredTile
