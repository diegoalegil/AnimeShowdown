import { Carta } from '../components/Carta.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { catalogo } from '../lib/catalog.js'
import { useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { useTitulo } from '../lib/useTitulo.js'

// Muestra provisional mientras se construye la galería completa.
const MUESTRA = catalogo.personajes.slice(0, 12)

export default function Galeria() {
  useTitulo()
  const coleccion = useColeccion()
  const rejilla = useInclinacion()

  return (
    <div className="wrap pt-10 pb-24 md:pt-16">
      <TituloSeccion ja="ギャラリー" sub={`${catalogo.total} cartas de ${catalogo.animes.length} series.`}>
        Galería
      </TituloSeccion>

      <ul ref={rejilla} className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-14 md:grid-cols-3 md:gap-x-9 md:gap-y-14 xl:grid-cols-4 xl:gap-x-12 xl:gap-y-16">
        {MUESTRA.map((carta, i) => (
          <li key={carta.id}>
            <Carta carta={carta} copias={coleccion.tengo[carta.id] ?? 0} prioridad={i < 4} entrada diferida />
          </li>
        ))}
      </ul>
    </div>
  )
}
