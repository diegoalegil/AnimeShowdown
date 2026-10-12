import { Enlace } from '../../components/Enlace.jsx'
import { useProgresoJuego } from './useProgreso.js'

/**
 * Marco común de un juego: la cabecera con su kanji, nombre y descripción,
 * la racha y el récord, el desplegable «Cómo se juega», la zona de juego
 * (children) y un pie con la vuelta al hub.
 *
 * Props:
 * - `juego`: la entrada de registro.js que recibe la pantalla del juego.
 * - `reglas`: nodo con las reglas (p. ej. <ol><li>…</li></ol>); sin él no hay desplegable.
 * - `estadisticas`: [{ etiqueta, valor }] que sustituyen a racha y récord
 *   (p. ej. «Mejor racha» en un juego que puntúa por racha dentro de la ronda).
 * - `acciones`: nodo para el pie (botones propios del juego), antes de «Todos los juegos».
 * - `cabecera`: nodo extra bajo la descripción (p. ej. «Ronda 2 de 3»).
 */
export function MarcoJuego({ juego, reglas, estadisticas, acciones, cabecera, children }) {
  const progreso = useProgresoJuego(juego.slug)
  const datos = estadisticas ?? [
    { etiqueta: 'Racha', valor: progreso.racha },
    { etiqueta: 'Récord', valor: progreso.record },
  ]

  return (
    <article className="juego" aria-labelledby="juego-titulo">
      <header className="wrap juego-cabecera">
        <span lang="ja" className="juego-kanji" aria-hidden="true">
          {juego.kanji}
        </span>
        <div className="juego-cabecera-texto">
          <p className="rotulo juego-rotulo">{juego.recompensa ? 'Un sobre por ronda ganada' : 'Por gusto, sin sobre'}</p>
          <h1 id="juego-titulo" className="juego-titulo revela-titulo">
            {juego.nombre}
          </h1>
          <p className="juego-descripcion">{juego.descripcion}</p>
          {cabecera}
        </div>
        <dl className="juego-marcas" aria-label="Tu progreso">
          {datos.map((d) => (
            <div key={d.etiqueta} className="juego-marca">
              <dt>{d.etiqueta}</dt>
              <dd className="cifra">{d.valor}</dd>
            </div>
          ))}
        </dl>
      </header>

      {reglas && (
        <div className="wrap juego-barra">
          <details className="reglas">
            <summary className="reglas-boton">
              <span className="reglas-icono" aria-hidden="true">
                ?
              </span>
              Cómo se juega
            </summary>
            <div className="reglas-cuerpo">{reglas}</div>
          </details>
        </div>
      )}

      <div className="wrap juego-zona">{children}</div>

      <footer className="wrap juego-pie">
        {acciones}
        <Enlace to="/juegos" className="enlace-tinta juego-volver">
          <span aria-hidden="true">←</span>
          Todos los juegos
        </Enlace>
      </footer>
    </article>
  )
}
