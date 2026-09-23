import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { Carta } from '../components/Carta.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { FiltrosGaleria } from '../components/FiltrosGaleria.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { catalogo } from '../lib/catalog.js'
import { agruparPorSerie, busquedaDe, ESPECIALES, etiquetaFiltros, filtrarCartas, leerFiltros } from '../lib/filtros.js'
import { revelar } from '../lib/motion.js'
import { trocear, useDisposicionMuro } from '../lib/grupos.js'
import { esVuelta } from '../lib/navegacion.js'
import { usePaginaActiva } from '../lib/paginaActiva.js'
import { useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { usePorTramos } from '../lib/usePorTramos.js'
import { useTitulo } from '../lib/useTitulo.js'


// Se pinta primero lo que cabe en pantalla y el resto por tramos (ver usePorTramos).
const PRIMER_TRAMO = 30
const TRAMO = 120

export default function Galeria() {
  useTitulo()
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
  // Se cargan de inmediato las cartas de la primera fila (dos en el móvil,
  // cinco en una pantalla ancha); el resto, al acercarse con el scroll.
  const disposicion = useDisposicionMuro()
  const prioritarias = new Set(visibles.slice(0, disposicion.columnas).map((c) => c.id))
  const propsCarta = { tengo, busqueda, prioritarias, disposicion, entrada: !volviendo }

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
      <div className="wrap pt-10 pb-8 md:pt-16 md:pb-12">
        <TituloSeccion
          ja="ギャラリー"
          sub={`${catalogo.personajes.length} cartas de ${catalogo.animes.length} series, y ${catalogo.especiales.length} especiales.`}
        >
          Galería
        </TituloSeccion>
      </div>

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
          <Muro cartas={visibles} etiqueta={`Cartas: ${etiqueta}`} {...propsCarta} />
        )}
      </div>
    </>
  )
}

/**
 * Rejilla de cartas; `prioritarias` son las que se cargan sin esperar al
 * scroll. Las cartas van en grupos de dos o tres filas y cada grupo se salta
 * entero mientras está lejos de la pantalla (ver lib/grupos).
 */
function Muro({ cartas, etiqueta, tengo, busqueda, prioritarias, disposicion, entrada }) {
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
                prioridad={prioritarias.has(carta.id)}
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

/** Serie dentro de la galería completa: número, título, título original y recuento. */
function Sala({ grupo, onVerSerie, children }) {
  const { anime, orden } = grupo
  const id = `serie-${anime.id}`
  return (
    <section className="sala" aria-labelledby={id}>
      <header className="sala-cabecera" data-revelar="" ref={revelar}>
        <span className="sala-orden cifra" aria-hidden="true">
          {String(orden).padStart(2, '0')}
        </span>
        <h2 id={id} className="sala-titulo">
          {anime.titulo}
        </h2>
        {anime.nativo && (
          <span lang="ja" className="sala-nativo">
            {anime.nativo}
          </span>
        )}
        <button type="button" className="sala-ver" onClick={onVerSerie}>
          {anime.count} {anime.count === 1 ? 'carta' : 'cartas'}
          <span className="solo-lectores"> de {anime.titulo}: ver solo esta serie</span>
          <span className="sala-flecha" aria-hidden="true">
            →
          </span>
        </button>
      </header>
      {children}
    </section>
  )
}

function SinResultados({ filtros: { q, serie }, onQuitar }) {
  const donde = serie === ESPECIALES ? 'entre las especiales' : serie ? `en ${catalogo.anime(serie)?.titulo}` : ''
  return (
    <div className="vacio">
      <div className="vacio-hueco" aria-hidden="true">
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
