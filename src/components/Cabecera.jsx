import { useLocation } from 'react-router'
import { cartasDistintas } from '../lib/collection.js'
import { useColeccion } from '../lib/useCollection.js'
import { Enlace } from './Enlace.jsx'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'
import { SelloMarca } from './Hanko.jsx'

const SECCIONES = [
  { to: '/', es: 'Galería', ja: 'ギャラリー', activa: (ruta) => ruta === '/' || ruta.startsWith('/carta/') },
  { to: '/sobres', es: 'Sobres', ja: '開封', activa: (ruta) => ruta.startsWith('/sobres') },
  { to: '/coleccion', es: 'Colección', ja: 'コレクション', activa: (ruta) => ruta.startsWith('/coleccion') },
]

function CuentaColeccion() {
  const n = cartasDistintas(useColeccion())
  if (!n) return null
  return (
    // La key vuelve a montar el número al cambiar, para su pequeño salto.
    <span key={n} className="nav-cuenta cifra">
      {n}
      <span className="solo-lectores"> cartas</span>
    </span>
  )
}

export function Cabecera() {
  const { pathname } = useLocation()

  return (
    <header className="cabecera">
      <div className="wrap cabecera-fila">
        <Enlace to="/" className="marca" aria-label="AnimeShowdown, ir a la galería">
          <SelloMarca className="marca-sello" />
          <span className="marca-nombre">AnimeShowdown</span>
          <EtiquetaVertical ja="アニメショーダウン" className="marca-tate" />
        </Enlace>

        <nav aria-label="Secciones" className="nav">
          <ul className="nav-lista">
            {SECCIONES.map((s) => {
              const actual = s.activa(pathname)
              return (
                <li key={s.to}>
                  <Enlace to={s.to} className="nav-enlace" aria-current={actual ? 'page' : undefined}>
                    <span lang="ja" className="nav-ja" aria-hidden="true">
                      {s.ja}
                    </span>
                    <span className="nav-es">
                      {s.es}
                      {s.to === '/coleccion' && <CuentaColeccion />}
                    </span>
                  </Enlace>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
