import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { useTitulo } from '../lib/useTitulo.js'

export default function NoEncontrada({ titulo = 'Esta página no existe' }) {
  useTitulo('Página no encontrada')
  return (
    <div className="wrap flex items-start gap-6 pt-16 pb-32 md:gap-10 md:pt-24">
      <EtiquetaVertical ja="見つかりません" className="text-lg text-shu-fuka" />
      <div className="min-w-0">
        <p className="cifra text-xs tracking-wide text-nezumi">404</p>
        <h1 className="pincel mt-2 text-4xl md:text-5xl">{titulo}</h1>
        <p className="mt-4 max-w-prosa text-nezumi">
          Puede que el enlace esté mal escrito o que la carta ya no forme parte del catálogo.
        </p>
        <p className="mt-8">
          <Enlace to="/" className="enlace-tinta">
            Volver a la galería
          </Enlace>
        </p>
      </div>
    </div>
  )
}
