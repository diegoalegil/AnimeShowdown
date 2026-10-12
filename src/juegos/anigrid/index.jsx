import { useEffect, useState } from 'react'
import {
  BuscadorPersonajes,
  Carta,
  MarcoJuego,
  ResultadoRonda,
  crearAzar,
  imagenCarta,
  movimientoReducido,
  terminarRonda,
} from '../comun/index.js'
import {
  COLUMNAS,
  MAX_INTENTOS,
  anioDe,
  describirIntento,
  intentar,
  intentosRestantes,
  intentosUsados,
  nuevaPartida,
  pedirPista,
  puedePedirPista,
  puntosDe,
  textoFicha,
  tonoDe,
} from './reglas.js'
import './anigrid.css'

const rng = crearAzar()
// Secretos ya jugados en esta sesión: no se repiten hasta recargar.
const jugados = new Set()
// El panel de resultado espera a que las fichas terminen de girar.
const ESPERA_FIN_MS = 900

const SIMBOLO_GENERO = { F: '♀', M: '♂' }
const FLECHA = { anterior: '↓', posterior: '↑', mas: '↑', menos: '↓' }

/** Favoritos en corto: 12 400 → «12k». */
function favsEnCorto(favs) {
  if (!Number.isInteger(favs) || favs <= 0) return '?'
  return favs >= 1000 ? `${Math.round(favs / 1000)}k` : String(favs)
}

/** El dorso de una ficha: el dato del intento y, en año y popularidad, hacia dónde está el secreto. */
function dorsoDe(clave, comparacion) {
  const valor = comparacion[clave]
  const { carta } = comparacion
  switch (clave) {
    case 'inicial':
      return { simbolo: carta.nombre.trim().charAt(0).toUpperCase() || '?' }
    case 'serie':
      return { simbolo: valor === 'igual' ? '=' : '≠' }
    case 'genero':
      return { simbolo: SIMBOLO_GENERO[carta.genero] ?? '?' }
    case 'anio':
      return { simbolo: valor === 'desconocido' ? '?' : valor === 'igual' ? '=' : FLECHA[valor], nota: anioDe(carta) }
    case 'popularidad':
      return { simbolo: valor === 'desconocido' ? '?' : valor === 'igual' ? '≈' : FLECHA[valor], nota: favsEnCorto(carta.favs) }
    default:
      return { simbolo: '?' }
  }
}

/**
 * AniGrid: un personaje secreto y seis intentos. Cada intento deja una fila
 * de fichas lacadas que lo comparan con el secreto; acertar da un sobre.
 */
