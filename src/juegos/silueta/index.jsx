import { useState } from 'react'
import { urlPublica } from '../../lib/images.js'
import { BuscadorPersonajes, Carta, Hanko, MarcoJuego, ResultadoRonda, crearAzar, imagenCarta, terminarRonda } from '../comun/index.js'
import {
  MAX_INTENTOS,
  PANELES,
  intentar,
  intentosUsados,
  mismaSerie,
  muestraMismaSerie,
  nuevaRonda,
  panelesAbiertos,
  pistaDisponible,
  puntosDe,
  restantes,
  tituloDe,
  usarPista,
} from './reglas.js'
import './silueta.css'

const rng = crearAzar()
/** Objetivos ya jugados en esta visita: no se repiten hasta agotar los candidatos. */
const jugados = new Set()
const MINIATURA = '40px'
const ARTE = '(min-width: 64rem) 220px, 40vw'

function empezar() {
  const ronda = nuevaRonda(rng, { excluir: jugados })
  jugados.add(ronda.objetivo.id)
  return ronda
}

/**
 * Silueta: la sombra de un personaje tras un biombo de cuatro paneles. Cinco
 * intentos con el buscador; cada fallo abre un panel y deja ver parte del
 * arte real; la pista (la serie) cuesta un intento. Acertar da un sobre.
 */
export default function Juego({ juego }) {
  const [numero, setNumero] = useState(1) // ronda de esta visita, para reiniciar biombo y buscador
  const [estado, setEstado] = useState(empezar)
  const [anuncio, setAnuncio] = useState('')
  const [fin, setFin] = useState(null) // lo que devuelve terminarRonda

  /** Aplica el estado nuevo y, si termina la ronda, la cierra (una sola vez). */
  function avanzar(siguiente) {
    setEstado(siguiente)
    if (siguiente.fin && !fin) {
      const ganada = siguiente.fin === 'victoria'
      setFin(terminarRonda(juego, { ganada, puntos: puntosDe(siguiente) }))
    }
  }

  function elegir(carta) {
    const siguiente = intentar(estado, carta)
    if (siguiente === estado) return
    if (!siguiente.fin) {
      const abiertos = panelesAbiertos(siguiente).length
      setAnuncio(`No es ${carta.nombre}. Panel ${abiertos} de ${PANELES} abierto. Te quedan ${restantes(siguiente)} intentos.`)
    }
    avanzar(siguiente)
  }

  function pedirPista() {
    const siguiente = usarPista(estado)
    if (siguiente === estado) return
    setAnuncio(`Pista: es de ${estado.objetivo.anime}. Te quedan ${restantes(siguiente)} intentos.`)
    avanzar(siguiente)
  }

  function otraRonda() {
    setEstado(empezar())
    setAnuncio('')
    setFin(null)
    setNumero((n) => n + 1)
  }

  const { objetivo } = estado
  const usados = intentosUsados(estado)
  const quedan = restantes(estado)
  const abiertos = panelesAbiertos(estado)
  const probados = new Set(estado.intentos.map((c) => c.id))
  const conMarcaDeSerie = muestraMismaSerie(estado)
  const ganada = estado.fin === 'victoria'

  // Las cinco ranuras: los personajes probados, la pista en el momento en que se pidió y las que quedan vacías.
  const ranuras = estado.intentos.map((carta) => ({ tipo: 'intento', carta }))
  if (estado.pista) ranuras.splice(estado.pistaEn, 0, { tipo: 'pista' })
  while (ranuras.length < MAX_INTENTOS) ranuras.push({ tipo: 'vacia' })

  return (
    <MarcoJuego
      juego={juego}
      cabecera={
        <p className="silueta-cabecera">
          {estado.fin ? `Ronda terminada en ${usados} ${usados === 1 ? 'intento' : 'intentos'}.` : `Intento ${usados + 1} de ${MAX_INTENTOS}.`}
        </p>
      }
      reglas={
        <ol>
          <li>Tras el biombo solo se ve la sombra del personaje. Tienes cinco intentos para decir quién es.</li>
          <li>Cada fallo abre un panel del biombo y deja ver un trozo del arte real.</li>
          <li>La pista te dice la serie, pero cuesta un intento (y abre un panel). No se puede pedir como último intento.</li>
          <li>A partir del segundo intento, los que compartan serie con el personaje llevan una marca dorada.</li>
          <li>Si aciertas antes de agotar los intentos, ganas un sobre extra.</li>
        </ol>
      }
    >
      <div className="silueta-mesa">
        <Biombo key={numero} estado={estado} abiertos={abiertos} />

        <div className="silueta-mando">
          <BuscadorPersonajes
            key={numero}
            onElegir={elegir}
            excluir={probados}
            desactivado={Boolean(estado.fin)}
            autoEnfocar={numero > 1}
            etiqueta="¿Quién se esconde?"
            placeholder="Escribe un nombre o una serie"
          />

          <div className="juego-fila silueta-fila">
            <button type="button" className="boton silueta-pista" disabled={!pistaDisponible(estado)} onClick={pedirPista}>
              <span className="silueta-pista-kanji" lang="ja" aria-hidden="true">
                助
              </span>
              {estado.pista ? 'Pista usada' : 'Pista: la serie (gasta 1 intento)'}
            </button>
            <p className="silueta-restantes">
              <span className="cifra">{quedan}</span> {quedan === 1 ? 'intento' : 'intentos'}
            </p>
          </div>

          {estado.pista && (
            <ul className="juego-pistas" aria-label="Pistas">
              <li className="juego-pista">Serie: {objetivo.anime}</li>
            </ul>
          )}

          <ol className="silueta-intentos" aria-label="Tus intentos">
            {ranuras.map((ranura, i) => (
              <li
                key={i}
                className="silueta-intento"
                data-tipo={ranura.tipo}
                data-estado={ranura.carta ? (ranura.carta.id === objetivo.id ? 'acierto' : 'fallo') : undefined}
              >
                <span className="silueta-intento-numero cifra" aria-hidden="true">
                  {i + 1}
                </span>
                {ranura.tipo === 'intento' && (
                  <Intento carta={ranura.carta} acierto={ranura.carta.id === objetivo.id} marca={conMarcaDeSerie && mismaSerie(estado, ranura.carta)} />
                )}
                {ranura.tipo === 'pista' && <span className="silueta-intento-texto">Pista: {objetivo.anime}</span>}
                {ranura.tipo === 'vacia' && <span className="solo-lectores">Sin usar</span>}
              </li>
            ))}
          </ol>

          <p className="solo-lectores" aria-live="polite">
            {anuncio}
          </p>
        </div>
      </div>

      {fin && (
        <ResultadoRonda
          resultado={ganada ? 'victoria' : 'derrota'}
          titulo={tituloDe(estado)}
          puntos={ganada ? puntosDe(estado) : undefined}
          texto={
            ganada
              ? `Era ${objetivo.nombre}, de ${objetivo.anime}: ${usados === 1 ? 'a la primera' : `en ${usados} intentos`}${estado.pista ? ', con pista' : ''}.`
              : `Era ${objetivo.nombre}, de ${objetivo.anime}.`
          }
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraRonda}
        >
          <Carta carta={objetivo} tamano="dia" prioridad className="silueta-respuesta" />
        </ResultadoRonda>
      )}
    </MarcoJuego>
  )
}

