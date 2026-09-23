import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { Hoja } from '../components/Album.jsx'
import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { Hanko } from '../components/Hanko.jsx'
import { PanelCodigo } from '../components/PanelCodigo.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import {
  busquedaAlbum,
  crearHojas,
  etiquetaHoja,
  filtrarHojas,
  fraccion,
  idsPorHoja,
  leerFiltrosAlbum,
  porcentaje,
  progreso,
} from '../lib/album.js'
import { catalogo } from '../lib/catalog.js'
import { porPegar } from '../lib/collection.js'
import { ESPECIALES } from '../lib/filtros.js'
import { esVuelta } from '../lib/navegacion.js'
import { useColeccion } from '../lib/useCollection.js'
import { useContar } from '../lib/useContar.js'
import { useInclinacion } from '../lib/useMotion.js'
import { usePorTramos } from '../lib/usePorTramos.js'
import { useTitulo } from '../lib/useTitulo.js'

const HOJAS = crearHojas()
const SERIES = HOJAS.filter((h) => !h.especiales)
const HOJA_ESPECIALES = HOJAS.find((h) => h.especiales)

// Las hojas se montan por tramos: primero las que caben en pantalla.
const PRIMER_TRAMO = 3
const TRAMO = 12

export default function Coleccion() {
  useTitulo('Colección')
  const estado = useColeccion()
  const { tengo } = estado
  const { search } = useLocation()
  const navigate = useNavigate()
  const tipo = useNavigationType()
  const album = useInclinacion()
  const selectorSerie = useRef(null)
  // Al volver desde una ficha se monta todo para recuperar la posición.
  const [volviendo] = useState(() => esVuelta(tipo))

  const filtros = leerFiltrosAlbum(new URLSearchParams(search), HOJAS)
  const { serie, empezadas } = filtros
  const cuenta = useMemo(() => progreso(HOJAS, tengo), [tengo])
  const hojas = useMemo(() => filtrarHojas(HOJAS, { serie, empezadas }, cuenta.porHoja), [serie, empezadas, cuenta])
  const series = useMemo(() => hojas.filter((h) => !h.especiales), [hojas])
  const especiales = hojas.find((h) => h.especiales)
  const visibles = usePorTramos(series, { primero: PRIMER_TRAMO, tramo: TRAMO, completa: volviendo })
  // Las especiales van al final, cuando ya están todas las series: así nada salta.
  const todasMontadas = visibles.length === series.length
  const vacia = cuenta.personajes.tengo + cuenta.especiales.tengo === 0

  // Cartas nuevas desde la última visita: esperan en su hueco hasta que se
  // ven y se pegan. `recientes` las recuerda durante toda la visita (para su
  // sello 新), también las que llegan con la página abierta (al importar).
  const pendientes = porPegar(estado)
  const [recientes, setRecientes] = useState(() => new Set(pendientes))
  const sinAnotar = pendientes.filter((id) => !recientes.has(id))
  if (sinAnotar.length) setRecientes(new Set([...recientes, ...sinAnotar]))
  const clavePendientes = pendientes.join(' ')
  const pegarPorHoja = useMemo(() => idsPorHoja(clavePendientes ? clavePendientes.split(' ') : []), [clavePendientes])
  const recientesPorHoja = useMemo(() => idsPorHoja(recientes), [recientes])
  const propsHoja = (hoja) => ({
    hoja,
    tengo,
    porPegar: pegarPorHoja.get(hoja.id),
    recientes: recientesPorHoja.get(hoja.id),
  })

  function cambiar(cambios) {
    navigate({ search: busquedaAlbum({ ...filtros, ...cambios }) }, { replace: true })
    // Si se estaba lejos, el álbum filtrado se ve desde el principio.
    const inicio = album.current?.getBoundingClientRect().top
    if (inicio !== undefined && inicio < 0) window.scrollBy(0, inicio - 96)
    // «Ver todo» desaparece al pulsarlo: el foco pasa al selector de serie.
    if (document.activeElement?.tagName === 'BUTTON') selectorSerie.current?.focus({ preventScroll: true })
  }

  return (
    <div className="coleccion">
      <div className="wrap coleccion-cabecera">
        <TituloSeccion ja="コレクション" sub="Se guarda en este navegador, sin cuenta.">
          Colección
        </TituloSeccion>
        {vacia ? <AlbumVacio /> : <Marcador cuenta={cuenta} />}
        <RecienLlegadas ids={recientes} tengo={tengo} />
      </div>

      {/* La barra de filtros se queda fija solo mientras se recorre el álbum. */}
      <div ref={album} className="album">
        <FiltrosAlbum
          filtros={filtros}
          cuenta={cuenta}
          mostradas={hojas.length}
          onCambiar={cambiar}
          selectorSerie={selectorSerie}
        />
        {(visibles.length > 0 || !hojas.length) && (
          <div className="wrap album-series">
            {visibles.map((hoja) => (
              <Hoja key={hoja.id} {...propsHoja(hoja)} />
            ))}
            {!hojas.length && <SinSeries onVerTodas={() => cambiar({ empezadas: false })} />}
          </div>
        )}

        {especiales && todasMontadas && (
          <div className="yoru album-noche">
            <EtiquetaVertical ja="特別" className="album-noche-fondo" />
            <div className="wrap">
              <Hoja {...propsHoja(especiales)} />
            </div>
          </div>
        )}
      </div>

      <PanelCodigo />
    </div>
  )
}

