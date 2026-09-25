import { memo } from 'react'
import { filasHoja, fraccion } from '../lib/album.js'
import { catalogo, numeroCarta } from '../lib/catalog.js'
import { escenaAnime, pieza, simboloAnime } from '../lib/marca.js'
import { revelar } from '../lib/motion.js'
import { crearPegado } from '../lib/pegado.js'
import { coleccion } from '../lib/useCollection.js'
import { Carta } from './Carta.jsx'
import { TextoVertical } from './EtiquetaVertical.jsx'
import { Hanko } from './Hanko.jsx'

// Las cartas nuevas se marcan como vistas cuando se pegan en su hueco.
const pegarAlVer = crearPegado((ids) => coleccion.pegar(ids))

// La franja del escenario ocupa el ancho de la hoja.
const TAMANO_ESCENA = '(min-width: 80rem) 1170px, (min-width: 48rem) calc(100vw - 5rem), calc(100vw - 2rem)'
const ESCENA_ESPECIALES = pieza('collection-ssr-share')

/** Escenario y emblema de la hoja: los de su serie, o el marco SSR para las especiales. */
function arteHoja(hoja) {
  if (hoja.especiales) return { escena: ESCENA_ESPECIALES, simbolo: null }
  const anime = catalogo.anime(hoja.id)
  return { escena: escenaAnime(anime), simbolo: simboloAnime(anime) }
}

/**
 * Hoja del álbum: una vitrina oscura por serie (o para las especiales) con
 * una franja de su escenario y su emblema arriba y un hueco numerado por
 * carta. Las que se tienen ocupan su hueco, sujetas por esquinas doradas;
 * las que faltan dejan el hueco vacío con su número. La serie completa lleva
 * el sello 完 en oro.
 *
 * Mientras no está en pantalla, el navegador no la pinta (content-visibility,
 * con la altura reservada por filas). Va en memo: la página le pasa como
 * texto («id id …») las cartas de esta hoja por pegar y las pegadas en esta
 * visita, así que lo que pasa en otra serie no la vuelve a pintar.
 */
export const Hoja = memo(function Hoja({ hoja, tengo, porPegar = '', recientes = '' }) {
  const { id, titulo, nativo, orden, cartas, especiales } = hoja
  const n = cartas.reduce((suma, c) => suma + (Object.hasOwn(tengo, c.id) ? 1 : 0), 0)
  const completa = n === cartas.length
  const filas = filasHoja(cartas.length)
  const idTitulo = `hoja-${id}-titulo`
  const numero = especiales ? null : String(orden).padStart(2, '0')
  const pendientes = new Set(porPegar ? porPegar.split(' ') : [])
  const nuevas = new Set(recientes ? recientes.split(' ') : [])
  const { escena, simbolo } = arteHoja(hoja)

  return (
    <section
      id={`hoja-${id}`}
      className={especiales ? 'hoja hoja--especiales' : 'hoja'}
      aria-labelledby={idTitulo}
      data-diferido=""
      data-completa={completa || undefined}
      style={{ '--filas-3': filas[3], '--filas-5': filas[5], '--filas-6': filas[6] }}
    >
      <header className="hoja-cabecera" data-revelar="" ref={revelar}>
        {escena && (
          <div className="hoja-escena" aria-hidden="true">
            <img
              src={escena.src}
              srcSet={escena.srcSet}
              sizes={TAMANO_ESCENA}
              alt=""
              loading="lazy"
              decoding="async"
              style={escena.foco ? { objectPosition: escena.foco } : undefined}
            />
          </div>
        )}
        {simbolo ? (
          <img
            className="hoja-emblema"
            src={simbolo.src}
            srcSet={simbolo.srcSet}
            sizes="(min-width: 48rem) 88px, 48px"
            width="160"
            height="160"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          especiales && <Hanko kanji="特" forma="redondo" estilo="linea" className="hoja-emblema hoja-emblema--sello" />
        )}
        <div className="hoja-texto">
          {numero && (
            <span className="hoja-orden cifra" aria-hidden="true">
              <span className="hoja-orden-no">Nº </span>
              {numero}
            </span>
          )}
          <h2 id={idTitulo} className="hoja-titulo">
            {titulo}
          </h2>
          {nativo && (
            <span lang="ja" className="hoja-nativo" aria-hidden="true">
              {nativo}
            </span>
          )}
        </div>
        <p className="hoja-cuenta cifra">
          {completa && <Hanko kanji="完" forma="redondo" estilo="linea" className="hoja-completa" etiqueta="Serie completa" />}
          <span className="hoja-cuenta-n">{n}</span>
          <span className="hoja-cuenta-de">/{cartas.length}</span>
          <span className="solo-lectores"> cartas en tu colección</span>
        </p>
        <span className="linea hoja-linea" style={{ '--p': fraccion({ tengo: n, total: cartas.length }) }} aria-hidden="true">
          <span className="linea-relleno" />
        </span>
      </header>

      <ol className="bolsillos">
        {cartas.map((carta) =>
          Object.hasOwn(tengo, carta.id) ? (
            <BolsilloLleno
              key={carta.id}
              carta={carta}
              copias={tengo[carta.id]}
              pegar={pendientes.has(carta.id)}
              nueva={nuevas.has(carta.id)}
            />
          ) : (
            <BolsilloVacio key={carta.id} carta={carta} />
          ),
        )}
      </ol>
    </section>
  )
})

/**
 * Hueco con su carta. Si la carta es nueva desde la última visita, espera
 * oculta a entrar en pantalla y entonces se pega (ver lib/pegado); durante
 * esta visita conserva el sello 新 y no repite la entrada escalonada.
 */
function BolsilloLleno({ carta, copias, pegar, nueva }) {
  return (
    <li
      id={`bolsillo-${carta.id}`}
      className="bolsillo"
      data-lleno=""
      data-pegar={pegar ? carta.id : undefined}
      ref={pegar ? pegarAlVer : undefined}
    >
      <span className="bolsillo-hueco" aria-hidden="true">
        <span className="bolsillo-numero cifra">{numeroCarta(carta)}</span>
      </span>
      <Carta carta={carta} tamano="album" copias={copias} nueva={nueva} entrada={!nueva} />
    </li>
  )
}

function BolsilloVacio({ carta }) {
  const numero = numeroCarta(carta)
  return (
    <li className="bolsillo" data-revelar="" ref={revelar}>
      <span className="bolsillo-hueco" aria-hidden="true">
        <span className="bolsillo-numero cifra">{numero}</span>
        {carta.nativo && (
          <span lang="ja" className="bolsillo-ja">
            <TextoVertical texto={carta.nativo} />
          </span>
        )}
      </span>
      <p className="bolsillo-cartela">
        <span className="solo-lectores">Nº {numero}, </span>
        <span className="bolsillo-nombre">{carta.nombre}</span>
        {carta.variante && <span className="bolsillo-variante"> · {carta.variante}</span>}
        <span className="solo-lectores">: aún no la tienes.</span>
      </p>
    </li>
  )
}