export default function Juego({ juego }) {
  const [partida, setPartida] = useState(() => nuevaPartida(rng, { excluir: jugados }))
  const [anuncio, setAnuncio] = useState('')
  const [pendiente, setPendiente] = useState(null) // lo que devolvió terminarRonda, hasta que se muestra
  const [fin, setFin] = useState(null)

  useEffect(() => {
    if (!pendiente) return undefined
    const espera = setTimeout(() => setFin(pendiente), movimientoReducido() ? 0 : ESPERA_FIN_MS)
    return () => clearTimeout(espera)
  }, [pendiente])

  function elegir(carta) {
    const siguiente = intentar(partida, carta)
    if (siguiente === partida) return
    setPartida(siguiente)
    setAnuncio(describirIntento(siguiente.intentos.at(-1), siguiente.intentos.length))
    if (siguiente.fin) {
      const ganada = siguiente.fin === 'victoria'
      setPendiente({ ganada, ...terminarRonda(juego, { ganada, puntos: puntosDe(siguiente) }) })
    }
  }

  function pista() {
    const siguiente = pedirPista(partida, rng)
    if (siguiente === partida) return
    setPartida(siguiente)
    const { posicion, letra, total } = siguiente.pista
    setAnuncio(`Pista: el nombre tiene ${total} letras y la letra ${posicion} es ${letra}. Te queda un intento menos.`)
  }

  function otraRonda() {
    jugados.add(partida.secreto.id)
    setPartida(nuevaPartida(rng, { excluir: jugados }))
    setAnuncio('')
    setPendiente(null)
    setFin(null)
  }

  const usados = intentosUsados(partida)
  const restantes = intentosRestantes(partida)
  const probados = new Set(partida.intentos.map((i) => i.carta.id))
  const terminada = Boolean(partida.fin)
  const vacias = Math.max(0, MAX_INTENTOS - usados)
  const { secreto } = partida

  return (
    <MarcoJuego
      juego={juego}
      cabecera={
        <p className="anigrid-contador">
          {terminada ? (
            <>
              Ronda terminada en <span className="cifra">{usados}</span> de {MAX_INTENTOS}
            </>
          ) : (
            <>
              Te {restantes === 1 ? 'queda' : 'quedan'} <span className="cifra">{restantes}</span> de {MAX_INTENTOS} intentos
            </>
          )}
        </p>
      }
      reglas={
        <>
          <p>Hay un personaje secreto. Tienes seis intentos para dar con él.</p>
          <ol>
            <li>Escribe un nombre y elige un personaje: aparece una fila de fichas que lo comparan con el secreto.</li>
            <li>
              <strong>Oro</strong>: coincide (misma inicial, misma serie, mismo género, mismo año de estreno). <strong>Cian</strong>:
              popularidad parecida. Ceniza: no coincide.
            </li>
            <li>
              En año y popularidad, la flecha señala al secreto: <strong>↑</strong> es posterior o más popular; <strong>↓</strong>, anterior
              o menos popular. Un <strong>?</strong> es que falta el dato.
            </li>
            <li>Si te atascas, pide una letra del nombre (nunca la primera): cuesta un intento.</li>
            <li>Si aciertas en seis intentos o menos, ganas un sobre extra.</li>
          </ol>
        </>
      }
    >
      <div className="anigrid-mesa">
        <section className="anigrid-bandeja" aria-label="Tablero de intentos">
          <ul className="anigrid-columnas" aria-hidden="true">
            <li lang="ja" className="anigrid-rotulo">
              六手で当てよ
            </li>
            {COLUMNAS.map((c) => (
              <li key={c.clave} className="anigrid-columna">
                <span lang="ja" className="anigrid-columna-kanji">
                  {c.kanji}
                </span>
                <span className="anigrid-columna-nombre">{c.etiqueta}</span>
              </li>
            ))}
          </ul>

          <ol className="anigrid-filas">
            {partida.intentos.map((comparacion, i) => (
              <Fila key={comparacion.carta.id} comparacion={comparacion} numero={i + 1} viva={i === partida.intentos.length - 1} />
            ))}
            {Array.from({ length: vacias }, (_, i) => (
              <li key={`vacia-${i}`} className="anigrid-fila" data-estado="vacia">
                <p className="anigrid-intento anigrid-intento--vacio">Intento {partida.intentos.length + i + 1}</p>
                <FichasVacias />
              </li>
            ))}
            {partida.pista && (
              <li className="anigrid-fila" data-estado="pista">
                <p className="anigrid-intento anigrid-intento--vacio">Gastado en la pista</p>
                <FichasVacias simbolo="字" />
              </li>
            )}
          </ol>
        </section>

        <ul className="anigrid-leyenda" aria-label="Leyenda">
          <li>
            <span className="anigrid-muestra" data-tono="oro" aria-hidden="true" /> Coincide
          </li>
          <li>
            <span className="anigrid-muestra" data-tono="cian" aria-hidden="true" /> Popularidad parecida
          </li>
          <li>
            <span className="anigrid-muestra" data-tono="ceniza" aria-hidden="true" /> No coincide
          </li>
          <li>
            <span className="anigrid-muestra anigrid-muestra--texto" aria-hidden="true">
              ↑↓
            </span>{' '}
            Hacia dónde está el secreto
          </li>
        </ul>

        {partida.pista && (
          <div className="anigrid-pista">
            <ul className="juego-pistas">
              <li className="juego-pista">
                El nombre tiene {partida.pista.total} letras; la {partida.pista.posicion}.ª es «{partida.pista.letra}»
              </li>
            </ul>
            <p className="anigrid-huecos" aria-hidden="true">
              {Array.from({ length: partida.pista.total }, (_, i) => (
                <span key={i} className="anigrid-hueco" data-letra={i + 1 === partida.pista.posicion || undefined}>
                  {i + 1 === partida.pista.posicion ? partida.pista.letra : '·'}
                </span>
              ))}
            </p>
          </div>
        )}

        <div className="juego-fila anigrid-controles">
          <BuscadorPersonajes
            onElegir={elegir}
            excluir={probados}
            etiqueta="Tu intento"
            placeholder="Nombre del personaje o de su serie"
            desactivado={terminada}
          />
          <button type="button" className="boton anigrid-boton-pista" onClick={pista} disabled={!puedePedirPista(partida)}>
            <span lang="ja" className="anigrid-boton-kanji" aria-hidden="true">
              字
            </span>
            Pedir una letra
            <span className="anigrid-boton-coste">cuesta 1 intento</span>
          </button>
        </div>

        <p className="solo-lectores" aria-live="polite" aria-atomic="true">
          {anuncio}
        </p>
      </div>

      {fin && (
        <ResultadoRonda
          resultado={fin.ganada ? 'victoria' : 'derrota'}
          titulo={fin.ganada ? (usados === 1 ? '¡A la primera!' : `¡Acertaste en ${usados}!`) : 'Se acabaron los intentos'}
          puntos={fin.ganada ? puntosDe(partida) : 0}
          texto={fin.ganada ? `Era ${secreto.nombre}, de ${secreto.anime}. Racha de ${fin.racha}.` : `Era ${secreto.nombre}, de ${secreto.anime}.`}
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraRonda}
        >
          <div className="anigrid-revelada">
            <Carta carta={secreto} tamano="sobre" enlace={false} prioridad className="anigrid-revelada-carta" />
          </div>
        </ResultadoRonda>
      )}
    </MarcoJuego>
  )
}

