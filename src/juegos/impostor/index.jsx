import { useCallback, useEffect, useRef, useState } from 'react'
import { Carta, Hanko, MarcoJuego, ResultadoRonda, crearAzar, imagenCarta, terminarRonda } from '../comun/index.js'
import { RONDAS, SEGUNDOS, esAcierto, nuevaPartida, puntosDeRonda, resumenDe } from './reglas.js'
import './impostor.css'

const rng = crearAzar()
/** Cuánto esperamos a que carguen las cinco ilustraciones antes de arrancar el reloj. */
const ESPERA_IMAGENES = 2500
const TECLAS = ['1', '2', '3', '4', '5']

/** Precarga las ilustraciones de una ronda; resuelve al cargar todas o al agotar la espera. */
function precargar(cartas) {
  const cargas = cartas.map(
    (carta) =>
      new Promise((listo) => {
        const img = new Image()
        img.onload = img.onerror = () => listo()
        img.src = imagenCarta(carta).src
      }),
  )
  return Promise.race([Promise.all(cargas), new Promise((listo) => setTimeout(listo, ESPERA_IMAGENES))])
}

/**
 * Impostor: tres rondas de cinco cartas, cuatro de una serie y un intruso.
 * 15 s por ronda; el trial solo se gana acertando las tres.
 *
 * Fases: 'preparando' (cargan las imágenes) → 'jugando' (corre el reloj) →
 * 'revelado' (se destapa el intruso) → siguiente ronda, o 'fin' tras la tercera.
 */
