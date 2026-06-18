import './streak-chest.css'

// Cofre CERRADO: cofre con tapa abombada y cierre. Trazo = currentColor (lo
// tiñe la cara). Decorativo (la celda lleva el aria).
function ClosedChestSvg() {
  return (
    <svg
      className="streak-chest__svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14v6.2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M5 12a7 7 0 0 1 14 0" />
      <path d="M5 12h14" />
      <rect x="10.8" y="11.4" width="2.4" height="3.2" rx="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Cofre ABIERTO: tapa levantada y ladeada + boca abierta + destello del tesoro.
function OpenChestSvg() {
  return (
    <svg
      className="streak-chest__svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7.6a6.5 6.5 0 0 1 12 1.1l-12 1.5z" opacity="0.7" />
      <path d="M5 12.2l14-1.5v7.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M5 12.2l14-1.5" opacity="0.55" />
      <path
        d="M12 12.7l.6 1.3 1.4.2-1 1 .25 1.4-1.25-.7-1.25.7.25-1.4-1-1 1.4-.2z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

/**
 * StreakChests — la semana de la racha como COFRES (pieza 30, parte 1).
 * Reemplaza la rejilla de marcas 完 de <StreakFlame>: 7 días, cada día
 * completado es un cofre ABIERTO (oro), el día de HOY sin completar un cofre
 * cerrado que invita (borde eléctrico, o ámbar si peligra la racha), y se abre
 * con un FLIP al completar (vía CSS al cambiar `done`). Datos = los del
 * progreso diario, sin red.
 *
 * @param {Object} props
 * @param {boolean[]} props.days   7 booleanos, [6] = hoy (completado o no)
 * @param {boolean} [props.danger] hoy sin jugar y quedan <6 h
 */
export default function StreakChests({ days, danger = false }) {
  const total = days.length
  const hechos = days.filter(Boolean).length
  return (
    <div
      className="streak-week"
      role="img"
      aria-label={`Semana de retos diarios: ${hechos} de ${total} días completados`}
    >
      {days.map((done, i) => {
        const esHoy = i === total - 1
        const caraCerrada =
          esHoy && !done
            ? `streak-chest__face streak-chest__face--cerrada ${
                danger ? 'streak-chest__face--peligro' : 'streak-chest__face--hoy'
              }`
            : 'streak-chest__face streak-chest__face--cerrada'
        return (
          <div className="streak-chest" key={i}>
            <div className={`streak-chest__flip${done ? ' is-abierto' : ''}`}>
              <div className={caraCerrada}>
                <ClosedChestSvg />
              </div>
              <div className="streak-chest__face streak-chest__face--abierta">
                <OpenChestSvg />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
