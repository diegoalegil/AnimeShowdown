/**
 * TopPlate — «La lámina coleccionable» para las páginas /rankings/:slug
 * (las ~210 landings SEO editoriales: top global · por categoría).
 *
 * Reemplaza el CUERPO visual del template SEO actual. El h1 editorial
 * se conserva (pasa a vivir en la cabecera de la lámina) y el bloque
 * de texto SEO se conserva ÍNTEGRO: entra como children y se renderiza
 * literal bajo la tabla.
 *
 * Cero JS de cliente: componente 100% stateless y server-renderable.
 * Toda la coreografía (stagger del podio, hover lift) vive en
 * top-plate.css. Compatible React 19 + Compiler: sin refs, sin efectos,
 * sin estado, sin Date.now()/Math.random() en render.
 */
import './top-plate.css'
import PersonajeImg from '../components/PersonajeImg'
import { brandImage } from '../lib/brand-assets'

const KANJI_PODIO = ['一', '二', '三']

/** Puesto arábigo a dos dígitos para el bloque mono (04, 05…). */
function formatoPuesto(rank) {
  return String(rank).padStart(2, '0')
}

/**
 * @typedef {Object} TopEntry
 * @property {number} rank Puesto 1-based. En empates se REPITE (4, 4, 6…);
 *   el <li value> lo propaga al árbol de accesibilidad y al SEO.
 * @property {boolean} [tied] true si comparte puesto (pinta la insignia «=»
 *   y activa la nota de regla bajo la lista).
 * @property {string} slug Slug del personaje (clave estable de la fila).
 * @property {string} nombre
 * @property {string} universo Nombre del anime de origen.
 * @property {number} elo ELO acuñado (entero; se pinta tal cual, en texto).
 * @property {string} [colorDominante] Pasa a PersonajeImg.
 * @property {string} [href] Enlace a la ficha del personaje. Sin href la
 *   tarjeta es un <span> estático (misma lámina, no interactiva).
 */

/**
 * Fila de la lámina. A nivel de módulo (react-refresh / Compiler).
 * @param {{ entrada: TopEntry }} props
 */
function TopPlateRow({ entrada }) {
  const podio = entrada.rank <= 3
  const Tag = entrada.href ? 'a' : 'span'
  const clases = [
    'tp-card',
    podio ? 'is-podium' : '',
    podio ? `is-${entrada.rank}` : '',
    entrada.tied ? 'is-tied' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className="tp-row" value={entrada.rank}>
      <Tag
        className={clases}
        {...(entrada.href ? { href: entrada.href } : {})}
        {...(podio ? { 'data-stagger': String(entrada.rank) } : {})}
      >
        <span className="tp-rank">
          {podio ? (
            <>
              <span className="tp-rank__kanji" aria-hidden="true">
                {KANJI_PODIO[entrada.rank - 1]}
              </span>
              <span className="tp-sr">{entrada.rank}</span>
            </>
          ) : (
            <span className="tp-rank__num">{formatoPuesto(entrada.rank)}</span>
          )}
          {entrada.tied ? (
            <span className="tp-rank__tie" aria-label="empate">=</span>
          ) : null}
        </span>
        <span className="tp-portrait">
          <PersonajeImg
            slug={entrada.slug}
            colorDominante={entrada.colorDominante}
            alt=""
            loading={podio ? 'eager' : 'lazy'}
            sizes="56px"
            fit="cover"
          />
        </span>
        <span className="tp-id">
          <span className="tp-name">{entrada.nombre}</span>
          <span className="tp-universe">{entrada.universo}</span>
        </span>
        <span className="tp-elo">
          <span className="tp-elo__label">ELO</span>
          <span className="tp-elo__value">{entrada.elo}</span>
        </span>
      </Tag>
    </li>
  )
}

