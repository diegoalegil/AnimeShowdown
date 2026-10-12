import { Suspense } from 'react'
import { useParams } from 'react-router'
import { pantallaDe } from '../juegos/cargador.js'
import { juegoPorSlug } from '../juegos/registro.js'
import { tituloJuego } from '../lib/titulos.js'
import { useTitulo } from '../lib/useTitulo.js'
import NoEncontrada from './NoEncontrada.jsx'

/** La página de un juego (/juegos/<slug>): su pantalla, descargada aparte, en el escenario de su acento. */
export default function Juego() {
  const { slug } = useParams()
  const juego = juegoPorSlug(slug)
  if (!juego) return <NoEncontrada titulo="Este juego no existe" />
  // La key: pasar de un juego a otro monta la pantalla nueva desde cero.
  return <PaginaJuego key={juego.slug} juego={juego} />
}

function PaginaJuego({ juego }) {
  useTitulo(tituloJuego(juego))
  const { Componente } = pantallaDe(juego)
  return (
    <div className="escenario juego-escenario" data-acento={juego.acento}>
      <Suspense fallback={<CargandoJuego juego={juego} />}>
        <Componente juego={juego} />
      </Suspense>
    </div>
  )
}

/** Mientras llega el código del juego: su sello y su nombre, sin saltos después. */
function CargandoJuego({ juego }) {
  return (
    <div className="wrap juego-cargando" aria-busy="true">
      <span lang="ja" className="juego-kanji" aria-hidden="true">
        {juego.kanji}
      </span>
      <p className="juego-cargando-nombre">{juego.nombre}</p>
      <p className="solo-lectores">Cargando el juego…</p>
    </div>
  )
}
