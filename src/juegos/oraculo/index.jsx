import { useEffect, useRef, useState } from 'react'
import { BuscadorPersonajes, Carta, Hanko, MarcoJuego, ResultadoRonda, crearAzar, terminarRonda } from '../comun/index.js'
import { Mascara } from './Mascara.jsx'
import { MAX_APUESTAS, MAX_NO_SE, MAX_PREGUNTAS, cicloAura, confianza, continuar, ganada, nuevaPartida, responder } from './reglas.js'
import './oraculo.css'

const rng = crearAzar()
const GLIFOS = { si: '是', no: '否', nose: '不明' }
const ETIQUETAS = { si: 'Sí', no: 'No', nose: 'No sé' }
const TECLAS = { s: 'si', n: 'no', '?': 'nose', d: 'nose' }

const dos = (n) => String(n).padStart(2, '0')
const porCiento = (x) => (x > 0 && x < 0.005 ? '< 1 %' : `${Math.round(x * 100)} %`)
const palabra = (respuesta) => (respuesta === 'nose' ? 'no sé' : respuesta === 'si' ? 'sí' : 'no')

/**
 * Oráculo: sellas un personaje en secreto y el oráculo intenta adivinarlo
 * con preguntas de sí o no. Tus respuestas se comprueban contra los datos
 * del personaje: mentir pierde. Ganas si, tras sus apuestas, no da con él.
 */