/**
 * La lámina coleccionable de /rankings/:slug.
 *
 * @param {Object} props
 * @param {string} props.titulo Título editorial EXISTENTE del template SEO —
 *   se pasa tal cual, sin reescribir.
 * @param {'h1'|'h2'} [props.tituloTag] Etiqueta del título de la lámina.
 *   Por defecto 'h1' (lámina autónoma). Cuando la página YA tiene un h1
 *   editorial arriba (CinematicHero) se baja a 'h2' para no duplicar el h1.
 * @param {string} [props.subtitulo] Standfirst opcional (si el template
 *   actual tiene entradilla, va aquí; si no, omitir — no inventar).
 * @param {string} props.kicker Texto mono del kicker (p. ej. la ruta
 *   editorial que ya usa el template: «Top 10 · global»).
 * @param {string} props.kanji Kanji del CONTEXTO (uno canónico: 王 para el
 *   global, el del clan en /animes/:slug/top, etc.). Glifo con significado.
 * @param {string} [props.kanjiSentido] Lectura/significado visible bajo el
 *   glifo (mono, muted).
 * @param {TopEntry[]} props.entradas Top ordenado; en empates repetir rank
 *   y marcar tied (el siguiente puesto conserva su número real: 4,4,6).
 * @param {string} [props.arteSlug] Slug del banco de marca
 *   (brandImage('one-piece-scene-01')). Si falta → cabecera tejida con
 *   kanji al 5% (variante «contexto sin arte»).
 * @param {string} [props.arteAlt] Alt del arte de cabecera ('' si es
 *   decorativo, que es lo habitual aquí).
 * @param {string} [props.auraClan] Color dominante del clan (viene de datos,
 *   p. ej. el colorDominante del anime) para la variante /animes/:slug/top.
 *   Se inyecta como --plate-aura; coherente con el santuario del clan.
 * @param {string} [props.nombreClan] Nombre del anime/clan (marca la lámina
 *   con data-clan para los matices de identidad).
 * @param {React.ReactNode} props.children Bloque editorial SEO ACTUAL,
 *   íntegro y literal (h2/p/enlaces tal cual están hoy).
 */
export default function TopPlate({
  titulo,
  tituloTag = 'h1',
  subtitulo,
  kicker,
  kanji,
  kanjiSentido,
  entradas,
  arteSlug,
  arteAlt = '',
  auraClan,
  nombreClan,
  children,
}) {
  const hayEmpate = entradas.some((e) => e.tied)
  const TituloTag = tituloTag === 'h2' ? 'h2' : 'h1'
  /* brandImage() devuelve { src, srcSet } | null. Sin arteSlug (o slug
     ausente del manifest) caemos a la variante tejida con kanji. */
  const arte = arteSlug ? brandImage(arteSlug) : null
  /* Tejido de la variante sin arte: solo glifos ya canónicos (anti-tofu). */
  const tejido = arte ? null : `${kanji} 番付 `.repeat(60)

  return (
    <article
      className="top-plate"
      {...(nombreClan ? { 'data-clan': nombreClan } : {})}
      {...(auraClan ? { style: { '--plate-aura': auraClan } } : {})}
    >
      <header className={`tp-header${arte ? '' : ' tp-header--woven'}`}>
        {arte ? (
          <div className="tp-header__art">
            {/* LCP: eager + fetchpriority + dimensiones explícitas */}
            <img
              src={arte.src}
              {...(arte.srcSet ? { srcSet: arte.srcSet } : {})}
              sizes="(max-width: 56rem) 100vw, 56rem"
              width="1280"
              height="640"
              alt={arteAlt}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        ) : (
          <div className="tp-header__weave" aria-hidden="true">{tejido}</div>
        )}
        <div className="tp-header__scrim" aria-hidden="true"></div>
        <div className="tp-header__aura" aria-hidden="true"></div>
        <div className="tp-header__rule" aria-hidden="true"></div>
        <div className="tp-header__body">
          <div className="tp-header__text">
            <p className="tp-kicker">
              <span className="tp-kicker__kanji" aria-hidden="true">番付</span>
              <span>{kicker}</span>
            </p>
            <TituloTag className="tp-title">{titulo}</TituloTag>
            {subtitulo ? <p className="tp-sub">{subtitulo}</p> : null}
          </div>
          <div className="tp-kanji">
            <span className="tp-kanji__glyph" aria-hidden="true">{kanji}</span>
            {kanjiSentido ? (
              <span className="tp-kanji__sense">{kanjiSentido}</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="tp-list-wrap">
        <span className="tp-watermark" aria-hidden="true">番</span>
        {/* role="list": WebKit/Safari quita la semántica de lista con
            list-style:none; restituirla mantiene el ranking navegable como lista
            en VoiceOver (convención del repo, cf. RankingPodium). */}
        <ol className="tp-list" role="list">
          {entradas.map((entrada) => (
            <TopPlateRow key={entrada.slug} entrada={entrada} />
          ))}
        </ol>
      </div>

      {hayEmpate ? (
        <p className="tp-tie-note">
          <span className="tp-tie-note__glyph" aria-hidden="true">=</span>
          <span>
            Empate al mismo ELO: comparten puesto y el siguiente conserva su
            número real.
          </span>
        </p>
      ) : null}

      <footer className="tp-editorial">{children}</footer>
    </article>
  )
}
