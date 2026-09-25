import { useState } from 'react'
import { catalogo, esEspecial } from '../lib/catalog.js'
import { imagenCarta, imagenIntermedia, marcarSiCargada, TAMANOS } from '../lib/images.js'
import { caraVisible, volteoHacia, volteoInicial, volteoQuieto } from '../lib/volteo.js'
import { Hanko } from './Hanko.jsx'

/**
 * La carta grande de la ficha. Tiene dos caras: al cambiar a otra versión
 * del mismo personaje (normal ↔ especial) da media vuelta en 3D; al pasar a
 * otro personaje solo cambia la cara visible, que es el elemento compartido
 * de las View Transitions (galería ↔ ficha y entre fichas).
 *
 * En reposo la carta es plana: el contexto 3D (y su capa de composición)
 * solo existe mientras gira.
 */
export function CartaVolteo({ carta, familia }) {
  const [volteo, setVolteo] = useState(() => volteoInicial(carta.id, familia))
  // Estado derivado de la carta mostrada, ajustado durante el render.
  const siguiente = volteoHacia(volteo, carta.id, familia)
  if (siguiente !== volteo) setVolteo(siguiente)

  const visible = caraVisible(siguiente)
  const especial = esEspecial(carta)

  return (
    <div className="carta-marco ficha-marco" data-inclinar="" data-especial={especial || undefined}>
      <div className="volteo">
        <div
          className="volteo-giro"
          // Dos nombres alternos para que la animación se reinicie en cada vuelta.
          data-girando={siguiente.girando ? siguiente.giro % 2 : undefined}
          onAnimationEnd={(evento) => {
            if (evento.target === evento.currentTarget) setVolteo(volteoQuieto)
          }}
        >
          {siguiente.caras.map((id, cara) =>
            // Detrás solo hay algo si es otra versión (un personaje sin especiales va solo).
            cara === visible || id !== siguiente.caras[visible] ? (
              <Cara key={cara} carta={catalogo.carta(id)} oculta={cara !== visible} />
            ) : null,
          )}
        </div>
      </div>
      {especial && (
        <Hanko
          key={carta.id}
          kanji="特"
          forma="redondo"
          estilo="linea"
          className="carta-sello carta-sello--especial ficha-sello"
          etiqueta="Especial"
        />
      )}
    </div>
  )
}

function Cara({ carta, oculta }) {
  const img = imagenCarta(carta)
  return (
    <div className="volteo-cara" data-oculta={oculta || undefined} aria-hidden={oculta || undefined}>
      {/* La cara visible es el elemento compartido de las View Transitions.
          Mientras llega la ilustración grande se ve la intermedia (casi siempre
          en caché desde la galería), así la carta nunca llega vacía. */}
      <div
        className="carta-lamina"
        style={{
          '--tono': carta.color,
          '--intermedia': `url(${imagenIntermedia(carta)})`,
          viewTransitionName: oculta ? undefined : 'carta',
        }}
      >
        <img
          // Una imagen nueva por carta: así vuelve a fundirse al cargar.
          key={carta.id}
          ref={marcarSiCargada}
          src={img.src}
          srcSet={img.srcSet}
          sizes={TAMANOS.ficha}
          width={img.width}
          height={img.height}
          alt={oculta ? '' : `Carta de ${carta.nombre}${carta.variante ? ` (${carta.variante})` : ''}, de ${carta.anime}`}
          loading="eager"
          fetchPriority={oculta ? 'low' : 'high'}
          decoding="async"
          draggable="false"
        />
        <span className="carta-brillo" aria-hidden="true" />
      </div>
    </div>
  )
}
