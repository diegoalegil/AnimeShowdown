import { Enlace } from './Enlace.jsx'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'
import { SelloMarca } from './Hanko.jsx'

export function Pie() {
  return (
    <footer className="yoru pie">
      <div className="wrap pie-rejilla">
        <div className="pie-marca">
          <SelloMarca className="w-9" />
          <span className="font-serif text-2xl">AnimeShowdown</span>
        </div>

        <p className="pie-texto">
          Un proyecto de aficionados para ver y coleccionar cartas de personajes de anime. Los personajes y las obras
          originales pertenecen a sus autores y editoriales.
        </p>

        <nav aria-label="Pie de página" className="pie-nav">
          <Enlace to="/">
            Galería
          </Enlace>
          <Enlace to="/sobres">
            Sobres
          </Enlace>
          <Enlace to="/coleccion">
            Colección
          </Enlace>
        </nav>

        <p className="pie-nota">Tu colección se guarda solo en este navegador.</p>

        <EtiquetaVertical ja="絵札" className="pie-fuda" />
      </div>
    </footer>
  )
}