export default function Juego({ juego }) {
  const [elegido, setElegido] = useState(null) // carta buscada, aún sin sellar
  const [partida, setPartida] = useState(null) // ver reglas.js
  const [fin, setFin] = useState(null) // lo que devuelve terminarRonda, más `ganada`
  const santuario = useRef(null)

  // Las animaciones del altar se paran cuando no se ve.
  useEffect(() => {
    const elemento = santuario.current
    if (!elemento || typeof window.IntersectionObserver !== 'function') return undefined
    const io = new window.IntersectionObserver(([entrada]) => elemento.toggleAttribute('data-fuera', !entrada.isIntersecting))
    io.observe(elemento)
    return () => io.disconnect()
  }, [])

  /** Si la partida terminó, anota la ronda (una sola vez). */
  function avanzar(siguiente) {
    setPartida(siguiente)
    if (siguiente.resultado && !fin) {
      const victoria = ganada(siguiente)
      setFin({ ganada: victoria, ...terminarRonda(juego, { ganada: victoria }) })
    }
  }

  function sellar() {
    if (!elegido) return
    setElegido(null)
    avanzar(nuevaPartida(elegido, { rng }))
  }

  function contestar(respuesta) {
    if (!partida || partida.fase !== 'pregunta' || fin) return
    if (respuesta === 'nose' && partida.noSe >= MAX_NO_SE) return
    avanzar(responder(partida, respuesta, rng))
  }

  function seguir() {
    if (!partida || partida.fase !== 'veredicto') return
    avanzar(continuar(partida, rng))
  }

  function otraRonda() {
    setElegido(null)
    setPartida(null)
    setFin(null)
  }

  // Atajos S, N y ? (o D) mientras el foco está en el santuario y no en un campo.
  function alTeclear(evento) {
    if (evento.metaKey || evento.ctrlKey || evento.altKey) return
    if (/^(input|textarea|select)$/i.test(evento.target?.tagName ?? '')) return
    const respuesta = TECLAS[evento.key.toLowerCase()]
    if (respuesta) contestar(respuesta)
  }

  const conf = partida ? confianza(partida.candidatos) : 0
  const ultima = partida?.respuestas.at(-1)
  const pose = !partida
    ? 'reposo'
    : partida.resultado === 'adivinado'
      ? 'reverencia'
      : partida.resultado === 'enganado' || partida.fase === 'veredicto'
        ? 'pena'
        : partida.fase === 'pregunta' && ultima?.respuesta === 'nose'
          ? 'duda'
          : 'reposo'

  return (
    <MarcoJuego
      juego={juego}
      cabecera={
        partida && !fin ? (
          <p className="oraculo-lectura">
            Lectura <span className="cifra">{dos(partida.respuestas.length)}</span> de {MAX_PREGUNTAS} · confianza{' '}
            <span className="cifra">{porCiento(conf)}</span> · <span className="cifra">{partida.candidatos.length}</span>{' '}
            {partida.candidatos.length === 1 ? 'camino' : 'caminos'}
          </p>
        ) : undefined
      }
      reglas={
        <ol>
          <li>Busca un personaje y séllalo: el oráculo no lo ve, solo oye tus respuestas.</li>
          <li>
            Responde <strong>sí</strong> o <strong>no</strong> a sus preguntas; puedes decir <strong>no sé</strong> {MAX_NO_SE}{' '}
            veces por partida.
          </li>
          <li>
            Tus respuestas se cotejan con los datos de la carta. Si mientes, el oráculo lo ve y pierdes la ronda; si el dato no
            consta, vale cualquier respuesta.
          </li>
          <li>
            Tras {MAX_PREGUNTAS} preguntas como mucho, apuesta por un personaje (hasta {MAX_APUESTAS} apuestas). Si no da con el
            tuyo, ganas la ronda y un sobre extra.
          </li>
          <li>
            Atajos: <kbd>S</kbd> sí, <kbd>N</kbd> no, <kbd>?</kbd> no sé.
          </li>
        </ol>
      }
    >
      {/* El div recoge los atajos de teclado de lo que hay dentro. */}
      <div className="oraculo-santuario" ref={santuario} onKeyDown={alTeclear}>
        <div className="oraculo-altar" style={{ '--oraculo-aura-ciclo': cicloAura(conf) }}>
          <span className="oraculo-marca" lang="ja" aria-hidden="true">
            占
          </span>
          <span className="oraculo-aura" aria-hidden="true" />
          <span className="oraculo-aura oraculo-aura--fuerte" aria-hidden="true" />
          <div className="oraculo-levita">
            <Mascara pose={pose} brillo={partida?.resultado === 'adivinado'} />
          </div>
          {partida && (
            <p className="oraculo-sellado">
              <Hanko kanji="封" className="oraculo-sellado-hanko" />
              <span>
                Personaje sellado
                <span className="solo-lectores">: solo tú lo conoces hasta el final.</span>
              </span>
            </p>
          )}
        </div>

        <div className="oraculo-mesa">
          {!partida && <Sellar elegido={elegido} onElegir={setElegido} onSellar={sellar} onDescartar={() => setElegido(null)} />}

          {partida?.fase === 'pregunta' && !fin && (
            <>
              <Tira key={partida.pregunta.id} numero={partida.respuestas.length + 1} texto={partida.pregunta.texto} />
              <div className="oraculo-respuestas" role="group" aria-label="Tu respuesta">
                {['si', 'no', 'nose'].map((r) => {
                  const agotado = r === 'nose' && partida.noSe >= MAX_NO_SE
                  return (
                    <button
                      key={r}
                      type="button"
                      className="oraculo-respuesta"
                      data-respuesta={r}
                      aria-disabled={agotado || undefined}
                      onClick={() => contestar(r)}
                    >
                      <span lang="ja" className="oraculo-respuesta-glifo" aria-hidden="true">
                        {GLIFOS[r]}
                      </span>
                      {ETIQUETAS[r]}
                      {r === 'nose' && (
                        <span className="oraculo-respuesta-resto">{agotado ? 'agotado' : `quedan ${MAX_NO_SE - partida.noSe}`}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {partida && (partida.fase === 'veredicto' || partida.fase === 'fin') && <Veredicto partida={partida} onSeguir={seguir} />}

          <p className="solo-lectores" aria-live="polite">
            {anuncio(partida, fin)}
          </p>
        </div>
      </div>

      {partida && partida.respuestas.length > 0 && <Memoria respuestas={partida.respuestas} />}

      {fin && (
        <ResultadoRonda
          resultado={fin.ganada ? 'victoria' : 'derrota'}
          titulo={fin.ganada ? 'Has engañado al oráculo' : partida.resultado === 'mentira' ? 'El oráculo ve la mentira' : 'El oráculo te ha leído'}
          texto={textoFinal(partida, fin)}
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraRonda}
          etiquetaOtra="Otra lectura"
        />
      )}
    </MarcoJuego>
  )
}

/** Antes de empezar: buscar el personaje y sellarlo. */
function Sellar({ elegido, onElegir, onSellar, onDescartar }) {
  return (
    <div className="oraculo-sellar">
      <p className="oraculo-invitacion">
        <span lang="ja" className="oraculo-invitacion-kanji" aria-hidden="true">
          心
        </span>
        Piensa en un personaje del catálogo y séllalo. El oráculo no lo verá: solo oirá tus respuestas.
      </p>
      {elegido ? (
        <div className="oraculo-elegido">
          <Carta carta={elegido} tamano="dia" enlace={false} prioridad className="oraculo-elegido-carta" />
          <div className="oraculo-elegido-texto">
            <p className="oraculo-elegido-pregunta">¿Sellamos a {elegido.nombre}?</p>
            <p className="oraculo-elegido-nota">Una vez sellado, no se vuelve a mostrar hasta el final.</p>
            <div className="juego-fila">
              <button type="button" className="boton boton--principal" onClick={onSellar} autoFocus>
                Sellar
                <span lang="ja" className="oraculo-boton-kanji" aria-hidden="true">
                  封
                </span>
              </button>
              <button type="button" className="boton" onClick={onDescartar}>
                Elegir otro
              </button>
            </div>
          </div>
        </div>
      ) : (
        <BuscadorPersonajes onElegir={onElegir} etiqueta="Tu personaje secreto" placeholder="Nombre del personaje o de su serie" autoEnfocar />
      )}
    </div>
  )
}

/** La pregunta, como una tira de papel que se desenrolla. */
function Tira({ numero, texto }) {
  return (
    <div className="oraculo-tira">
      <p className="oraculo-tira-cabecera">
        <span lang="ja" className="oraculo-tira-kanji" aria-hidden="true">
          問
        </span>
        <span className="rotulo">
          Pregunta <span className="cifra">{dos(numero)}</span>
        </span>
      </p>
      <p className="oraculo-tira-texto">{texto}</p>
    </div>
  )
}

/** La apuesta del oráculo y, al final, la carta sellada. */
function Veredicto({ partida, onSeguir }) {
  const { apuesta, acierto, resultado, sellado, mentira, apuestas } = partida
  if (resultado === 'mentira') {
    return (
      <div className="oraculo-veredicto" data-resultado="mentira">
        <p className="oraculo-veredicto-titulo">El oráculo ve la mentira.</p>
        <p className="oraculo-veredicto-texto">
          Respondiste «{palabra(mentira.respuesta)}» a «{mentira.pregunta.texto}», y la verdad era {mentira.verdad ? 'sí' : 'no'}.
        </p>
        <div className="oraculo-cartas">
          <figure className="oraculo-figura">
            <Carta carta={sellado} tamano="sobre" enlace={false} prioridad className="oraculo-carta" />
            <figcaption className="rotulo">Tu personaje</figcaption>
          </figure>
        </div>
      </div>
    )
  }
  return (
    <div className="oraculo-veredicto" data-resultado={acierto ? 'acierto' : resultado ? 'enganado' : 'fallo'}>
      <p className="oraculo-veredicto-titulo">{acierto ? 'Tu personaje es…' : `Apuesta ${apuestas.length} de ${MAX_APUESTAS}: ¿es…?`}</p>
      <div className="oraculo-cartas">
        <figure className="oraculo-figura">
          <Carta carta={apuesta} tamano="sobre" enlace={false} prioridad className="oraculo-carta" />
          {acierto && <Hanko kanji="当" forma="redondo" className="oraculo-acierto" etiqueta="Acierto" />}
          <figcaption className="rotulo">{acierto ? 'Lo supo' : 'No era'}</figcaption>
        </figure>
        {resultado === 'enganado' && (
          <figure className="oraculo-figura">
            <Carta carta={sellado} tamano="sobre" enlace={false} prioridad className="oraculo-carta" />
            <figcaption className="rotulo">Tu personaje</figcaption>
          </figure>
        )}
      </div>
      {!acierto && !resultado && (
        <>
          <p className="oraculo-veredicto-texto">El oráculo baja la mirada: el hilo se le escapó. Pero aún le queda una apuesta.</p>
          <button type="button" className="boton boton--principal" onClick={onSeguir} autoFocus>
            Seguir
            <span className="boton-flecha" aria-hidden="true">
              →
            </span>
          </button>
        </>
      )}
      {resultado === 'enganado' && <p className="oraculo-veredicto-texto">Dos apuestas y ninguna era la tuya. El oráculo se rinde.</p>}
    </div>
  )
}

/** Las respuestas dadas, colgadas como tablillas. */
function Memoria({ respuestas }) {
  return (
    <section className="oraculo-memoria" aria-label="Respuestas dadas">
      <p className="oraculo-memoria-cabecera">
        <span className="rotulo">Memoria del interrogatorio</span>
        <span className="cifra oraculo-memoria-cuenta">{respuestas.length === 1 ? '1 respuesta' : `${respuestas.length} respuestas`}</span>
      </p>
      <ol className="oraculo-emas">
        {respuestas.map(({ pregunta, respuesta }, i) => (
          <li key={pregunta.id} className="oraculo-ema" data-respuesta={respuesta}>
            <span lang="ja" className="oraculo-ema-glifo" aria-hidden="true">
              {GLIFOS[respuesta]}
            </span>
            <span lang="ja" className="oraculo-ema-numero" aria-hidden="true">
              第{i + 1}問
            </span>
            <span className="oraculo-ema-texto">
              <span className="solo-lectores">Pregunta {i + 1}: </span>
              {pregunta.texto}
              <span className="solo-lectores"> Respuesta: {palabra(respuesta)}.</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Lo que oye quien usa lector de pantalla al cambiar la situación. */
function anuncio(partida, fin) {
  if (!partida) return ''
  if (partida.fase === 'pregunta' && !fin) {
    return `Pregunta ${partida.respuestas.length + 1} de ${MAX_PREGUNTAS}: ${partida.pregunta.texto} Confianza del oráculo ${porCiento(confianza(partida.candidatos))}.`
  }
  if (partida.resultado === 'mentira') return 'El oráculo ve la mentira. Has perdido la ronda.'
  if (partida.acierto) return `El oráculo apuesta por ${partida.apuesta.nombre} y acierta.`
  if (partida.apuesta) return `El oráculo apuesta por ${partida.apuesta.nombre}. No era.${partida.resultado ? ' Has ganado la ronda.' : ''}`
  return ''
}

/** El detalle del panel de fin de ronda. */
function textoFinal(partida, fin) {
  const { sellado, respuestas } = partida
  const n = respuestas.length
  const preguntas = `${n} ${n === 1 ? 'pregunta' : 'preguntas'}`
  if (fin.ganada) return `${preguntas} y ${MAX_APUESTAS} apuestas no bastaron: ${sellado.nombre} sigue en secreto. Racha de ${fin.racha}.`
  if (partida.resultado === 'mentira') return `${sellado.nombre}, de ${sellado.anime}, merecía la verdad.`
  return `Era ${sellado.nombre}, de ${sellado.anime}, y lo supo en ${preguntas}.`
}
