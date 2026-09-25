import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { Carta } from '../components/Carta.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { FiltrosGaleria } from '../components/FiltrosGaleria.jsx'
import { Portada } from '../components/Portada.jsx'
import { Hanko } from '../components/Hanko.jsx'
import { catalogo } from '../lib/catalog.js'
import { useHidratado } from '../lib/hidratado.js'
import { escenaAnime, pieza, simboloAnime } from '../lib/marca.js'
import { agruparPorSerie, busquedaDe, ESPECIALES, etiquetaFiltros, filtrarCartas, leerFiltros } from '../lib/filtros.js'
import { revelar } from '../lib/motion.js'
import { trocear, useDisposicionMuro } from '../lib/grupos.js'
import { esVuelta } from '../lib/navegacion.js'
import { usePaginaActiva } from '../lib/paginaActiva.js'
import { useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { usePorTramos } from '../lib/usePorTramos.js'
import { useTitulo } from '../lib/useTitulo.js'


// Escenario de un estandarte: a lo ancho de la página, menos los márgenes.
const TAMANO_ESCENA = '(min-width: 80rem) 1170px, (min-width: 48rem) calc(100vw - 5rem), calc(100vw - 2rem)'
const ESCENA_ESPECIALES = pieza('collection-ssr-share')
const CIUDAD = pieza('empty-search-night-city-refresh')

// Se pinta primero lo que cabe en pantalla y el resto por tramos (ver usePorTramos).
const PRIMER_TRAMO = 30
const TRAMO = 120

/**
 * La galería: la portada y, debajo, la barra de filtros y las cartas. La
 * portada va prerenderizada en el HTML (ver scripts/prerender.mjs); la
 * rejilla depende de la dirección (los filtros), de la colección y de la
 * pantalla, así que se pinta al hidratar.
 */
export default function Galeria() {
  useTitulo()
  const hidratado = useHidratado()
  return (
    <>
      <Portada />
      {hidratado && <Cartas />}
    </>
  )
}

/** Filtros y rejilla de la galería, agrupada por series o filtrada. */
function Cartas() {
  const { search } = useLocation()
  const tipo = useNavigationType()
  const navigate = useNavigate()
  const { tengo } = useColeccion()
  const rejilla = useInclinacion()
  const buscador = useRef(null)
  const selectorSerie = useRef(null)
  const activa = usePaginaActiva()

  const filtros = leerFiltros(new URLSearchParams(search))
  // La rejilla se pinta con los filtros diferidos: escribir nunca espera a
  // que se monten cientos de cartas.
  const q = useDeferredValue(filtros.q)
  const serie = useDeferredValue(filtros.serie)
  const cartas = useMemo(() => filtrarCartas({ q, serie }), [q, serie])
  const busqueda = busquedaDe({ q, serie })
  const etiqueta = etiquetaFiltros({ q, serie })

  // Al volver atrás a una galería que ya no estaba montada (p. ej. desde los
  // sobres) las cartas ya se vieron: aparecen sin coreografía y se montan
  // todas para recuperar la posición del scroll. Se decide al montar;
  // después, filtrar no debe esconder las ya visibles. (Desde una ficha no
  // hace falta: la galería sigue montada mientras tanto, ver App.jsx.)
  const [volviendo] = useState(() => esVuelta(tipo))

  const visibles = usePorTramos(cartas, { primero: PRIMER_TRAMO, tramo: TRAMO, completa: volviendo })
  // Sin filtros, las cartas se agrupan por serie; filtradas, van seguidas.
  const agrupar = !q.trim() && !serie
  // La portada ocupa la primera pantalla: las cartas cargan al acercarse con el scroll.
  const disposicion = useDisposicionMuro()
  const propsCarta = { tengo, busqueda, disposicion, entrada: !volviendo }

  function cambiar(cambios) {
    navigate({ search: busquedaDe({ ...filtros, ...cambios }) }, { replace: true })
    // Si se estaba lejos, los resultados nuevos se ven desde el principio.
    const inicio = rejilla.current?.getBoundingClientRect().top
    if (inicio !== undefined && inicio < 0) window.scrollBy(0, inicio - 96)
    // Los botones que filtran («8 cartas →», «Quitar filtros») desaparecen al
    // pulsarlos: el foco pasa al campo que refleja el cambio, no a <body>.
    if (document.activeElement?.tagName === 'BUTTON') {
      const campo = cambios.serie ? selectorSerie.current : buscador.current
      campo?.focus({ preventScroll: true })
    }
  }

  // «/» lleva a la búsqueda desde cualquier punto de la galería.
  useEffect(() => {
    if (!activa) return undefined
    function alPulsar(evento) {
      if (evento.key !== '/' || evento.metaKey || evento.ctrlKey || evento.altKey) return
      if (evento.target.closest?.('input, textarea, select, [contenteditable]')) return
      evento.preventDefault()
      buscador.current?.focus()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [activa])

  return (
    <>
      <FiltrosGaleria
        filtros={filtros}
        onCambiar={cambiar}
        total={cartas.length}
        buscador={buscador}
        selectorSerie={selectorSerie}
      />

      <div ref={rejilla} className="wrap pt-8 pb-24 md:pt-12">
        {!cartas.length ? (
          <SinResultados filtros={{ q, serie }} onQuitar={() => cambiar({ q: '', serie: '' })} />
        ) : agrupar ? (
          agruparPorSerie(visibles).map((grupo) => (
            <Sala key={grupo.anime.id} grupo={grupo} onVerSerie={() => cambiar({ serie: grupo.anime.id })}>
              <Muro cartas={grupo.cartas} {...propsCarta} />
            </Sala>
          ))
        ) : (
          <>
            {serie && <EstandarteFiltro serie={serie} />}
            <Muro cartas={visibles} etiqueta={`Cartas: ${etiqueta}`} {...propsCarta} />
          </>
        )}
      </div>
    </>
  )
}

/**
 * Rejilla de cartas. Las cartas van en grupos de dos o tres filas y cada grupo se salta
 * entero mientras está lejos de la pantalla (ver lib/grupos).
 */
function Muro({ cartas, etiqueta, tengo, busqueda, disposicion, entrada }) {
  const { columnas, tamano } = disposicion
  return (
    <div className="muro" role="list" aria-label={etiqueta}>
      {trocear(cartas, tamano).map((grupo, i) => (
        <div
          key={i}
          className="muro-grupo"
          role="none"
          data-diferido=""
          style={{ '--filas': Math.ceil(grupo.length / columnas) }}
        >
          {grupo.map((carta) => (
            <div key={carta.id} role="listitem" className="muro-celda">
              <Carta
                carta={carta}
                copias={tengo[carta.id] ?? 0}
                entrada={entrada}
                busqueda={busqueda}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Serie dentro de la galería completa: su estandarte y sus cartas. */
function Sala({ grupo, onVerSerie, children }) {
  const { anime, orden } = grupo
  const id = `serie-${anime.id}`
  return (
    <section className="sala" aria-labelledby={id}>
      <Estandarte
        id={id}
        titulo={anime.titulo}
        nativo={anime.nativo}
        orden={orden}
        escena={escenaAnime(anime)}
        simbolo={simboloAnime(anime)}
      >
        <button type="button" className="sala-ver" onClick={onVerSerie}>
          <span className="cifra">{anime.count}</span> {anime.count === 1 ? 'carta' : 'cartas'}
          <span className="solo-lectores"> de {anime.titulo}: ver solo esta serie</span>
          <span className="sala-flecha" aria-hidden="true">
            →
          </span>
        </button>
      </Estandarte>
      {children}
    </section>
  )
}

/** Estandarte de la serie filtrada (o de las especiales) sobre sus cartas. */
function EstandarteFiltro({ serie }) {
  if (serie === ESPECIALES) {
    const n = catalogo.especiales.length
    return (
      <Estandarte titulo="Especiales" nativo="特別版" escena={ESCENA_ESPECIALES} especial>
        <span className="sala-cuenta">
          <span className="cifra">{n}</span> {n === 1 ? 'carta' : 'cartas'}
        </span>
      </Estandarte>
    )
  }
  const anime = catalogo.anime(serie)
  if (!anime) return null
  return (
    <Estandarte titulo={anime.titulo} nativo={anime.nativo} escena={escenaAnime(anime)} simbolo={simboloAnime(anime)}>
      <span className="sala-cuenta">
        <span className="cifra">{anime.count}</span> {anime.count === 1 ? 'carta' : 'cartas'}
      </span>
    </Estandarte>
  )
}

/**
 * Cabecera de una serie: su escenario de fondo, a lo ancho y oscurecido
 * hacia el texto, su emblema, el número de sala, el título con su nombre
 * original y, a la derecha, `children` (el recuento o el botón que filtra).
 * Se salta fuera de pantalla (content-visibility), así que su ilustración y
 * los glifos japoneses no se piden hasta que la serie se acerca.
 */
function Estandarte({ id, titulo, nativo, orden, escena, simbolo, especial = false, children }) {
  return (
    <header className="sala-cabecera" data-especial={especial || undefined} data-revelar="" ref={revelar}>
      {escena && (
        <div className="sala-escena" aria-hidden="true">
          <img src={escena.src} srcSet={escena.srcSet} sizes={TAMANO_ESCENA} alt="" loading="lazy" decoding="async" />
        </div>
      )}
      {simbolo ? (
        <img
          className="sala-emblema"
          src={simbolo.src}
          srcSet={simbolo.srcSet}
          sizes="(min-width: 48rem) 104px, 64px"
          width="160"
          height="160"
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        especial && <Hanko kanji="特" forma="redondo" estilo="linea" className="sala-emblema sala-emblema--sello" />
      )}
      <div className="sala-texto">
        {orden !== undefined && (
          <span className="sala-orden cifra" aria-hidden="true">
            Nº {String(orden).padStart(2, '0')}
          </span>
        )}
        <h2 id={id} className="sala-titulo">
          {titulo}
        </h2>
        {nativo && (
          <span lang="ja" className="sala-nativo">
            {nativo}
          </span>
        )}
      </div>
      <div className="sala-accion">{children}</div>
    </header>
  )
}

function SinResultados({ filtros: { q, serie }, onQuitar }) {
  const donde = serie === ESPECIALES ? 'entre las especiales' : serie ? `en ${catalogo.anime(serie)?.titulo}` : ''
  return (
    <div className="vacio">
      <div className="vacio-escena" aria-hidden="true">
        <img src={CIUDAD.src} srcSet={CIUDAD.srcSet} sizes="(min-width: 48rem) 22rem, calc(100vw - 2rem)" alt="" decoding="async" />
        <EtiquetaVertical ja="該当なし" className="vacio-tate" />
      </div>
      <div className="min-w-0">
        <p className="vacio-titulo">{`Ninguna carta coincide con «${q.trim()}»${donde ? ` ${donde}` : ''}.`}</p>
        <p className="vacio-texto">Prueba con otro nombre, con solo una parte o sin filtrar por serie.</p>
        <button type="button" className="enlace-tinta vacio-boton" onClick={onQuitar}>
          Quitar filtros
        </button>
      </div>
    </div>
  )
}
