import { useEffect } from 'react'
import { Enlace } from '../components/Enlace.jsx'
import { Hanko } from '../components/Hanko.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { precargarJuego } from '../juegos/cargador.js'
import { progresoDe, totales } from '../juegos/comun/progreso.js'
import { useProgreso } from '../juegos/comun/useProgreso.js'
import { JUEGOS } from '../juegos/registro.js'
import { cuandoLibre } from '../lib/diferido.js'
import { revelar } from '../lib/motion.js'
import { useColeccion } from '../lib/useCollection.js'
import { useTitulo } from '../lib/useTitulo.js'
import { juego as paginaJuego, precargarPaginas } from '../paginas.js'

/** El hub de los juegos: una tarjeta por juego, con su racha y su récord si ya se ha jugado. */
export default function Juegos() {
  useTitulo('Juegos')
  const progreso = useProgreso()
  const { extras } = useColeccion()
  const { sobres } = totales(progreso)

  // El marco de los juegos, en cuanto el navegador queda libre: entrar en
  // uno no espera su código (la pantalla de cada juego se pide al pasar por
  // su tarjeta).
  useEffect(() => cuandoLibre(() => precargarPaginas([paginaJuego])), [])

  return (
    <div className="escenario juegos">
      <div className="wrap juegos-cabecera">
        <TituloSeccion ja="遊戯" sub="Diez minijuegos, sin límite ni cuenta. Cada ronda ganada vale un sobre extra." id="juegos-titulo">
          Juegos
        </TituloSeccion>
        {(sobres > 0 || extras > 0) && <Balance ganados={sobres} porAbrir={extras} />}
      </div>

      <ol className="wrap juegos-lista" aria-label="Juegos">
        {JUEGOS.map((juego) => (
          <li key={juego.slug} data-revelar="" ref={revelar}>
            <TarjetaJuego juego={juego} progreso={progresoDe(progreso, juego.slug)} />
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Sobres ganados en los juegos hasta ahora y cuántos esperan en /sobres. */
function Balance({ ganados, porAbrir }) {
  return (
    <p className="juegos-balance">
      <Hanko kanji="封" className="juegos-balance-sello" />
      <span>
        {ganados > 0 && (
          <>
            Has ganado <strong className="cifra">{ganados}</strong> {ganados === 1 ? 'sobre' : 'sobres'} en los juegos
            {porAbrir > 0 ? '; ' : '.'}
          </>
        )}
        {porAbrir > 0 && (
          <>
            {ganados > 0 ? 'te' : 'Te'} {porAbrir === 1 ? 'espera' : 'esperan'} <strong className="cifra">{porAbrir}</strong> por abrir.{' '}
            <Enlace to="/sobres" className="enlace-oro">
              Ir a Sobres
            </Enlace>
          </>
        )}
      </span>
    </p>
  )
}

/** Tarjeta de un juego: su sello, nombre y descripción, si da sobre y el progreso guardado. */
function TarjetaJuego({ juego, progreso }) {
  const precargar = () => precargarJuego(juego)
  return (
    <Enlace
      to={`/juegos/${juego.slug}`}
      className="tarjeta-juego"
      data-acento={juego.acento}
      onPointerEnter={precargar}
      onFocus={precargar}
      onTouchStart={precargar}
    >
      <span lang="ja" className="tarjeta-juego-fondo" aria-hidden="true">
        {juego.kanji}
      </span>
      <span lang="ja" className="tarjeta-juego-kanji" aria-hidden="true">
        {juego.kanji}
      </span>
      <span className="tarjeta-juego-cuerpo">
        <span className="tarjeta-juego-nombre">{juego.nombre}</span>
        <span className="tarjeta-juego-descripcion">{juego.descripcion}</span>
        <span className="tarjeta-juego-pie">
          {juego.recompensa ? (
            <span className="tarjeta-juego-premio">
              <Hanko kanji="封" />
              Un sobre por ronda ganada
            </span>
          ) : (
            <span className="tarjeta-juego-premio tarjeta-juego-premio--sin">Por gusto, sin sobre</span>
          )}
          {progreso.jugadas > 0 && (
            <span className="tarjeta-juego-marcas cifra">
              Racha {progreso.racha} · Récord {progreso.record}
            </span>
          )}
        </span>
      </span>
      <span className="tarjeta-juego-flecha" aria-hidden="true">
        →
      </span>
    </Enlace>
  )
}