/** Una fila de «Tus intentos»: miniatura, nombre, serie y marcas. */
function Intento({ carta, acierto, marca }) {
  const img = imagenCarta(carta)
  return (
    <>
      <img className="silueta-intento-miniatura" src={img.src} srcSet={img.srcSet} sizes={MINIATURA} alt="" loading="lazy" decoding="async" />
      <span className="silueta-intento-texto">
        <span className="silueta-intento-nombre">{carta.nombre}</span>
        <span className="silueta-intento-serie">{carta.anime}</span>
      </span>
      {marca && (
        <span className="silueta-misma" role="img" aria-label="Misma serie que el personaje oculto">
          ✦
        </span>
      )}
      <span className="silueta-intento-marca" role="img" aria-label={acierto ? 'Acierto' : 'Fallo'}>
        {acierto ? '✓' : '✗'}
      </span>
    </>
  )
}

/**
 * El biombo: luz de vela, la silueta detrás de cuatro paneles de washi y, bajo
 * cada panel abierto, el trozo de arte real. Las imágenes son decorativas: la
 * respuesta la dan los textos. El arte solo entra en el DOM cuando se abre el
 * primer panel: antes, la única imagen que viaja es la silueta.
 */
function Biombo({ estado, abiertos }) {
  const { objetivo, fin } = estado
  const arte = abiertos.length > 0 ? imagenCarta(objetivo) : null
  return (
    <figure className="silueta-biombo" data-fin={fin ?? undefined}>
      <div className="silueta-luz" />
      <div className="silueta-luz silueta-luz--vaiven" />
      <div className="silueta-paneles" aria-hidden="true">
        {Array.from({ length: PANELES }, (_, i) => (
          <div key={i} className="silueta-columna" data-abierto={abiertos.includes(i) || undefined}>
            <div className="silueta-ventana">
              <img className="silueta-sombra" src={urlPublica(`img/siluetas/${objetivo.id}.webp`)} alt="" decoding="async" draggable="false" />
              {arte && <img className="silueta-arte" src={arte.src} srcSet={arte.srcSet} sizes={ARTE} alt="" decoding="async" draggable="false" />}
            </div>
            <div className="silueta-panel" />
          </div>
        ))}
      </div>
      <span className="silueta-fuda" lang="ja" aria-hidden="true">
        影
      </span>
      {fin === 'victoria' && (
        <>
          <figcaption className="silueta-placa silueta-placa--victoria">
            <span className="rotulo">Acertaste. Era…</span>
            <strong>{objetivo.nombre}</strong>
            <span>{objetivo.anime}</span>
          </figcaption>
          <Hanko kanji="当" etiqueta="Acierto" className="silueta-sello" />
        </>
      )}
      {fin === 'derrota' && (
        <figcaption className="silueta-placa silueta-placa--derrota">
          <span className="rotulo">La sombra guardó su secreto. Era…</span>
          <strong>{objetivo.nombre}</strong>
          <span>{objetivo.anime}</span>
        </figcaption>
      )}
    </figure>
  )
}
