import { useRef, useState } from 'react'
import { Carta, Hanko, MarcoJuego, PERSONAJES, ResultadoRonda, SelectorSeries, crearAzar, terminarRonda } from '../comun/index.js'
import {
  MAX_INTENTOS,
  anotarJugado,
  desenfoque,
  intentar,
  intentosRestantes,
  intentosUsados,
  nivel,
  nuevaPartida,
  pedirPista,
  puedePedirPista,
  puntos,
  textoFicha,
} from './reglas.js'
import './revelar-serie.css'

const rng = crearAzar()

/** Qué muestra cada pista y cómo se pide. */
const PISTAS = {
  nombre: { boton: 'El nombre del personaje', kanji: '名' },
  ficha: { boton: 'Año y géneros de la serie', kanji: '暦' },
}

const plural = (n, uno, varios) => (n === 1 ? uno : varios)

/**
 * ¿De qué serie?: la carta de un personaje, muy desenfocada y sin cartela,
 * y cinco intentos para decir de qué serie es. Cada intento gastado (fallo o
 * pista) aclara el arte un paso; al terminar se ve nítida con su nombre y su
 * serie. Acertar da un sobre.
 */
export default function Juego({ juego }) {
  const [partida, setPartida] = useState(() => nuevaPartida(rng))
  const [fin, setFin] = useState(null) // lo que devuelve terminarRonda, más `ganada`
  const [aviso, setAviso] = useState('') // último fallo o pista, para la vista y el lector
  // Personajes ya jugados en esta visita: no se repiten hasta agotar el catálogo.
  const jugados = useRef(new Set([partida.objetivo.id]))

  const { objetivo, serie } = partida
  const restantes = intentosRestantes(partida)
  const usados = intentosUsados(partida)
  const probadas = new Set(partida.intentos.map((i) => i.serie.id))
  const terminada = Boolean(partida.fin)

  function probar(elegida) {
    if (terminada) return
    const siguiente = intentar(partida, elegida)
    if (siguiente === partida) {
      setAviso(`Ya probaste ${elegida.titulo}.`)
      return
    }
    setPartida(siguiente)
    if (siguiente.fin) {
      const ganada = siguiente.fin.ganada
      setAviso('')
      setFin({ ganada, ...terminarRonda(juego, { ganada, puntos: puntos(siguiente) }) })
      return
    }
    const quedan = intentosRestantes(siguiente)
    setAviso(`No es ${elegida.titulo}. ${quedan === 1 ? 'Te queda un intento.' : `Te quedan ${quedan} intentos.`}`)
  }

  function pista(tipo) {
    const siguiente = pedirPista(partida, tipo)
    if (siguiente === partida) return
    setPartida(siguiente)
    setAviso(tipo === 'nombre' ? `Pista: el personaje se llama ${objetivo.nombre}.` : `Pista: la serie es de ${textoFicha(serie)}.`)
  }

  function otraRonda() {
    jugados.current = anotarJugado(jugados.current, objetivo.id, PERSONAJES.length)
    const nueva = nuevaPartida(rng, { excluir: jugados.current })
    jugados.current.add(nueva.objetivo.id)
    setPartida(nueva)
    setFin(null)
    setAviso('')
  }

  const resultado = partida.fin ? (partida.fin.ganada ? 'victoria' : 'derrota') : undefined

  return (
    <MarcoJuego
      juego={juego}
      reglas={
        <ol>
          <li>Ves la carta de un personaje, borrosa y sin nombre ni serie.</li>
          <li>Escribe de qué serie crees que es. Tienes {MAX_INTENTOS} intentos y cada fallo aclara el arte.</li>
          <li>Si te atascas, pide una pista (el nombre del personaje, o el año y los géneros de la serie): cada una cuesta un intento.</li>
          <li>Si aciertas, ganas un sobre extra. Cuanto antes, más puntos.</li>
        </ol>
      }
    >
      <div className="revelar-serie-mesa">
        <figure className="revelar-serie-altar" data-fin={resultado}>
          <div className="revelar-serie-laca">
            <span lang="ja" className="revelar-serie-kanji" aria-hidden="true">
              謎
            </span>
            {/* La carta se tapa a los lectores: su alt diría el nombre y la serie. */}
            <div className="revelar-serie-velo" data-desenfoque={desenfoque(partida)} aria-hidden="true">
              <Carta carta={objetivo} tamano="sobre" enlace={false} cartela={false} prioridad className="revelar-serie-carta" />
            </div>
            <ol className="revelar-serie-faroles" aria-hidden="true">
              {Array.from({ length: MAX_INTENTOS }, (_, i) => (
                <li key={i} className="revelar-serie-farol" data-estado={estadoFarol(partida, i)} />
              ))}
            </ol>
          </div>
          <p className="solo-lectores">
            {terminada
              ? `La carta era ${objetivo.nombre}, de ${serie.titulo}.`
              : `La carta de un personaje con la serie oculta. ${usados} de ${MAX_INTENTOS} intentos gastados.`}
          </p>
          {terminada && (
            <figcaption className="revelar-serie-cartela">
              <span className="rotulo revelar-serie-cartela-rotulo">Era…</span>
              <strong className="revelar-serie-cartela-nombre">{objetivo.nombre}</strong>
              <span className="revelar-serie-cartela-serie">{serie.titulo}</span>
            </figcaption>
          )}
        </figure>

        <div className="revelar-serie-panel">
          <p className="revelar-serie-cuenta">
            <span className="rotulo">{terminada ? 'Ronda terminada' : `Intento ${Math.min(usados + 1, MAX_INTENTOS)} de ${MAX_INTENTOS}`}</span>
            {!terminada && (
              <span className="revelar-serie-restantes">
                <span className="cifra">{restantes}</span> {plural(restantes, 'intento restante', 'intentos restantes')}
              </span>
            )}
          </p>

          <SelectorSeries
            onElegir={probar}
            excluir={probadas}
            desactivado={terminada}
            etiqueta="¿De qué serie es?"
            placeholder="Escribe el título de la serie"
          />

          <div className="revelar-serie-pistas" role="group" aria-label="Pistas, cada una cuesta un intento">
            {Object.entries(PISTAS).map(([tipo, p]) => {
              const usada = partida.pistas.includes(tipo)
              return (
                <button
                  key={tipo}
                  type="button"
                  className="revelar-serie-pista"
                  data-usada={usada || undefined}
                  disabled={!puedePedirPista(partida, tipo)}
                  onClick={() => pista(tipo)}
                >
                  <Hanko kanji={p.kanji} forma="redondo" estilo={usada ? 'lleno' : 'linea'} className="revelar-serie-pista-sello" />
                  <span className="revelar-serie-pista-texto">
                    {p.boton}
                    <small>{usada ? 'Pista usada' : '−1 intento'}</small>
                  </span>
                </button>
              )
            })}
          </div>

          {partida.pistas.length > 0 && (
            <ul className="juego-pistas" aria-label="Lo que ya sabes">
              {partida.pistas.map((tipo) => (
                <li key={tipo} className="juego-pista">
                  {tipo === 'nombre' ? `Se llama ${objetivo.nombre}` : textoFicha(serie)}
                </li>
              ))}
            </ul>
          )}

          {partida.intentos.length > 0 && (
            <ol className="revelar-serie-intentos" aria-label="Tus intentos">
              {partida.intentos.map((intento) => (
                <li key={intento.serie.id} className="revelar-serie-intento" data-acierto={intento.acierto || undefined}>
                  <Hanko
                    kanji={intento.acierto ? '当' : '否'}
                    forma="redondo"
                    estilo={intento.acierto ? 'lleno' : 'linea'}
                    className="revelar-serie-intento-sello"
                    etiqueta={intento.acierto ? 'Acierto' : 'Fallo'}
                  />
                  <span className="revelar-serie-intento-serie">{intento.serie.titulo}</span>
                </li>
              ))}
            </ol>
          )}

          <p className="juego-aviso" data-tono={aviso.startsWith('No es') ? 'fallo' : undefined} aria-live="polite">
            {aviso}
          </p>
        </div>
      </div>

      {fin && (
        <ResultadoRonda
          resultado={fin.ganada ? 'victoria' : 'derrota'}
          titulo={nivel(partida)}
          puntos={puntos(partida)}
          texto={
            fin.ganada
              ? `Era ${objetivo.nombre}, de ${serie.titulo}: ${textoCoste(partida)}. Racha de ${fin.racha}.`
              : `Era ${serie.titulo}: el personaje es ${objetivo.nombre}.`
          }
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraRonda}
        />
      )}
    </MarcoJuego>
  )
}

/** Cada farol es un intento: gastado en un fallo, en una pista, en el acierto o aún libre. */
function estadoFarol(partida, i) {
  const fallos = partida.intentos.filter((x) => !x.acierto).length
  const sucesos = [...Array(fallos).fill('fallo'), ...Array(partida.pistas.length).fill('pista')]
  if (partida.intentos.some((x) => x.acierto)) sucesos.push('acierto')
  return sucesos[i] ?? 'libre'
}

/** «a la primera», «al intento 3, con una pista»… */
function textoCoste(partida) {
  const usados = intentosUsados(partida)
  const pistas = partida.pistas.length
  const base = usados === 1 ? 'a la primera' : `al intento ${usados}`
  if (!pistas) return base
  return `${base}, con ${plural(pistas, 'una pista', `${pistas} pistas`)}`
}
