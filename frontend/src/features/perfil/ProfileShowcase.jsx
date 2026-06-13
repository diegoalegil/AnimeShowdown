/**
 * ProfileShowcase — la vitrina de la Ficha del Combatiente.
 * Tres bloques INDEPENDIENTES que degradan por separado:
 *   · top 5      lleno → minis 2:3 con numeral kanji
 *                vacío + propio → CTA «Empezar a votar» · vacío + ajeno → línea discreta
 *   · logros     lleno → medallas hanko (tooltip del sistema con el nombre)
 *                vacío + propio → CTA informativo · vacío + ajeno → línea discreta
 *   · carta      llena → carta 2:3 con ELO · vacía + propio → tile informativo
 *                vacía + ajeno → el bloque SE OMITE (el flujo de carta de
 *                perfil no existe aún — PR num. 282 en hold)
 *
 * Stagger 50ms continuo por toda la vitrina vía --fp-i (CSS en fighter-profile.css).
 */
import './fighter-profile.css'
import { AppLink } from '../../components/AppLink'
import PersonajeImg from '../../components/PersonajeImg'
import { useRevealOnce } from './fpHooks'

const KANJI_NUM = ['一', '二', '三', '四', '五']

/**
 * @param {object} props
 * @param {Array<{slug:string, nombre:string, src:string}>} props.top5
 * @param {Array<{id:string, kanji:string, nombre:string}>} props.logros logros recientes (máx. 5)
 * @param {{slug:string, nombre:string, src:string, elo:number}|null} props.carta
 * @param {boolean} props.esPropio
 * @param {string} [props.votarHref]
 * @param {() => void} [props.onElegirCarta]
 * @param {(slug:string) => string} [props.hrefPersonaje]
 */
export default function ProfileShowcase({
  top5,
  logros,
  carta,
  esPropio,
  votarHref,
  onElegirCarta,
  hrefPersonaje,
}) {
  const [ref, revealed] = useRevealOnce(0.15)
  const listaTop5 = top5 || []
  const listaLogros = logros || []
  const baseLogros = Math.max(listaTop5.length, 1)
  const baseCarta = baseLogros + Math.max(listaLogros.length, 1)
  return (
    <section
      ref={ref}
      className={`fp-vitrina${revealed ? ' fp-revealed' : ''}`}
      aria-label="Vitrina del combatiente"
    >
      <span className="fp-vitrina-mark" aria-hidden="true" lang="ja">番付</span>
      <BloqueTop5
        top5={listaTop5}
        esPropio={esPropio}
        votarHref={votarHref}
        hrefPersonaje={hrefPersonaje}
      />
      <div className="fp-col">
        <BloqueLogros logros={listaLogros} esPropio={esPropio} baseIndex={baseLogros} />
        <BloqueCarta
          carta={carta}
          esPropio={esPropio}
          baseIndex={baseCarta}
          onElegirCarta={onElegirCarta}
        />
      </div>
    </section>
  )
}

/** Título de sección con corte de tinta canónico (cover + filo dorado). */
function SecTitle({ kanji, children }) {
  return (
    <h2 className="fp-sec-title">
      <span className="fp-cut">
        <span className="fp-sec-kanji" aria-hidden="true" lang="ja">{kanji}</span>
        {children}
        <span className="fp-cut-cover" aria-hidden="true"></span>
      </span>
    </h2>
  )
}

