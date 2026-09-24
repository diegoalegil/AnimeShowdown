import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { pieza } from '../lib/marca.js'
import { useTitulo } from '../lib/useTitulo.js'

const PORTAL = pieza('lost-portal')

/** Página que no existe: el portal perdido de fondo, el 404 en oro y el camino de vuelta. */
export default function NoEncontrada({ titulo = 'Esta página no existe' }) {
  useTitulo('Página no encontrada')
  return (
    <section className="perdida" aria-labelledby="perdida-titulo">
      <div className="perdida-fondo" aria-hidden="true">
        <img src={PORTAL.src} srcSet={PORTAL.srcSet} sizes="100vw" width="1672" height="941" alt="" decoding="async" />
      </div>
      <div className="wrap perdida-contenido">
        <EtiquetaVertical ja="見つかりません" className="perdida-tate" />
        <div className="min-w-0">
          <p className="perdida-cifra cifra" aria-hidden="true">
            404
          </p>
          <h1 id="perdida-titulo" className="perdida-titulo revela-titulo">
            {titulo}
          </h1>
          <p className="perdida-texto">
            Puede que el enlace esté mal escrito o que la carta ya no forme parte del catálogo.
          </p>
          <p className="perdida-acciones">
            <Enlace to="/" className="boton boton--principal">
              Volver a la galería
              <span className="boton-flecha" aria-hidden="true">
                →
              </span>
            </Enlace>
            <Enlace to="/sobres" className="boton">
              Abrir sobres
            </Enlace>
          </p>
        </div>
      </div>
    </section>
  )
}
