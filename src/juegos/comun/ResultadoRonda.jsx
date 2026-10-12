import { useEffect, useRef } from 'react'
import { Enlace } from '../../components/Enlace.jsx'
import { Hanko } from '../../components/Hanko.jsx'

const TITULOS = { victoria: '¡Acertaste!', derrota: 'Esta vez no', neutro: 'Fin de la ronda' }
const SELLOS = { victoria: '勝', derrota: '負', neutro: '了' }

/**
 * Panel de fin de ronda. Al aparecer recibe el foco (el lector de pantalla
 * lo anuncia y el teclado sigue desde «Otra ronda»).
 *
 * Props:
 * - `resultado`: 'victoria' | 'derrota' | 'neutro'.
 * - `titulo`, `texto`: por defecto según el resultado; `texto` explica qué pasó.
 * - `puntos`: puntuación de la ronda, si el juego puntúa.
 * - `sobreGanado`: muestra el aviso del sobre extra con el enlace a /sobres
 *   (lo devuelve terminarRonda).
 * - `onOtraRonda`: empieza otra ronda; `etiquetaOtra` cambia el texto del botón.
 * - `children`: detalle de la ronda (la carta que era, la respuesta, etc.).
 */
export function ResultadoRonda({
  resultado = 'neutro',
  titulo,
  texto,
  puntos,
  sobreGanado = false,
  onOtraRonda,
  etiquetaOtra = 'Otra ronda',
  children,
}) {
  const panel = useRef(null)

  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    panel.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  return (
    <section
      ref={panel}
      className="resultado"
      data-resultado={resultado}
      role="group"
      aria-labelledby="resultado-titulo"
      tabIndex={-1}
    >
      <Hanko kanji={SELLOS[resultado] ?? SELLOS.neutro} forma="redondo" className="resultado-sello" />
      <div className="resultado-texto">
        <h2 id="resultado-titulo" className="resultado-titulo">
          {titulo ?? TITULOS[resultado] ?? TITULOS.neutro}
        </h2>
        {puntos !== undefined && (
          <p className="resultado-puntos">
            <span className="cifra">{puntos}</span> {puntos === 1 ? 'punto' : 'puntos'}
          </p>
        )}
        {texto && <p className="resultado-detalle">{texto}</p>}
        {children}
        {sobreGanado && (
          <p className="resultado-sobre">
            <Hanko kanji="封" className="resultado-sobre-sello" />
            <span>
              Has ganado un sobre extra.{' '}
              <Enlace to="/sobres" className="enlace-oro">
                Ábrelo en Sobres
              </Enlace>
            </span>
          </p>
        )}
        <div className="resultado-acciones">
          {onOtraRonda && (
            <button type="button" className="boton boton--principal" onClick={onOtraRonda}>
              {etiquetaOtra}
              <span className="boton-flecha" aria-hidden="true">
                →
              </span>
            </button>
          )}
          <Enlace to="/juegos" className="boton">
            Volver a los juegos
          </Enlace>
        </div>
      </div>
    </section>
  )
}