function BloqueTop5({ top5, esPropio, votarHref, hrefPersonaje }) {
  return (
    <section className="fp-sec">
      <SecTitle kanji="番付">Top 5 del combatiente</SecTitle>
      {top5.length ? (
        <ol className="fp-top5">
          {top5.map((p, i) => {
            const inner = (
              <>
                <PersonajeImg
                  className="fp-mini-img"
                  slug={p.slug}
                  src={p.src}
                  alt=""
                  loading="lazy"
                  sizes="(max-width: 720px) 18vw, 120px"
                  fit="cover"
                />
                <span className="fp-mini-rank" aria-hidden="true" lang="ja">
                  {KANJI_NUM[i]}
                </span>
                <span className="fp-mini-name" aria-hidden="true">{p.nombre}</span>
                <span className="fp-sr">{`${i + 1}.º: ${p.nombre}`}</span>
              </>
            )
            return (
              <li
                key={p.slug}
                className={`fp-v-item fp-mini${i === 0 ? ' fp-mini--first' : ''}`}
                style={{ '--fp-i': i }}
              >
                {hrefPersonaje ? (
                  /* AppLink: navega con la transición de PÁGINA estándar
                     (cross-fade de root); NO marca el morph personaje-hero
                     (eso requeriría markPersonajeHero al click). title para
                     que el nombre truncado por ellipsis sea legible al hover. */
                  <AppLink
                    className="fp-mini-link"
                    to={hrefPersonaje(p.slug)}
                    title={p.nombre}
                  >
                    {inner}
                  </AppLink>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ol>
      ) : esPropio ? (
        <div className="fp-cta-tile fp-v-item" style={{ '--fp-i': 0 }}>
          <span className="fp-cta-kanji" aria-hidden="true" lang="ja">番付</span>
          <p>Tu top 5 se acuña con tus votos. Aún no hay duelos suficientes.</p>
          {votarHref ? (
            <AppLink className="fp-tablilla fp-tablilla--primary" to={votarHref}>
              Empezar a votar
            </AppLink>
          ) : null}
        </div>
      ) : (
        <p className="fp-empty fp-v-item" style={{ '--fp-i': 0 }}>
          Este combatiente aún no ha acuñado su top 5.
        </p>
      )}
    </section>
  )
}

function BloqueLogros({ logros, esPropio, baseIndex }) {
  return (
    <section className="fp-sec">
      <SecTitle kanji="印">Últimos logros</SecTitle>
      {logros.length ? (
        /* Fila de medallas DECORATIVA (aria-hidden): la lista accesible e
           interactiva de logros, con nombres visibles, vive en CardLogros
           justo debajo — duplicar el nombre por placa aquí solo añadiría
           ruido al lector de pantalla. El title da el nombre al hover. */
        <ul className="fp-medals" aria-hidden="true">
          {logros.map((l, i) => (
            /* rotación determinista por índice (nada de Math.random en render) */
            <li
              key={l.id}
              className="fp-medal fp-v-item"
              style={{ '--fp-i': baseIndex + i, '--fp-rot': `${((i * 7) % 9) - 4}deg` }}
              title={l.nombre}
            >
              <span lang="ja">{l.kanji}</span>
            </li>
          ))}
        </ul>
      ) : esPropio ? (
        <div className="fp-cta-tile fp-v-item" style={{ '--fp-i': baseIndex }}>
          <span className="fp-cta-kanji" aria-hidden="true" lang="ja">印</span>
          <p>Los logros se estampan aquí a medida que caen.</p>
        </div>
      ) : (
        <p className="fp-empty fp-v-item" style={{ '--fp-i': baseIndex }}>
          Sin logros estampados todavía.
        </p>
      )}
    </section>
  )
}

function BloqueCarta({ carta, esPropio, baseIndex, onElegirCarta }) {
  if (!carta && !esPropio) return null /* ajeno sin carta → el bloque se omite */
  return (
    <section className="fp-sec">
      <SecTitle kanji="王">Carta destacada</SecTitle>
      {carta ? (
        <figure className="fp-carta fp-v-item" style={{ '--fp-i': baseIndex }}>
          <PersonajeImg
            className="fp-carta-img"
            slug={carta.slug}
            src={carta.src}
            alt={carta.nombre}
            loading="lazy"
            sizes="210px"
            fit="cover"
          />
          <figcaption className="fp-carta-foot">
            <span className="fp-carta-nombre">{carta.nombre}</span>
            <span className="fp-carta-elo">
              <span className="fp-carta-elo-label">ELO</span>
              {carta.elo}
            </span>
          </figcaption>
        </figure>
      ) : (
        <div className="fp-cta-tile fp-v-item" style={{ '--fp-i': baseIndex }}>
          <span className="fp-cta-kanji" aria-hidden="true" lang="ja">王</span>
          {/* copy informativo (no imperativo): el flujo de elegir carta de
              perfil aún no existe; el botón se reactiva solo si llega
              onElegirCarta — entonces el copy imperativo tendría sentido. */}
          <p>
            {onElegirCarta
              ? 'Elige la carta que te representa en los duelos.'
              : 'Pronto podrás destacar aquí la carta que te representa.'}
          </p>
          {onElegirCarta ? (
            <button type="button" className="fp-tablilla" onClick={onElegirCarta}>
              Elegir carta
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