/** Una fila jugada: el personaje probado y sus cinco fichas; solo la recién puesta gira. */
function Fila({ comparacion, numero, viva }) {
  const { carta } = comparacion
  const img = imagenCarta(carta)
  return (
    <li className="anigrid-fila" data-estado="jugada" data-viva={viva || undefined} data-acierto={comparacion.acierto || undefined}>
      <div className="anigrid-intento">
        <img className="anigrid-miniatura" src={img.src} srcSet={img.srcSet} sizes="40px" alt="" decoding="async" />
        <span className="anigrid-intento-nombre">
          <span className="solo-lectores">Intento {numero}: </span>
          {carta.nombre}
        </span>
        <span className="anigrid-intento-serie">{carta.anime}</span>
      </div>
      <ul className="anigrid-fichas">
        {COLUMNAS.map((c) => {
          const valor = comparacion[c.clave]
          const texto = comparacion.acierto ? 'el personaje secreto' : textoFicha(c.clave, valor)
          const { simbolo, nota } = dorsoDe(c.clave, comparacion)
          return (
            <li key={c.clave} className="anigrid-ficha" data-tono={tonoDe(c.clave, valor)} title={`${c.etiqueta}: ${texto}`}>
              <span className="solo-lectores">
                {c.etiqueta}: {texto}.
              </span>
              <span className="anigrid-rotor" aria-hidden="true">
                <span className="anigrid-cara anigrid-cara--frente">·</span>
                <span className="anigrid-cara anigrid-cara--dorso">
                  <span className="anigrid-simbolo">{simbolo}</span>
                  {nota !== undefined && <span className="anigrid-nota">{nota}</span>}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

/** Cinco fichas en reposo, para las filas que faltan. */
function FichasVacias({ simbolo = '·' }) {
  return (
    <ul className="anigrid-fichas" aria-hidden="true">
      {COLUMNAS.map((c) => (
        <li key={c.clave} className="anigrid-ficha" data-tono="reposo">
          <span className="anigrid-rotor">
            <span className="anigrid-cara anigrid-cara--frente">{simbolo}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
