import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { CartaVolteo } from '../components/CartaVolteo.jsx'
import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical, TextoVertical } from '../components/EtiquetaVertical.jsx'
import { Hanko } from '../components/Hanko.jsx'
import { catalogo, esEspecial, numeroCarta } from '../lib/catalog.js'
import { diaCorto } from '../lib/fechas.js'
import { busquedaDe, etiquetaFiltros, leerFiltros, recorrido } from '../lib/filtros.js'
import { imagenCarta, proporcionCarta } from '../lib/images.js'
import { nombrarCompartido } from '../lib/motion.js'
import { actualizarAncla, irA, volverAtras } from '../lib/navegacion.js'
import { columnasNombre, MAX_COLUMNA } from '../lib/tategaki.js'
import { nombreCarta } from '../lib/titulos.js'
import { coleccion, useColeccion } from '../lib/useCollection.js'
import { useInclinacion } from '../lib/useMotion.js'
import { useTitulo } from '../lib/useTitulo.js'
import NoEncontrada from './NoEncontrada.jsx'

export default function Ficha() {
  const { id } = useParams()
  const carta = catalogo.carta(id)
  useTitulo(carta ? nombreCarta(carta) : 'Carta no encontrada')
  if (!carta) return <NoEncontrada titulo="Esta carta no existe" />
  return <FichaCarta carta={carta} />
}

