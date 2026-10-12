import { useEffect, useRef, useState } from 'react'
import {
  Carta,
  Enlace,
  Hanko,
  MarcoJuego,
  crearAzar,
  imagenCarta,
  movimientoReducido,
  terminarRonda,
  useProgresoJuego,
} from '../comun/index.js'
import { ALTO_CELDA, anuncioDe, nuevoRoster, planificarGiro, posicionCarrete, sortear, tocaRenovar } from './reglas.js'
import './ruleta.css'

const rng = crearAzar()

/** Copias del roster en el carrete: la central es la que se ve; las otras dan el wrap. */
const COPIAS = 3

/** Tras parar: corte de tinta y luego el sello con los botones (ms). */
const CORTE_MS = 150
const SELLO_MS = 480

/** Con movimiento reducido no hay giro: se funde el tambor, se coloca y se vuelve a fundir. */
const FUNDIDO_MS = 200

/** Giros seguidos que «calientan» el tambor (el visor pasa a oro vivo). */
const CALOR = 3

/** El mismo `sizes` que usa Carta en tamaño «sobre», para precargar justo la versión que pintará. */
const SIZES_SOBRE = '(min-width: 768px) 240px, 60vw'

/**
 * Ruleta del destino: un tambor vertical con nombres que gira y se para
 * exacto en un personaje sorteado antes de arrancar. Al parar, corte de
 * tinta, su carta con el sello 印 y «Ver ficha» / «Girar otra vez». No da
 * sobre: solo cuenta las partidas.
 */