export default function Juego({ juego }) {
  const [rondas, setRondas] = useState(() => nuevaPartida(rng))
  const [indice, setIndice] = useState(0)
  const [fase, setFase] = useState('preparando')
  const [resultados, setResultados] = useState([]) // { acierto, puntos, idElegida }
  const [segundos, setSegundos] = useState(SEGUNDOS)
  const [fin, setFin] = useState(null) // resumen + lo que devuelve terminarRonda
  const limite = useRef(0) // instante (ms) en que se agota la ronda
  const botonSiguiente = useRef(null)

  const ronda = rondas[indice]
  const resultado = resultados[indice]
  const jugando = fase === 'jugando'
  const critico = jugando && segundos <= 5

  /** Cierra la ronda con la carta elegida (null si se agotó el tiempo). */
  const resolver = useCallback(
    (idElegida) => {
      if (fase !== 'jugando') return
      const acierto = esAcierto(ronda, idElegida)
      const restantes = (limite.current - Date.now()) / 1000
      setSegundos(Math.max(0, Math.ceil(restantes))) // el reloj se queda donde se paró
      setResultados((lista) => [...lista, { acierto, puntos: puntosDeRonda(acierto, restantes), idElegida }])
      setFase('revelado')
    },
    [fase, ronda],
  )

  // Al entrar en una ronda: precarga sus ilustraciones y después arranca el reloj.
  useEffect(() => {
    if (fase !== 'preparando' || !ronda) return
    let vigente = true
    precargar(ronda.cartas).then(() => {
      if (!vigente) return
      limite.current = Date.now() + SEGUNDOS * 1000
      setSegundos(SEGUNDOS)
      setFase('jugando')
    })
    return () => {
      vigente = false
    }
  }, [fase, ronda])

  // El reloj va por hora de pared: esconder la pestaña no lo para.
  useEffect(() => {
    if (fase !== 'jugando') return
    const comprobar = () => {
      const quedan = Math.max(0, Math.ceil((limite.current - Date.now()) / 1000))
      setSegundos(quedan)
      if (quedan <= 0) resolver(null)
    }
    const intervalo = setInterval(comprobar, 200)
    document.addEventListener('visibilitychange', comprobar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', comprobar)
    }
  }, [fase, resolver])

  // Teclas 1–5 para elegir carta sin ratón.
  useEffect(() => {
    if (fase !== 'jugando') return
    const alPulsar = (e) => {
      const i = TECLAS.indexOf(e.key)
      if (i === -1 || e.metaKey || e.ctrlKey || e.altKey) return
      const carta = ronda.cartas[i]
      if (carta) resolver(carta.id)
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [fase, ronda, resolver])

  // Al revelar, el foco pasa al botón que sigue (la carta pulsada queda desactivada).
  useEffect(() => {
    if (fase === 'revelado') botonSiguiente.current?.focus({ preventScroll: true })
  }, [fase])

  function siguiente() {
    if (indice + 1 < rondas.length) {
      setIndice(indice + 1)
      setFase('preparando')
      return
    }
    const resumen = resumenDe(resultados)
    setFin({ ...resumen, ...terminarRonda(juego, { ganada: resumen.ganada, puntos: resumen.puntos }) })
    setFase('fin')
  }

  function otraPartida() {
    setRondas(nuevaPartida(rng))
    setIndice(0)
    setResultados([])
    setFin(null)
    setFase('preparando')
  }

  if (!ronda) {
    return (
      <MarcoJuego juego={juego}>
        <p className="juego-aviso">El catálogo no da para una ronda.</p>
      </MarcoJuego>
    )
  }

  const estadoDe = (carta) => {
    if (!resultado) return undefined
    if (carta.id === ronda.impostor.id) return 'intruso'
    return carta.id === resultado.idElegida ? 'fallo' : 'propio'
  }

  const anuncio = (() => {
    if (fase === 'preparando') return `Ronda ${indice + 1} de ${RONDAS}. Serie base: ${ronda.serie.titulo}. Preparando las cartas.`
    if (fase === 'jugando') return `Ronda ${indice + 1}. Quince segundos. Elige al intruso.`
    if (resultado) {
      const quien = `${ronda.impostor.nombre}, de ${ronda.impostor.anime}`
      if (resultado.acierto) return `Acertaste. El intruso era ${quien}.`
      if (resultado.idElegida == null) return `Se acabó el tiempo. El intruso era ${quien}.`
      return `Fallo. El intruso era ${quien}.`
    }
    return ''
  })()

  return (
    <MarcoJuego
      juego={juego}
      cabecera={
        <ol className="impostor-progreso" aria-label="Rondas del trial">
          {rondas.map((r, i) => {
            const res = resultados[i]
            const estado = res ? (res.acierto ? 'acierto' : 'fallo') : i === indice ? 'actual' : undefined
            return (
              <li key={r.serie.id} className="impostor-paso cifra" data-estado={estado}>
                <span className="solo-lectores">Ronda </span>
                {i + 1}
                {res && <span className="solo-lectores">{res.acierto ? ': acertada' : ': fallada'}</span>}
              </li>
            )
          })}
        </ol>
      }
      reglas={
        <ol>
          <li>Cinco cartas: cuatro son de la serie base y una se ha colado de otra.</li>
          <li>Tienes 15 segundos por ronda para señalar al intruso (también con las teclas 1 a 5). Si se agota el tiempo, la ronda se pierde.</li>
          <li>Tres rondas. Solo si aciertas las tres ganas el sobre.</li>
        </ol>
      }
    >
      <div className="impostor-mesa" data-fase={fase}>
        <span lang="ja" className="impostor-fondo" aria-hidden="true">
          裏
        </span>

        <div className="impostor-barra">
          <p className="impostor-serie">
            <span className="rotulo">Serie base</span>
            <strong>{ronda.serie.titulo}</strong>
          </p>
          <p className="impostor-reloj cifra" data-critico={critico || undefined} aria-hidden="true">
            0:{String(fase === 'preparando' ? SEGUNDOS : segundos).padStart(2, '0')}
          </p>
          <div
            className="impostor-tiempo"
            role="progressbar"
            aria-label="Tiempo restante"
            aria-valuemin={0}
            aria-valuemax={SEGUNDOS}
            aria-valuenow={fase === 'preparando' ? SEGUNDOS : segundos}
            aria-valuetext={`${segundos} segundos`}
          >
            {/* La mecha: una barra que se consume en 15 s (solo transform). Se reinicia con la ronda. */}
            <span key={`${indice}-${fase === 'preparando'}`} className="impostor-mecha" data-critico={critico || undefined} />
          </div>
        </div>

        <ul className="impostor-cartas" aria-label="Las cinco cartas">
          {ronda.cartas.map((carta, i) => {
            const estado = estadoDe(carta)
            return (
              <li key={carta.id} className="impostor-puesto" data-estado={estado} style={{ '--orden': i }}>
                <button
                  type="button"
                  className="impostor-carta"
                  aria-label={carta.nombre}
                  aria-pressed={resultado ? resultado.idElegida === carta.id : undefined}
                  disabled={!jugando}
                  onClick={() => resolver(carta.id)}
                >
                  <span className="impostor-giro">
                    {/* Las cartas van sin cartela y tapadas al lector: su alt diría la serie. */}
                    <span className="impostor-cara" aria-hidden="true">
                      <Carta carta={carta} tamano="sobre" enlace={false} cartela={false} prioridad />
                    </span>
                    <span className="impostor-dorso" aria-hidden="true">
                      <Hanko kanji="裏" forma="cuadrado" className="impostor-sello" />
                      <span className="impostor-dorso-texto">{carta.anime}</span>
                    </span>
                  </span>
                  <span className="impostor-nombre">
                    <kbd className="impostor-tecla" aria-hidden="true">
                      {i + 1}
                    </kbd>
                    {carta.nombre}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="solo-lectores" aria-live="polite">
          {anuncio}
        </p>

        {fase === 'revelado' && resultado && (
          <div className="impostor-revelado">
            <p className="juego-aviso" data-tono={resultado.acierto ? 'acierto' : 'fallo'}>
              {resultado.acierto ? '¡Acertaste! ' : resultado.idElegida == null ? 'Se acabó el tiempo. ' : 'Esa sí era de la serie. '}
              El intruso era <strong>{ronda.impostor.nombre}</strong>, de <strong>{ronda.impostor.anime}</strong>.
              {resultado.acierto && <span className="impostor-puntos cifra"> +{resultado.puntos}</span>}
            </p>
            <button ref={botonSiguiente} type="button" className="boton boton--principal" onClick={siguiente}>
              {indice + 1 < rondas.length ? `Ronda ${indice + 2}` : 'Ver el veredicto'}
            </button>
          </div>
        )}
      </div>

      {fase === 'fin' && fin && (
        <ResultadoRonda
          resultado={fin.ganada ? 'victoria' : 'derrota'}
          titulo={fin.ganada ? 'Detective infalible' : fin.aciertos === 2 ? 'Casi: buen ojo' : fin.rango}
          texto={
            fin.ganada
              ? `Tres de tres. Racha de ${fin.racha}.`
              : `${fin.aciertos} de ${RONDAS} intrusos descubiertos. El sobre pide los tres.`
          }
          puntos={fin.puntos}
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraPartida}
          etiquetaOtra="Otro trial"
        >
          <ul className="impostor-veredicto" aria-label="Los intrusos de este trial">
            {rondas.map((r, i) => (
              <li key={r.serie.id} data-estado={resultados[i]?.acierto ? 'acierto' : 'fallo'}>
                <span className="cifra">{i + 1}</span> {r.impostor.nombre} <span className="impostor-veredicto-serie">({r.impostor.anime}) entre {r.serie.titulo}</span>
              </li>
            ))}
          </ul>
        </ResultadoRonda>
      )}
    </MarcoJuego>
  )
}
