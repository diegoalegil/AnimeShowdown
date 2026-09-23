import { useParams } from 'react-router'
import { Carta } from '../components/Carta.jsx'
import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { catalogo, numeroCarta } from '../lib/catalog.js'
import { nombreCarta } from '../lib/titulos.js'
import { useTitulo } from '../lib/useTitulo.js'
import NoEncontrada from './NoEncontrada.jsx'

export default function Ficha() {
  const { id } = useParams()
  const carta = catalogo.carta(id)
  useTitulo(carta ? nombreCarta(carta) : 'Carta no encontrada')

  if (!carta) return <NoEncontrada />

  return (
    <div className="wrap pt-8 pb-24">
      <p className="text-sm">
        <Enlace to="/" className="text-nezumi hover:text-sumi">
          ← Galería
        </Enlace>
      </p>
      <article className="mt-6 grid gap-8 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:gap-16">
        <Carta key={carta.id} carta={carta} tamano="ficha" enlace={false} cartela={false} prioridad compartida />
        <div className="flex items-start gap-5">
          {carta.nativo && <EtiquetaVertical ja={carta.nativo} className="text-xl text-sumi-2" decorativa={false} />}
          <div className="min-w-0">
            <p className="cifra text-xs tracking-wide text-nezumi">Nº {numeroCarta(carta)}</p>
            <h1 className="mt-2 text-4xl md:text-5xl">{carta.nombre}</h1>
            <p className="mt-2 font-serif text-xl text-nezumi italic">{carta.anime}</p>
          </div>
        </div>
      </article>
    </div>
  )
}
