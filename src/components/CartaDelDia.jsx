import { catalogo, esEspecial, numeroCarta } from '../lib/catalog.js'
import { cartaDelDia } from '../lib/delDia.js'
import { coleccion, useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { Carta } from './Carta.jsx'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'

const CARTAS = [...catalogo.personajes, ...catalogo.especiales]

/**
 * Lámina de tinta junto al título de la galería con la carta del día (la
 * misma para todos durante el día local): girada unos grados, con su nombre
 * original en vertical y el sello 新 si se consiguió hoy. Lleva a su ficha.
 * En reposo no se mueve: una entrada y la inclinación de siempre al pasar
 * el puntero.
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
      <p id="del-dia-rotulo" className="del-dia-rotulo">
        Carta del día
      </p>
      <div className="del-dia-obra">
        <Carta carta={carta} tamano="dia" nueva={desde[carta.id] === hoy} cartela={false} className="del-dia-carta" />
        {nativo && <EtiquetaVertical ja={nativo} className="del-dia-nativo" />}
      </div>
      <p className="del-dia-cartela">
        <span className="del-dia-numero cifra">{numeroCarta(carta)}</span>
        <span className="del-dia-nombre">{carta.nombre}</span>
        <span className="del-dia-serie">
          {[carta.anime, esEspecial(carta) && carta.variante].filter(Boolean).join(' · ')}
        </span>
      </p>
    </aside>
  )
}
