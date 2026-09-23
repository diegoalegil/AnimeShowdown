import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { Carta } from '../components/Carta.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { FiltrosGaleria } from '../components/FiltrosGaleria.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { catalogo } from '../lib/catalog.js'
import { agruparPorSerie, busquedaDe, ESPECIALES, etiquetaFiltros, filtrarCartas, leerFiltros } from '../lib/filtros.js'
import { revelar } from '../lib/motion.js'
import { esVuelta } from '../lib/navegacion.js'
import { useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { useTitulo } from '../lib/useTitulo.js'

// Cartas que se cargan de inmediato: la primera fila en cualquier ancho.
const PRIORITARIAS = 5

// Montar mil cartas de golpe bloquea un móvil ~200 ms. Se pinta primero lo
// que cabe en pantalla y el resto se añade por tramos, en segundo plano y
// mucho antes de que dé tiempo a llegar con el scroll.
const PRIMER_TRAMO = 30
const TRAMO = 120
const PAUSA_TRAMO_MS = 32

export default function Galeria() {
  useTitulo()
  const { search } = useLocation()
  const tipo = useNavigationType()
  const navigate = useNavigate()
  const { tengo } = useColeccion()
  const rejilla = useInclinacion()
  const buscador = useRef(null)

  const filtros = leerFiltros(new URLSearchParams(search))
  // La rejilla se pinta con los filtros diferidos: escribir nunca espera a
  // que se monten cientos de cartas.
  const q = useDeferredValue(filtros.q)
  const serie = useDeferredValue(filtros.serie)
  const cartas = useMemo(() => filtrarCartas({ q, serie }), [q, serie])
  const busqueda = busquedaDe({ q, serie })
  const etiqueta = etiquetaFiltros({ q, serie })

  // Al volver desde una ficha las cartas ya se vieron: aparecen sin coreografía
  // y se montan todas para recuperar la posición del scroll. Se decide al
  // montar; después, filtrar no debe esconder las ya visibles.
  const [volviendo] = useState(() => esVuelta(tipo))

  const [tramo, setTramo] = useState(() => ({ cartas, limite: volviendo ? Infinity : PRIMER_TRAMO }))
  let limite = tramo.limite
  if (tramo.cartas !== cartas) {
    // Filtros nuevos: se vuelve a empezar por lo que se ve.
    limite = PRIMER_TRAMO
    setTramo({ cartas, limite })
  }
  const faltan = limite < cartas.length
  const visibles = faltan ? cartas.slice(0, limite) : cartas
  // Sin filtros, las cartas se agrupan por serie; filtradas, van seguidas.
  const agrupar = !q.trim() && !serie
  const prioritarias = new Set(visibles.slice(0, PRIORITARIAS).map((c) => c.id))
  const propsCarta = { tengo, busqueda, prioritarias, entrada: !volviendo }

  useEffect(() => {
    if (!faltan) return undefined
    const temporizador = setTimeout(() => {
      startTransition(() => setTramo((t) => ({ ...t, limite: t.limite + TRAMO })))
    }, PAUSA_TRAMO_MS)
    return () => clearTimeout(temporizador)
  }, [faltan, limite])

  function cambiar(cambios) {
    navigate({ search: busquedaDe({ ...filtros, ...cambios }) }, { replace: true })
    // Si se estaba lejos, los resultados nuevos se ven desde el principio.
    const inicio = rejilla.current?.getBoundingClientRect().top
    if (inicio !== undefined && inicio < 0) window.scrollBy(0, inicio - 96)
  }

  // «/» lleva a la búsqueda desde cualquier punto de la galería.
  useEffect(() => {
    function alPulsar(evento) {
      if (evento.key !== '/' || evento.metaKey || evento.ctrlKey || evento.altKey) return
      if (evento.target.closest?.('input, textarea, select, [contenteditable]')) return
      evento.preventDefault()
      buscador.current?.focus()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [])

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

      <FiltrosGaleria filtros={filtros} onCambiar={cambiar} total={cartas.length} buscador={buscador} />

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

/** Rejilla de cartas; `prioritarias` son las que se cargan sin esperar al scroll. */
function Muro({ cartas, etiqueta, tengo, busqueda, prioritarias, entrada }) {
  return (
    <ul className="muro" aria-label={etiqueta}>
      {cartas.map((carta) => (
        <li key={carta.id}>
          <Carta
            carta={carta}
            copias={tengo[carta.id] ?? 0}
            prioridad={prioritarias.has(carta.id)}
            entrada={entrada}
            diferida
            busqueda={busqueda}
          />
        </li>
      ))}
    </ul>
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
