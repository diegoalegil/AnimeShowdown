import { useEffect, useState } from 'react'
import { Carta, Hanko, MarcoJuego, ResultadoRonda, crearAzar, movimientoReducido, terminarRonda } from '../comun/index.js'
import {
  MAX_ERRORES,
  destapar,
  estadoDelNaipe,
  estadoInicial,
  formatoTiempo,
  hayFallo,
  iniciales,
  nuevoTablero,
  puntuacion,
  taparFallo,
} from './reglas.js'
import './nexo.css'

const rng = crearAzar()
/** Cuánto se ven las dos cartas que no casan antes de volver a taparse. */
const ESPERA_FALLO = 1100

/**
 * Nexo: ocho naipes lacados boca abajo con el nombre a la vista; se destapan
 * de dos en dos y los de la misma serie quedan unidos. Con tres errores o
 * menos al cerrar las cuatro parejas, sobre extra.
 */
export default function Juego({ juego }) {
  const [tablero, setTablero] = useState(() => nuevoTablero(rng))
  const [estado, setEstado] = useState(estadoInicial)
  const [inicio, setInicio] = useState(null) // marca de tiempo del primer naipe
  const [cierre, setCierre] = useState(null) // marca de tiempo del fin
  const [ahora, setAhora] = useState(null)
  const [fin, setFin] = useState(null) // lo que devuelve terminarRonda, más puntos
  const [aviso, setAviso] = useState('')

  const segundos = inicio === null ? 0 : ((cierre ?? ahora ?? inicio) - inicio) / 1000

  // El reloj corre desde el primer naipe hasta que acaba la ronda. Las marcas
  // son las de los eventos (timeStamp), en la misma base que performance.now().
  useEffect(() => {
    if (inicio === null || cierre) return undefined
    const reloj = setInterval(() => setAhora(performance.now()), 500)
    return () => clearInterval(reloj)
  }, [inicio, cierre])

  // Las dos que no casan vuelven a taparse solas tras un instante.
  useEffect(() => {
    if (!hayFallo(estado)) return undefined
    const espera = setTimeout(() => setEstado(taparFallo), ESPERA_FALLO)
    return () => clearTimeout(espera)
  }, [estado])

  /** Destapa el naipe `indice`; `momento` es el timeStamp del evento. */
  function elegir(indice, momento) {
    if (fin) return
    const siguiente = destapar(tablero, estado, indice)
    if (siguiente === estado) return
    if (inicio === null) setInicio(momento)
    setEstado(siguiente)

    const naipe = tablero.naipes[indice]
    if (siguiente.destapadas.length === 1) {
      setAviso(`${naipe.carta.nombre} destapada. Elige su pareja.`)
    } else if (siguiente.unidas.length > estado.unidas.length) {
      setAviso(`Nexo: ${naipe.carta.anime}. ${siguiente.unidas.length} de ${tablero.parejas.length} parejas.`)
    } else {
      setAviso(`No comparten serie. Error ${siguiente.errores} de ${MAX_ERRORES}.`)
    }

    if (siguiente.fin) {
      setCierre(momento)
      const ganada = siguiente.fin === 'victoria'
      const puntos = puntuacion(siguiente, inicio === null ? 0 : (momento - inicio) / 1000)
      setFin({ ganada, puntos, ...terminarRonda(juego, { ganada, puntos }) })
    }
  }

  function otraRonda() {
    setTablero(nuevoTablero(rng))
    setEstado(estadoInicial())
    setInicio(null)
    setCierre(null)
    setAhora(null)
    setFin(null)
    setAviso('')
  }

  // Teclas 1–8 destapan el naipe correspondiente.
  function porTecla(evento) {
    const n = Number(evento.key)
    if (!Number.isInteger(n) || n < 1 || n > tablero.naipes.length) return
    evento.preventDefault()
    elegir(n - 1, evento.timeStamp)
  }

  const reducido = movimientoReducido()
  const todoALaVista = estado.fin === 'derrota'

  return (
    <MarcoJuego
      juego={juego}
      reglas={
        <ol>
          <li>Ocho cartas boca abajo con el nombre del personaje a la vista: cuatro series, dos personajes de cada una.</li>
          <li>Destapa dos. Si son de la misma serie quedan unidas y se ve su arte; si no, se tapan de nuevo.</li>
          <li>Cierra las cuatro parejas con tres errores o menos y ganas un sobre extra. Al cuarto error se acaba la ronda.</li>
          <li>Cuanto más rápido y con menos errores, más puntos. Con el teclado, las teclas 1 a 8 destapan cada carta.</li>
        </ol>
      }
      cabecera={
        <p className="nexo-marcas" aria-label="Marcha de la ronda">
          <span className="nexo-marca">
            <span className="rotulo">Intentos</span> <strong className="cifra">{estado.intentos}</strong>
          </span>
          <span className="nexo-marca" data-tono={estado.errores >= MAX_ERRORES ? 'limite' : undefined}>
            <span className="rotulo">Errores</span>{' '}
            <strong className="cifra">
              {Math.min(estado.errores, MAX_ERRORES)}
              <span className="nexo-marca-de"> / {MAX_ERRORES}</span>
            </strong>
          </span>
          <span className="nexo-marca">
            <span className="rotulo">Tiempo</span> <strong className="cifra">{formatoTiempo(segundos)}</strong>
          </span>
        </p>
      }
    >
      <div className="nexo-mesa" data-reducido={reducido || undefined} onKeyDown={porTecla}>
        <ul className="nexo-tablero" aria-label="Tablero de ocho cartas">
          {tablero.naipes.map((naipe) => {
            const situacion = estadoDelNaipe(tablero, estado, naipe.indice)
            const bocaArriba = situacion !== 'tapada'
            const bloqueada = situacion === 'unida' || Boolean(fin)
            return (
              <li key={naipe.carta.id}>
                <button
                  type="button"
                  className="nexo-naipe"
                  data-estado={situacion}
                  aria-pressed={situacion === 'destapada' || situacion === 'fallo'}
                  aria-disabled={bloqueada || undefined}
                  aria-label={`Carta ${naipe.indice + 1}, ${naipe.carta.nombre}, ${describe(situacion, naipe)}`}
                  onClick={(evento) => (bloqueada ? undefined : elegir(naipe.indice, evento.timeStamp))}
                >
                  <span className="nexo-giro" aria-hidden="true">
                    <span className="nexo-dorso">
                      <span className="nexo-dorso-kanji" lang="ja">結</span>
                      <span className="nexo-dorso-numero cifra">{naipe.indice + 1}</span>
                      <span className="nexo-dorso-iniciales">{iniciales(naipe.carta.nombre)}</span>
                      <span className="nexo-dorso-nombre">{naipe.carta.nombre}</span>
                    </span>
                    <span className="nexo-cara">
                      {bocaArriba && <Carta carta={naipe.carta} tamano="sobre" enlace={false} cartela={false} prioridad />}
                      {situacion === 'unida' && <Hanko kanji="結" className="nexo-sello" />}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <ol className="nexo-parejas" aria-label="Parejas">
          {tablero.parejas.map(({ serie, personajes }) => {
            const cerrada = todoALaVista || estado.unidas.includes(serie.id)
            return (
              <li key={serie.id} className="nexo-pareja" data-cerrada={cerrada || undefined}>
                {cerrada ? (
                  <>
                    <span className="nexo-pareja-serie">{serie.titulo}</span>
                    <span className="nexo-pareja-nombres">{personajes.map((c) => c.nombre).join(' + ')}</span>
                  </>
                ) : (
                  <>
                    <span className="nexo-pareja-serie nexo-pareja-serie--oculta">Lazo pendiente</span>
                    <span className="nexo-pareja-nombres">Encuentra la pareja en el tablero.</span>
                  </>
                )}
              </li>
            )
          })}
        </ol>

        <p className="solo-lectores" aria-live="polite">
          {aviso}
        </p>
      </div>

      {fin && (
        <ResultadoRonda
          resultado={fin.ganada ? 'victoria' : 'derrota'}
          titulo={fin.ganada ? `Nexo cerrado en ${estado.intentos} intentos` : 'El lazo se rompió'}
          texto={
            fin.ganada
              ? `${estado.errores} ${estado.errores === 1 ? 'error' : 'errores'} en ${formatoTiempo(segundos)}. Racha de ${fin.racha}.`
              : `Cuatro errores en ${formatoTiempo(segundos)}. Estas eran las parejas:`
          }
          puntos={fin.puntos}
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraRonda}
          etiquetaOtra="Otro tablero"
        >
          <ul className="nexo-resumen">
            {tablero.parejas.map(({ serie, personajes }) => (
              <li key={serie.id}>
                <span className="nexo-pareja-serie">{serie.titulo}</span>
                <span className="nexo-pareja-nombres">{personajes.map((c) => c.nombre).join(' + ')}</span>
              </li>
            ))}
          </ul>
        </ResultadoRonda>
      )}
    </MarcoJuego>
  )
}

/** Cómo está el naipe, para el lector de pantalla (la serie solo si ya está unida). */
function describe(situacion, naipe) {
  if (situacion === 'unida') return `unida: ${naipe.carta.anime}`
  if (situacion === 'fallo') return 'destapada, no casa'
  if (situacion === 'destapada') return 'destapada'
  return 'boca abajo'
}
