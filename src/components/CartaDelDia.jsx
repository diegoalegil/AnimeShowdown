import { catalogo, esEspecial, numeroCarta } from '../lib/catalog.js'
import { cartaDelDia } from '../lib/delDia.js'
import { coleccion, useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { Carta } from './Carta.jsx'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'

const CARTAS = [...catalogo.personajes, ...catalogo.especiales]

/**
 * La carta del día (la misma para todos durante el día local) en un panel
 * oscuro con filo dorado, bajo el título de la portada: la carta girada unos
 * grados, su nombre original en vertical, su nombre y serie, y el sello 新 si
 * se consiguió hoy. La carta lleva a su ficha. En reposo no se mueve: una
 * entrada y la inclinación de siempre al pasar el puntero.
 */
export function CartaDelDia() {
  const { desde } = useColeccion()
  const hoy = coleccion.hoy()
  const inclinacion = useInclinacion()
  const carta = cartaDelDia(hoy, CARTAS)
  if (!carta) return null
  const nativo = carta.nativo ?? catalogo.carta(carta.personajeId)?.nativo

  return (
    <aside ref={inclinacion} className="del-dia" aria-labelledby="del-dia-rotulo">
      <Carta carta={carta} tamano="dia" nueva={desde[carta.id] === hoy} cartela={false} className="del-dia-carta" />
      <div className="del-dia-texto">
        <p id="del-dia-rotulo" className="del-dia-rotulo">
          Carta del día
          <span lang="ja" className="del-dia-ja" aria-hidden="true">
            今日の一枚
          </span>
        </p>
        <p className="del-dia-nombre">{carta.nombre}</p>
        <p className="del-dia-serie">
          <span className="del-dia-numero cifra">{numeroCarta(carta)}</span>
          {[carta.anime, esEspecial(carta) && carta.variante].filter(Boolean).join(' · ')}
        </p>
      </div>
      {nativo && <EtiquetaVertical ja={nativo} className="del-dia-nativo" />}
    </aside>
  )
}