/** Progreso: cartas de personajes (la cifra grande), especiales y series completas. */
function Marcador({ cuenta }) {
  const { personajes, especiales, porHoja } = cuenta
  const completas = SERIES.filter((h) => porHoja.get(h.id) === h.cartas.length).length
  const cifra = useContar({ duracion: 1100 })
  const cifraEspeciales = useContar({ duracion: 900, retardo: 250 })

  return (
    <section className="marcador" aria-label="Progreso de la colección">
      <div className="marcador-principal">
        <p className="marcador-cifra">
          <span ref={cifra} className="marcador-n cifra" data-valor={personajes.tengo} aria-hidden="true">
            {personajes.tengo}
          </span>
          <span className="marcador-de" aria-hidden="true">
            de <span className="cifra">{personajes.total}</span> cartas
          </span>
          <span className="solo-lectores">
            {personajes.tengo} de {personajes.total} cartas
          </span>
        </p>
        <span className="linea marcador-linea" style={{ '--p': fraccion(personajes) }} aria-hidden="true">
          <span className="linea-relleno" />
        </span>
        <p className="marcador-pie">
          <span className="cifra">{porcentaje(personajes)} %</span> del álbum
        </p>
      </div>

      <dl className="marcador-datos">
        <div className="marcador-dato">
          <dt>Especiales</dt>
          <dd className="cifra">
            <span ref={cifraEspeciales} data-valor={especiales.tengo} aria-hidden="true">
              {especiales.tengo}
            </span>
            <span className="solo-lectores">{especiales.tengo}</span> de {especiales.total}
          </dd>
          <span className="linea marcador-linea-corta" style={{ '--p': fraccion(especiales) }} aria-hidden="true">
            <span className="linea-relleno" />
          </span>
        </div>
        <div className="marcador-dato">
          <dt>Series completas</dt>
          <dd className="cifra">
            {completas} de {SERIES.length}
          </dd>
        </div>
      </dl>

      <p className="marcador-acciones">
        <Enlace to="/sobres" className="enlace-tinta">
          Abrir sobres
          <span aria-hidden="true">→</span>
        </Enlace>
        <a href="#codigo" className="enlace-simple">
          Copia de seguridad
        </a>
      </p>
    </section>
  )
}

const MAX_NOMBRES = 6

/** Aviso de las cartas nuevas desde la última visita, con enlace a su hueco. */
function RecienLlegadas({ ids, tengo }) {
  const cartas = [...ids].filter((id) => Object.hasOwn(tengo, id)).map(catalogo.carta)
  if (!cartas.length) return null
  const vistas = cartas.slice(0, MAX_NOMBRES)
  const resto = cartas.length - vistas.length
  return (
    <section className="recien" aria-label="Cartas nuevas">
      <Hanko kanji="新" className="recien-sello" />
      <p className="recien-texto">
        <span className="recien-cuenta">
          {cartas.length === 1 ? 'Una carta nueva' : `${cartas.length} cartas nuevas`} desde tu última visita:
        </span>{' '}
        {vistas.map((c, i) => (
          <span key={c.id}>
            {i > 0 && (i === vistas.length - 1 && !resto ? ' y ' : ', ')}
            <a href={`#bolsillo-${c.id}`} className="enlace-simple">
              {c.nombre}
            </a>
          </span>
        ))}
        {resto > 0 && ` y ${resto} más`}.
      </p>
    </section>
  )
}