function FichaCarta({ carta }) {
  const { search, state } = useLocation()
  const navigate = useNavigate()
  const inclinacion = useInclinacion()
  const enlaceVolver = useRef(null)

  const filtros = leerFiltros(new URLSearchParams(search))
  const busqueda = busquedaDe(filtros)
  const { indice, total, anterior, siguiente, filtrada } = recorrido(filtros, carta)
  const familia = catalogo.familia(carta.id)
  const base = familia[0]
  const anime = catalogo.anime(carta.animeId)
  const especial = esEspecial(carta)
  const nativo = carta.nativo ?? base.nativo
  const desc = carta.desc ?? base.desc
  // Abierta desde la galería o la colección: «volver» es ir atrás de verdad
  // (con su scroll). Si se llegó de otro modo, el enlace lleva a la galería.
  const volverA = state?.volver
  const estadoVuelta = volverA ? { volver: volverA } : undefined
  const aColeccion = volverA === '/coleccion'

  const hrefDe = (c) => `/carta/${c.id}${busqueda}`

  function volver(evento) {
    if (!volverA) return // el enlace lleva a la galería con los mismos filtros
    evento.preventDefault()
    volverAtras(navigate, {
      // La carta de la página anterior recoge la de la ficha, si queda a la vista.
      alLlegar: () => {
        for (const c of [carta, base]) {
          const lamina = document.querySelector(`.carta[data-id="${c.id}"] .carta-lamina`)
          const caja = lamina?.getBoundingClientRect()
          if (caja && caja.bottom > 0 && caja.top < window.innerHeight) {
            nombrarCompartido(lamina)
            // El foco vuelve a la carta que se abrió, no al principio de la página.
            lamina.closest('a')?.focus({ preventScroll: true })
            return
          }
        }
      },
    })
  }

  // Sin View Transition: la animación es el propio giro de la carta.
  function cambiarVersion(version) {
    if (version.id === carta.id) return
    navigate(hrefDe(version), { replace: true, state: { ...estadoVuelta, conservarScroll: true } })
  }

  // Al volver, la página anterior se colocará en la carta que se esté viendo ahora.
  useEffect(() => actualizarAncla([carta.id, base.id]), [carta.id, base.id])

  // Teclado: ← → recorren las cartas y Escape vuelve a la página anterior.
  useEffect(() => {
    function alPulsar(evento) {
      if (evento.defaultPrevented || evento.metaKey || evento.ctrlKey || evento.altKey || evento.shiftKey) return
      if (evento.target.closest?.('input, textarea, select, [contenteditable]')) return
      const vecina = { ArrowLeft: anterior, ArrowRight: siguiente }[evento.key]
      if (vecina) {
        evento.preventDefault()
        irA(navigate, `/carta/${vecina.id}${busqueda}`, {
          reemplazar: true,
          direccion: evento.key === 'ArrowLeft' ? 'anterior' : 'siguiente',
          estado: volverA ? { volver: volverA } : undefined,
        })
      } else if (evento.key === 'Escape') {
        evento.preventDefault()
        enlaceVolver.current?.click()
      }
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [navigate, anterior, siguiente, busqueda, volverA])

  return (
    <article className="ficha">
      <div className="ficha-escenario">
        {nativo && (
          <span lang="ja" className="ficha-fondo" aria-hidden="true">
            <TextoVertical texto={nativo} />
          </span>
        )}

        <div className="ficha-barra">
          <Enlace ref={enlaceVolver} to={aColeccion ? '/coleccion' : `/${busqueda}`} className="ficha-volver" onClick={volver}>
            <span className="ficha-volver-flecha" aria-hidden="true">
              ←
            </span>
            {aColeccion ? 'Colección' : 'Galería'}
          </Enlace>
          {indice >= 0 && (
            <span className="ficha-posicion cifra">
              {indice + 1} / {total}
              {filtrada && <span className="ficha-posicion-filtro"> · {etiquetaFiltros(filtros)}</span>}
            </span>
          )}
        </div>

        {/* En la ficha la carta tiene la proporción real de su ilustración: nada se recorta. */}
        <div ref={inclinacion} className="ficha-carta" style={{ '--ar': proporcionCarta(carta) }}>
          <CartaVolteo carta={carta} familia={familia} />
        </div>

        {familia.length > 1 && <Versiones familia={familia} actual={carta} onElegir={cambiarVersion} />}
      </div>

      <div className="ficha-info">
        <header className="ficha-cabecera">
          {nativo && (
            <EtiquetaVertical
              ja={columnasNombre(nativo).join('\n')}
              className={[...nativo].length > MAX_COLUMNA ? 'ficha-nativo ficha-nativo--largo' : 'ficha-nativo'}
              decorativa={false}
            />
          )}
          <div className="min-w-0">
            <p key={`numero-${carta.id}`} className="ficha-numero ficha-cambia cifra">
              Nº {numeroCarta(carta)}
            </p>
            {/* La key repite la entrada del título al pasar a otro personaje, no al girar la carta. */}
            <h1 key={`nombre-${base.id}`} className="ficha-nombre revela-titulo">
              {carta.nombre}
            </h1>
            {carta.variante && <p className="ficha-variante">{carta.variante}</p>}
            <p className="ficha-serie">
              <span className="ficha-serie-titulo">{anime.titulo}</span>
              {anime.nativo && (
                <span lang="ja" className="ficha-serie-nativo">
                  {anime.nativo}
                </span>
              )}
            </p>
          </div>
        </header>

        <dl className="ficha-datos">
          <div>
            <dt>Serie</dt>
            <dd>
              <Enlace to={`/?serie=${anime.id}`} className="ficha-enlace">
                Ver sus {anime.count} cartas
              </Enlace>
            </dd>
          </div>
          <div>
            <dt>Rareza</dt>
            <dd key={carta.id} className="ficha-cambia">
              {especial ? 'Especial' : 'Normal'}
            </dd>
          </div>
          <div>
            <dt>Colección</dt>
            <dd key={carta.id} className="ficha-cambia">
              <EstadoColeccion id={carta.id} />
            </dd>
          </div>
        </dl>

        {desc && <p className="ficha-desc">{desc}</p>}

        <nav className="ficha-recorrido" aria-label="Otras cartas">
          {anterior ? <Vecina carta={anterior} href={hrefDe(anterior)} direccion="anterior" /> : <span />}
          {siguiente ? <Vecina carta={siguiente} href={hrefDe(siguiente)} direccion="siguiente" /> : <span />}
        </nav>
        <p className="ficha-atajos" aria-hidden="true">
          <kbd>←</kbd> <kbd>→</kbd> para recorrer · <kbd>Esc</kbd> para volver
        </p>
      </div>
    </article>
  )
}

/** Normal y especiales del mismo personaje: cada botón da la vuelta a la carta. */
function Versiones({ familia, actual, onElegir }) {
  return (
    <div className="versiones" role="group" aria-label="Versión de la carta">
      {familia.map((version) => {
        const especial = esEspecial(version)
        return (
          <button
            key={version.id}
            type="button"
            className="version"
            aria-pressed={version.id === actual.id}
            onClick={() => onElegir(version)}
          >
            {especial && <Hanko kanji="特" forma="redondo" estilo="linea" className="version-sello" />}
            {especial ? (version.variante ?? 'Especial') : 'Normal'}
          </button>
        )
      })}
    </div>
  )
}

function EstadoColeccion({ id }) {
  const { tengo, desde } = useColeccion()
  const copias = tengo[id] ?? 0
  if (!copias) {
    return (
      <>
        Aún no la tienes — consíguela en{' '}
        <Enlace to="/sobres" className="ficha-enlace">
          Sobres
        </Enlace>
      </>
    )
  }
  const fecha = diaCorto(desde[id], coleccion.hoy())
  return (
    <span className="ficha-la-tienes">
      <span className="carta-copias-sello" aria-hidden="true" />
      La tienes{copias > 1 ? ` ×${copias}` : ''}
      {fecha && ` · desde ${fecha}`}
    </span>
  )
}

function Vecina({ carta, href, direccion }) {
  const img = imagenCarta(carta)
  return (
    <Enlace
      to={href}
      className={`ficha-vecina ficha-vecina--${direccion}`}
      data-reemplazar=""
      data-direccion={direccion}
      rel={direccion === 'anterior' ? 'prev' : 'next'}
    >
      <span className="ficha-vecina-mini" style={{ '--tono': carta.color }} aria-hidden="true">
        <img src={img.src} srcSet={img.srcSet} sizes="48px" width={img.width} height={img.height} alt="" decoding="async" />
      </span>
      <span className="ficha-vecina-texto">
        <span className="ficha-vecina-rotulo">{direccion === 'anterior' ? '← Anterior' : 'Siguiente →'}</span>
        <span className="ficha-vecina-nombre">{nombreCarta(carta)}</span>
      </span>
    </Enlace>
  )
}
