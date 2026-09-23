import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { Hoja } from '../components/Album.jsx'
import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { busquedaAlbum, crearHojas, etiquetaHoja, filtrarHojas, fraccion, leerFiltrosAlbum, porcentaje, progreso } from '../lib/album.js'
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
  const { tengo } = useColeccion()
  const { search } = useLocation()
  const navigate = useNavigate()
  const tipo = useNavigationType()
  const album = useInclinacion()
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

  function cambiar(cambios) {
    navigate({ search: busquedaAlbum({ ...filtros, ...cambios }) }, { replace: true })
    // Si se estaba lejos, el álbum filtrado se ve desde el principio.
    const inicio = album.current?.getBoundingClientRect().top
    if (inicio !== undefined && inicio < 0) window.scrollBy(0, inicio - 96)
  }

  return (
    <div className="coleccion">
      <div className="wrap coleccion-cabecera">
        <TituloSeccion ja="コレクション" sub="Tu colección se guarda en este navegador, sin cuenta.">
          Colección
        </TituloSeccion>
        {vacia ? <AlbumVacio /> : <Marcador cuenta={cuenta} />}
      </div>

      <FiltrosAlbum filtros={filtros} cuenta={cuenta} mostradas={hojas.length} onCambiar={cambiar} />

      <div ref={album} className="album">
        {(visibles.length > 0 || !hojas.length) && (
          <div className="wrap album-series">
            {visibles.map((hoja) => (
              <Hoja key={hoja.id} hoja={hoja} tengo={tengo} />
            ))}
            {!hojas.length && <SinSeries onVerTodas={() => cambiar({ empezadas: false })} />}
          </div>
        )}

        {especiales && todasMontadas && (
          <div className="yoru album-noche">
            <EtiquetaVertical ja="特別" className="album-noche-fondo" />
            <div className="wrap">
              <Hoja hoja={especiales} tengo={tengo} />
            </div>
          </div>
        )}
      </div>
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
      </div>
    </section>
  )
}

/** Barra fija: ir a una serie o ver solo las empezadas. */
function FiltrosAlbum({ filtros, cuenta, mostradas, onCambiar }) {
  const { porHoja } = cuenta
  const filtrado = Boolean(filtros.serie || filtros.empezadas)

  return (
    <search className="filtros" aria-label="Filtrar el álbum">
      <div className="wrap filtros-fila album-filtros">
        <label className="campo">
          <span className="campo-etiqueta">Serie</span>
          <select value={filtros.serie} onChange={(e) => onCambiar({ serie: e.target.value })}>
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
            <span className="cifra">{mostradas}</span> {mostradas === 1 ? 'hoja' : 'hojas'}
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