/** Colección vacía: el álbum espera sus primeras cartas. */
function AlbumVacio() {
  return (
    <section className="album-vacio" aria-labelledby="album-vacio-titulo">
      <div className="bolsillo-hueco album-vacio-hueco" aria-hidden="true">
        <EtiquetaVertical ja="未収集" className="album-vacio-ja" />
      </div>
      <div className="min-w-0">
        <h2 id="album-vacio-titulo" className="album-vacio-titulo">
          Tu álbum espera sus primeras cartas.
        </h2>
        <p className="album-vacio-texto">
          Cada día hay cinco sobres con cinco cartas. Ábrelos y cada carta ocupará su hueco numerado en el álbum.
        </p>
        <p className="album-vacio-acciones">
          <Enlace to="/sobres" className="enlace-tinta">
            Abrir los sobres de hoy
            <span aria-hidden="true">→</span>
          </Enlace>
        </p>
        <p className="album-vacio-nota">
          ¿Ya tenías una colección en otro navegador?{' '}
          <a href="#codigo" className="enlace-simple">
            Pega su código
          </a>
          .
        </p>
      </div>
    </section>
  )
}

/** Barra fija: ir a una serie o ver solo las empezadas. */
function FiltrosAlbum({ filtros, cuenta, mostradas, onCambiar, selectorSerie }) {
  const { porHoja } = cuenta
  const filtrado = Boolean(filtros.serie || filtros.empezadas)

  return (
    <search className="filtros" aria-label="Filtrar el álbum">
      <div className="wrap filtros-fila album-filtros">
        <label className="campo">
          <span className="campo-etiqueta">Serie</span>
          <select ref={selectorSerie} value={filtros.serie} onChange={(e) => onCambiar({ serie: e.target.value })}>
            <option value="">Todas las series</option>
            {HOJA_ESPECIALES && (
              <option value={ESPECIALES}>{etiquetaHoja(HOJA_ESPECIALES, porHoja.get(ESPECIALES) ?? 0)}</option>
            )}
            <optgroup label="Series">
              {SERIES.map((h) => (
                <option key={h.id} value={h.id}>
                  {etiquetaHoja(h, porHoja.get(h.id) ?? 0)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="casilla">
          <input
            type="checkbox"
            checked={filtros.empezadas && !filtros.serie}
            disabled={Boolean(filtros.serie)}
            onChange={(e) => onCambiar({ empezadas: e.target.checked })}
          />
          <span className="casilla-marca" aria-hidden="true" />
          Solo empezadas
        </label>

        <p className="filtros-cuenta" aria-live="polite">
          <span>
            <span className="cifra">{mostradas}</span>
            <span className="filtros-palabra"> {mostradas === 1 ? 'hoja' : 'hojas'}</span>
          </span>
          {filtrado && (
            <button type="button" className="filtros-quitar" onClick={() => onCambiar({ serie: '', empezadas: false })}>
              Ver todo
            </button>
          )}
        </p>
      </div>
    </search>
  )
}

function SinSeries({ onVerTodas }) {
  return (
    <div className="vacio">
      <div className="vacio-hueco" aria-hidden="true">
        <EtiquetaVertical ja="未収集" className="vacio-tate" />
      </div>
      <div className="min-w-0">
        <p className="vacio-titulo">Aún no has empezado ninguna serie.</p>
        <p className="vacio-texto">Las cartas que consigas en los sobres aparecerán aquí, cada una en su hueco.</p>
        <button type="button" className="enlace-tinta vacio-boton" onClick={onVerTodas}>
          Ver todo el álbum
        </button>
      </div>
    </div>
  )
}
