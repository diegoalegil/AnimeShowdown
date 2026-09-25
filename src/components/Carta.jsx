import { memo } from 'react'
import { esEspecial, numeroCarta } from '../lib/catalog.js'
import { cartaEntera, imagenCarta, marcarSiCargada, TAMANOS } from '../lib/images.js'
import { revelar } from '../lib/motion.js'
import { Enlace } from './Enlace.jsx'
import { Hanko } from './Hanko.jsx'

/**
 * Carta de personaje o especial, la misma en toda la web. No usa hooks ni
 * listeners propios: puede haber más de mil en la página.
 *
 * - `tamano`: muro | album | sobre | ficha (elige el atributo sizes).
 * - `copias`: cuántas tiene el visitante; 0 no muestra nada. En el álbum
 *   todo es suyo: solo se anotan las repetidas (×N).
 * - `nueva`: sello 新 de carta recién conseguida.
 * - `enlace`: si la carta lleva a su ficha.
 * - `cartela`: nombre y serie bajo la ilustración.
 * - `prioridad`: carga inmediata (para lo que se ve sin hacer scroll).
 * - `entrada`: aparece con la animación escalonada al entrar en pantalla.
 * - `compartida`: lleva el nombre de la transición compartida (la ficha).
 * - `busqueda`: «?serie=…&q=…» que se añade al enlace para que la ficha
 *   recorra las cartas en el mismo orden que la galería.
 *
 * Va envuelta en memo: al filtrar la galería solo se pintan las que cambian.
 */
export const Carta = memo(function Carta({
  carta,
  tamano = 'muro',
  copias = 0,
  nueva = false,
  enlace = true,
  cartela = true,
  prioridad = false,
  entrada = false,
  compartida = false,
  busqueda = '',
  className = '',
}) {
  const especial = esEspecial(carta)
  const img = imagenCarta(carta)
  const numero = numeroCarta(carta)
  // En las especiales, el sello 特 ya dice que lo son: la cartela nombra la
  // serie y, si la hay, la versión («One Piece · Gear 5»).
  const serie = [carta.anime, especial && carta.variante].filter(Boolean).join(' · ')

  const entera = cartaEntera(carta)
  const imagen = {
    src: img.src,
    srcSet: img.srcSet,
    sizes: TAMANOS[tamano],
    loading: prioridad ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: 'false',
  }

  const lamina = (
    <div className="carta-marco" data-inclinar="">
      {/* Casi todas las ilustraciones llenan el marco (las que no son 2:3, con
          un leve recorte). Las muy anchas o muy altas se ven enteras, y las
          franjas que dejan las llena la misma ilustración, tenue, a sangre
          (mismo archivo: no se descarga dos veces). */}
      <div
        className="carta-lamina"
        data-entera={entera || undefined}
        style={{ '--tono': carta.color, viewTransitionName: compartida ? 'carta' : undefined }}
      >
        {entera && <img className="carta-lamina-fondo" {...imagen} alt="" aria-hidden="true" />}
        <img
          ref={marcarSiCargada}
          {...imagen}
          width={img.width}
          height={img.height}
          alt={cartela ? '' : `Carta de ${carta.nombre}, de ${carta.anime}`}
          fetchPriority={prioridad ? 'high' : undefined}
        />
        <span className="carta-brillo" aria-hidden="true" />
      </div>
      {nueva && <Hanko kanji="新" className="carta-sello carta-sello--nueva" etiqueta="Nueva" />}
      {especial && (
        <Hanko kanji="特" forma="redondo" estilo="linea" className="carta-sello carta-sello--especial" etiqueta="Especial" />
      )}
    </div>
  )

  const texto = cartela && (
    <div className="carta-cartela">
      <span className="carta-numero cifra">{numero}</span>
      <span className="carta-nombre">{carta.nombre}</span>
      <span className="carta-serie">{serie}</span>
      {copias > (tamano === 'album' ? 1 : 0) && (
        <span className="carta-copias cifra" title={copias > 1 ? `Tienes ${copias} copias` : 'En tu colección'}>
          <span className="carta-copias-sello" aria-hidden="true" />
          {copias > 1 ? `×${copias}` : null}
          <span className="solo-lectores">{copias > 1 ? ` copias en tu colección` : 'En tu colección'}</span>
        </span>
      )}
    </div>
  )

  const clases = ['carta', `carta--${tamano}`, className].filter(Boolean).join(' ')

  return (
    <article
      className={clases}
      data-id={carta.id}
      data-especial={especial || undefined}
      data-revelar={entrada ? '' : undefined}
      ref={entrada ? revelar : undefined}
    >
      {enlace ? (
        <Enlace to={`/carta/${carta.id}${busqueda}`} className="carta-enlace">
          {lamina}
          {texto}
        </Enlace>
      ) : (
        <div className="carta-enlace">
          {lamina}
          {texto}
        </div>
      )}
    </article>
  )
})
