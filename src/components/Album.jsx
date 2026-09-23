import { memo } from 'react'
import { filasHoja, fraccion } from '../lib/album.js'
import { numeroCarta } from '../lib/catalog.js'
import { revelar } from '../lib/motion.js'
import { Carta } from './Carta.jsx'
import { Hanko } from './Hanko.jsx'

/**
 * Hoja del álbum: una serie (o las especiales) con un hueco numerado por
 * carta. Las que se tienen ocupan su hueco; las que faltan dejan el hueco
 * vacío con su número.
 *
 * Mientras no está en pantalla, el navegador no la pinta (content-visibility,
 * con la altura reservada por filas).
 */
export const Hoja = memo(function Hoja({ hoja, tengo }) {
  const { id, titulo, nativo, orden, cartas, especiales } = hoja
  const n = cartas.reduce((suma, c) => suma + (Object.hasOwn(tengo, c.id) ? 1 : 0), 0)
  const completa = n === cartas.length
  const filas = filasHoja(cartas.length)
  const idTitulo = `hoja-${id}-titulo`
  const numero = especiales ? null : String(orden).padStart(2, '0')

  return (
    <section
      id={`hoja-${id}`}
      className={especiales ? 'hoja hoja--especiales' : 'hoja'}
      aria-labelledby={idTitulo}
      data-diferido=""
      data-completa={completa || undefined}
      style={{ '--filas-3': filas[3], '--filas-5': filas[5], '--filas-6': filas[6] }}
    >
      {/* Lomo: número de la hoja y título original en vertical; acompaña al scroll. */}
      <div className="hoja-lomo" aria-hidden="true">
        <div className="hoja-lomo-fijo">
          {numero && <span className="hoja-orden cifra">{numero}</span>}
          {nativo && (
            <span lang="ja" className="tate hoja-lomo-ja">
              {nativo}
            </span>
          )}
        </div>
      </div>

      <header className="hoja-cabecera" data-revelar="" ref={revelar}>
        {numero && (
          <span className="hoja-orden hoja-orden--movil cifra" aria-hidden="true">
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
        <p className="hoja-cuenta cifra">
          <span className="hoja-cuenta-n">{n}</span>
          <span className="hoja-cuenta-de">/{cartas.length}</span>
          <span className="solo-lectores"> cartas en tu colección</span>
          {completa && <Hanko kanji="完" className="hoja-completa" etiqueta="Serie completa" />}
        </p>
        <span className="linea hoja-linea" style={{ '--p': fraccion({ tengo: n, total: cartas.length }) }} aria-hidden="true">
          <span className="linea-relleno" />
        </span>
      </header>

      <ol className="bolsillos">
        {cartas.map((carta) =>
          Object.hasOwn(tengo, carta.id) ? (
            <BolsilloLleno key={carta.id} carta={carta} copias={tengo[carta.id]} />
          ) : (
            <BolsilloVacio key={carta.id} carta={carta} />
          ),
        )}
      </ol>
    </section>
  )
})

function BolsilloLleno({ carta, copias }) {
  return (
    <li className="bolsillo" data-lleno="">
      <span className="bolsillo-hueco" aria-hidden="true">
        <span className="bolsillo-numero cifra">{numeroCarta(carta)}</span>
      </span>
      <Carta carta={carta} tamano="album" copias={copias} entrada />
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
          <span lang="ja" className="tate bolsillo-ja">
            {carta.nativo}
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
