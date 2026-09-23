import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { catalogo } from '../lib/catalog.js'
import { cartasDistintas } from '../lib/collection.js'
import { useColeccion } from '../lib/useCollection.js'
import { useTitulo } from '../lib/useTitulo.js'

export default function Coleccion() {
  useTitulo('Colección')
  const n = cartasDistintas(useColeccion())

  return (
    <div className="wrap pt-10 pb-24 md:pt-16">
      <TituloSeccion ja="コレクション" sub={`${n} de ${catalogo.total} cartas. Se guarda en este navegador, sin cuenta.`}>
        Colección
      </TituloSeccion>
    </div>
  )
}
