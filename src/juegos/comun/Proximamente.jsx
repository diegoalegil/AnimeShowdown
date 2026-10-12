import { Enlace } from '../../components/Enlace.jsx'
import { MarcoJuego } from './MarcoJuego.jsx'

/**
 * Pantalla provisional de un juego que aún no está: su kanji y su nombre en
 * el marco de siempre, y el camino a los demás juegos.
 */
export function Proximamente({ juego }) {
  return (
    <MarcoJuego juego={juego}>
      <div className="proximamente">
        <span lang="ja" className="proximamente-kanji" aria-hidden="true">
          {juego.kanji}
        </span>
        <p className="proximamente-titulo">Próximamente</p>
        <p className="proximamente-texto">{juego.nombre} se está preparando. Mientras tanto, prueba otro juego.</p>
        <Enlace to="/juegos" className="boton boton--principal">
          Ver los juegos
          <span className="boton-flecha" aria-hidden="true">
            →
          </span>
        </Enlace>
      </div>
    </MarcoJuego>
  )
}
