import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { CARTAS_POR_SOBRE, SOBRES_POR_DIA } from '../config.js'
import { sobresRestantes } from '../lib/collection.js'
import { coleccion, useColeccion } from '../lib/useCollection.js'
import { useTitulo } from '../lib/useTitulo.js'

export default function Sobres() {
  useTitulo('Sobres')
  const estado = useColeccion()
  const quedan = sobresRestantes(estado, coleccion.hoy())

  return (
    <div className="yoru escenario">
      <div className="wrap pt-10 pb-24 md:pt-16">
        <TituloSeccion
          ja="開封"
          sub={`${SOBRES_POR_DIA} sobres al día, ${CARTAS_POR_SOBRE} cartas en cada uno. Te quedan ${quedan} hoy.`}
          className="[--pincel-fondo:var(--color-yoru)]"
        >
          Sobres
        </TituloSeccion>
      </div>
    </div>
  )
}
