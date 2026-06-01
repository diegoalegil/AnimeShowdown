import { useState } from 'react'
import PersonajeImg from '../../components/PersonajeImg'
import './cartas.css'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function rarezaLabel(rareza) {
  return rareza === 'ESPECIAL' ? 'UR' : rareza || 'SSR'
}

function CartaFace({ carta, className = '', eager = false, reveal = false }) {
  const [arteFallido, setArteFallido] = useState(false)
  const esEspecial = carta?.rareza === 'ESPECIAL'
  const usaArteCompleto = esEspecial && carta?.arteUrl && !arteFallido
  const aura = esEspecial ? 'rgb(36 198 220 / 0.62)' : 'rgb(197 161 90 / 0.55)'

  if (!carta) return null

  if (usaArteCompleto) {
    return (
      <article
        className={cx(
          'as-card-face as-card-face--special-full',
          reveal && 'as-card-face--reveal',
          className,
        )}
        style={{ '--as-card-aura': aura }}
      >
        <div className="as-card-face__frame">
          <img
            src={carta.arteUrl}
            alt={carta.personajeNombre}
            width={1024}
            height={1536}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            draggable="false"
            className="as-card-face__baked-art"
            onError={() => setArteFallido(true)}
          />
          <div className="as-card-face__holo" />
          <div className="as-card-face__holo-spot" />
          <span className="as-card-face__corner as-card-face__corner--tl" />
          <span className="as-card-face__corner as-card-face__corner--tr" />
          <span className="as-card-face__corner as-card-face__corner--bl" />
          <span className="as-card-face__corner as-card-face__corner--br" />
        </div>
      </article>
    )
  }

  return (
    <article
      className={cx(
        'as-card-face as-card-face--normal',
        esEspecial && 'as-card-face--special',
        reveal && 'as-card-face--reveal',
        className,
      )}
      style={{ '--as-card-aura': aura }}
    >
      <div className="as-card-face__frame">
        <PersonajeImg
          slug={carta.personajeSlug}
          alt={carta.personajeNombre}
          nombre={carta.personajeNombre}
          colorDominante={carta.colorDominante}
          loading={eager ? 'eager' : 'lazy'}
          sizes="(min-width: 768px) 220px, 58vw"
          fit="contain"
          position="center"
          className="as-card-face__personaje"
        />
        <div className="as-card-face__holo" />
        <div className="as-card-face__holo-spot" />
        <div className="as-card-face__badge">{rarezaLabel(carta.rareza)}</div>
        <div className="as-card-face__power">
          <span>ELO</span>
          {Math.max(0, carta.elo ?? 0)}
        </div>
        <div className="as-card-face__anime">{carta.anime}</div>
        <div className="as-card-face__footer">
          <p className="as-card-face__name">{carta.personajeNombre}</p>
          <p className="as-card-face__series">{carta.anime}</p>
        </div>
        {carta.cantidad > 1 && (
          <div className="as-card-face__dupes" title={`Tienes ${carta.cantidad} copias`}>
            x{carta.cantidad}
          </div>
        )}
        <span className="as-card-face__corner as-card-face__corner--tl" />
        <span className="as-card-face__corner as-card-face__corner--tr" />
        <span className="as-card-face__corner as-card-face__corner--bl" />
        <span className="as-card-face__corner as-card-face__corner--br" />
      </div>
    </article>
  )
}

export default CartaFace
