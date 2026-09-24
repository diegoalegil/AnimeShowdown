import { pieza } from '../lib/marca.js'
import { Enlace } from './Enlace.jsx'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'
import { Logo } from './Logo.jsx'

const ARENA = pieza('home-hero-vote-arena')

export function Pie() {
  return (
    <footer className="pie">
      {/* Franja del escenario: la arena de la web, fundida con el lienzo. */}
      <div className="pie-escena" aria-hidden="true">
        <img src={ARENA.src} srcSet={ARENA.srcSet} sizes="100vw" alt="" loading="lazy" decoding="async" />
      </div>

      <div className="wrap pie-rejilla">
        <div className="pie-marca">
          <Logo tamano={48} />
          <span className="pie-nombre">
            Anime<span className="marca-nombre-oro">Showdown</span>
          </span>
        </div>

        <p className="pie-texto">
          Un proyecto de aficionados para ver y coleccionar cartas de personajes de anime. Los personajes y las obras
          originales pertenecen a sus autores y editoriales.
        </p>

        <nav aria-label="Pie de página" className="pie-nav">
          <Enlace to="/">Galería</Enlace>
          <Enlace to="/sobres">Sobres</Enlace>
          <Enlace to="/coleccion">Colección</Enlace>
        </nav>

        <p className="pie-nota">Tu colección se guarda solo en este navegador.</p>

        <EtiquetaVertical ja="絵札" className="pie-fuda" />
      </div>
    </footer>
  )
}
