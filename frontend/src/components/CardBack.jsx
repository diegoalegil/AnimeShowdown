// El Reverso de Federación — dorso DECORATIVO de la carta (la cara oculta).
// Patrón seigaiha en dos tonos de lienzo + enso de marca con 戦 + hairline
// perimetral doble; el canto hereda la laca de su rareza. CERO imágenes,
// cero blur, cero animación propia (el giro lo aporta el flip del contenedor).
//
// Es ARTE puramente decorativo: el componente se marca aria-hidden y no expone
// datos. OJO: NO confundir con PersonajeCardBack.jsx, que es el panel de INFO
// (radar de stats + racha) al que se voltea — son cosas distintas pese al
// parecido del nombre. Este es el dorso boca-abajo (deck, sobre sin revelar).
//
// Solo tokens del tema; el arte vive en card-back.css. La escala la da el
// contenedor (cqw) → sirve igual a tamaño hero, en grid o en mini sin tocar nada.
//
//   <CardBack className="h-full w-full" />          // llena a su padre (ratio 2:3)
//   <CardBack rareza="rare" mini />                  // canto lacado + variante de lista

import './card-back.css'

/**
 * @typedef {'common'|'uncommon'|'rare'|'epic'|'legendary'} Rareza
 */

/**
 * Dorso decorativo (federación) de una carta.
 *
 * @param {object} props
 * @param {Rareza} [props.rareza]   Rareza cuyo color laca el canto (sistema
 *   --color-rarity-*). Omitida ⇒ canto en oro de federación. NO pasar en estados
 *   "sin revelar" (spoilearía la rareza de la carta).
 * @param {boolean} [props.mini]    Variante compacta para listas/decks.
 * @param {string} [props.className] Clases extra del contenedor (tamaño, etc).
 * @returns {JSX.Element}
 */
function CardBack({ rareza, mini = false, className = '' }) {
  const clases = [
    'card-back',
    rareza ? `card-back--${rareza}` : '',
    mini ? 'card-back--mini' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={clases} aria-hidden="true">
      <div className="card-back__weave" />
      <div className="card-back__vignette" />
      <div className="card-back__crest">
        <span className="card-back__enso" />
        <span className="card-back__mon" lang="ja">
          戦
        </span>
      </div>
    </div>
  )
}

export default CardBack