export default function Juego({ juego }) {
  const [roster, setRoster] = useState(() => nuevoRoster(rng))
  const [fase, setFase] = useState('quieto') // quieto | girando | corte | revelado
  const [elegido, setElegido] = useState(null) // la carta que ha salido
  const [giros, setGiros] = useState(0) // seguidos en esta visita (calor del tambor)
  const progreso = useProgresoJuego(juego.slug)

  // El carrete se mueve por ref en un rAF: nada de estado por frame.
  const carrete = useRef(null)
  const y = useRef(0) // posición actual del carrete en px (ver posicionCarrete)
  const animacion = useRef(0)
  const temporizadores = useRef([])

  // Al desmontar, nada queda girando ni programado.
  useEffect(
    () => () => {
      cancelAnimationFrame(animacion.current)
      temporizadores.current.forEach(clearTimeout)
    },
    [],
  )

  // El carrete arranca (y vuelve, con cada roster nuevo) en su sitio.
  useEffect(() => {
    if (carrete.current) carrete.current.style.transform = `translate3d(0, ${posicionCarrete(y.current, roster.length)}px, 0)`
  }, [roster])

  function programar(fn, ms) {
    temporizadores.current.push(setTimeout(fn, ms))
  }

  function colocar(posicion, escala, n) {
    y.current = posicion
    if (!carrete.current) return
    const desplazamiento = posicionCarrete(posicion, n)
    carrete.current.style.transform =
      escala === 1
        ? `translate3d(0, ${desplazamiento}px, 0)`
        : `translate3d(0, ${desplazamiento}px, 0) scaleY(${escala})`
  }

  function girar() {
    if (fase === 'girando' || fase === 'corte') return

    // Cada tantos giros, nombres nuevos (solo entre giros, nunca a mitad).
    let lista = roster
    if (tocaRenovar(giros)) {
      lista = nuevoRoster(rng)
      setRoster(lista)
      y.current = 0
    }

    const indice = sortear(lista, rng)
    const carta = lista[indice]
    temporizadores.current.forEach(clearTimeout)
    temporizadores.current = []
    setFase('girando')
    setElegido(null)

    // Mientras gira, su ilustración ya baja: al parar aparece sin esperar.
    const precarga = new Image()
    precarga.sizes = SIZES_SOBRE
    precarga.srcset = imagenCarta(carta).srcSet
    precarga.src = imagenCarta(carta).src

    const asentar = () => {
      setElegido(carta)
      setFase('corte')
      terminarRonda(juego, { ganada: false })
      programar(() => setFase('revelado'), SELLO_MS - CORTE_MS)
      setGiros((g) => g + 1)
    }

    if (movimientoReducido()) {
      programar(() => {
        colocar(indice * ALTO_CELDA, 1, lista.length)
        programar(asentar, FUNDIDO_MS)
      }, FUNDIDO_MS)
      return
    }

    const plan = planificarGiro(y.current, indice, lista.length)
    const arranque = performance.now()
    const frame = (ahora) => {
      const t = ahora - arranque
      if (t >= plan.duracion) {
        colocar(plan.destino, 1, lista.length)
        programar(asentar, CORTE_MS)
        return
      }
      const { y: posicion, escala } = plan.en(t)
      colocar(posicion, escala, lista.length)
      animacion.current = requestAnimationFrame(frame)
    }
    animacion.current = requestAnimationFrame(frame)
  }

  const girando = fase === 'girando' || fase === 'corte'
  const caliente = giros >= CALOR

  // Tres copias del roster: nombres, sin imágenes (el tambor pesa nada).
  const celdas = []
  for (let copia = 0; copia < COPIAS; copia++) {
    for (const carta of roster) {
      celdas.push(
        <li key={`${copia}-${carta.id}`} className="ruleta-celda">
          {carta.nombre}
        </li>,
      )
    }
  }

  return (
    <MarcoJuego
      juego={juego}
      estadisticas={[
        { etiqueta: 'Giros', valor: progreso.jugadas },
        { etiqueta: 'Seguidos', valor: giros },
      ]}
      reglas={
        <ol>
          <li>Pulsa «Girar el destino»: el tambor arranca y los nombres pasan como en una linterna.</li>
          <li>Frena solo y se para en un personaje al azar. No hay nada que acertar.</li>
          <li>Mira su carta, ve a su ficha o gira otra vez. Cada doce giros entran nombres nuevos.</li>
        </ol>
      }
    >
      <div className="ruleta" data-fase={fase} data-calor={caliente ? '' : undefined}>
        <div className="ruleta-tambor" aria-hidden="true">
          <span lang="ja" className="ruleta-tambor-kanji ruleta-tambor-kanji--izq">
            運
          </span>
          <span lang="ja" className="ruleta-tambor-kanji ruleta-tambor-kanji--der">
            祭
          </span>
          <div className="ruleta-ventana">
            <ul ref={carrete} className="ruleta-carrete">
              {celdas}
            </ul>
            <span className="ruleta-visor" />
            <span className="ruleta-marca ruleta-marca--izq" />
            <span className="ruleta-marca ruleta-marca--der" />
          </div>
        </div>

        <div className="ruleta-mando">
          <button type="button" className="boton boton--principal ruleta-girar" disabled={girando} onClick={girar}>
            {girando ? 'Girando…' : 'Girar el destino'}
          </button>
        </div>

        <p className="solo-lectores" role="status" aria-live="polite">
          {fase === 'girando' ? 'El tambor gira.' : elegido ? anuncioDe(elegido) : ''}
        </p>

        {elegido && (
          // Con la key, cada giro pinta un resultado nuevo y tira el anterior: no se apilan capas.
          <Resultado key={`${elegido.id}-${giros}`} elegido={elegido} girando={girando} onGirar={girar} />
        )}
      </div>
    </MarcoJuego>
  )
}

/** Lo que ha salido: la carta sellada, el nombre con corte de tinta y los botones. Recibe el foco al aparecer. */
function Resultado({ elegido, girando, onGirar }) {
  const panel = useRef(null)

  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    panel.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  return (
    <section ref={panel} className="ruleta-resultado" aria-labelledby="ruleta-elegido" tabIndex={-1}>
      <div className="ruleta-carta-marco">
        <Carta carta={elegido} tamano="sobre" enlace={false} cartela={false} prioridad className="ruleta-carta" />
        <Hanko kanji="印" className="ruleta-sello" />
      </div>
      <div className="ruleta-firma">
        <p className="rotulo ruleta-rotulo">El destino eligió</p>
        <h2 id="ruleta-elegido" className="ruleta-nombre">
          <span className="ruleta-nombre-texto">{elegido.nombre}</span>
          <span className="ruleta-corte" aria-hidden="true" />
        </h2>
        <p className="ruleta-serie">{elegido.anime}</p>
        <div className="ruleta-acciones">
          <Enlace to={`/carta/${elegido.id}`} className="boton boton--principal">
            Ver ficha
          </Enlace>
          <button type="button" className="boton" disabled={girando} onClick={onGirar}>
            Girar otra vez
          </button>
        </div>
      </div>
    </section>
  )
}
