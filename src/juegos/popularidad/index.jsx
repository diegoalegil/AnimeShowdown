import { useEffect, useRef, useState } from 'react'
import {
  Carta,
  Hanko,
  MarcoJuego,
  ResultadoRonda,
  crearAzar,
  movimientoReducido,
  popularidad,
  terminarRonda,
  useProgresoJuego,
} from '../comun/index.js'
import {
  DUELOS_POR_RONDA,
  formatearFavs,
  guardarMejorRacha,
  inclinacion,
  leerMejorRacha,
  nuevaRonda,
  pesasDeRacha,
  resolver,
  siguienteDuelo,
  valorContador,
} from './reglas.js'
import './popularidad.css'

const rng = crearAzar()
const CONTADOR_MS = 500 // la cifra de la retadora sube de 0 a su valor
const ESPERA_MS = 1100 // se ve el veredicto y la balanza inclinada antes de seguir

const almacen = () => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const TECLAS = { ArrowUp: 'mas', ArrowDown: 'menos' }

/**
 * ¿Quién es más popular?: dos cartas en una balanza de oro. La referencia
 * enseña sus favoritos; el jugador dice si la retadora tiene más o menos.
 * Cinco aciertos seguidos ganan la ronda (y el sobre); un fallo la termina.
 * La racha de aciertos sigue de ronda en ronda, como pesas apiladas.
 */
export default function Juego({ juego }) {
  const progreso = useProgresoJuego(juego.slug)
  const [ronda, setRonda] = useState(() => nuevaRonda(rng))
  // eligiendo → contando (sube la cifra) → pesando (se inclina, se ve el veredicto) → fin | eligiendo
  const [fase, setFase] = useState('eligiendo')
  const [eleccion, setEleccion] = useState(null) // 'mas' | 'menos'
  const [veredicto, setVeredicto] = useState(null) // lo que devuelve resolver
  const [fin, setFin] = useState(null) // lo que devuelve terminarRonda, más `ganada`
  const [racha, setRacha] = useState(0) // aciertos seguidos, de ronda en ronda
  const [mejorRacha, setMejorRacha] = useState(() => leerMejorRacha(almacen()))
  const contador = useRef(null) // la cifra de la retadora mientras sube
  const botonMas = useRef(null)
  const elegirRef = useRef(null)

  const reducido = movimientoReducido()
  const { referencia, retadora } = ronda
  const favsRetadora = popularidad(retadora)
  const revelada = fase !== 'eligiendo'
  const fallo = Boolean(veredicto && !veredicto.acierto)

  function elegir(opcion) {
    if (fase !== 'eligiendo') return
    const resultado = resolver(ronda, opcion)
    setEleccion(opcion)
    setVeredicto(resultado)
    setFase('contando')
    if (resultado.acierto) {
      const nuevaRacha = racha + 1
      setRacha(nuevaRacha)
      setMejorRacha(guardarMejorRacha(almacen(), nuevaRacha))
    }
    if (resultado.terminada) {
      const puntos = ronda.aciertos + (resultado.acierto ? 1 : 0)
      setFin({ ganada: resultado.ganada, ...terminarRonda(juego, { ganada: resultado.ganada, puntos }) })
    }
  }
  elegirRef.current = elegir

  function otraRonda() {
    setRonda(nuevaRonda(rng))
    setEleccion(null)
    setVeredicto(null)
    setFin(null)
    if (fallo) setRacha(0) // las pesas volcadas se retiran al empezar de nuevo
    setFase('eligiendo')
    requestAnimationFrame(() => botonMas.current?.focus())
  }

  // La coreografía avanza por temporizadores: contar → pesar → seguir o terminar.
  useEffect(() => {
    if (fase === 'contando') {
      const t = setTimeout(() => setFase('pesando'), reducido ? 0 : CONTADOR_MS)
      return () => clearTimeout(t)
    }
    if (fase === 'pesando') {
      const t = setTimeout(() => {
        if (fin) {
          setFase('fin')
          return
        }
        setRonda((r) => siguienteDuelo(r, rng))
        setEleccion(null)
        setVeredicto(null)
        setFase('eligiendo')
      }, ESPERA_MS)
      return () => clearTimeout(t)
    }
    return undefined
  }, [fase, fin, reducido])

  // El contador: se escribe directamente en el nodo, sin pasar por el estado.
  useEffect(() => {
    if (fase !== 'contando' || reducido || !contador.current) return undefined
    const nodo = contador.current
    const inicio = performance.now()
    let frame = requestAnimationFrame(function pintar(ahora) {
      nodo.textContent = formatearFavs(valorContador(favsRetadora, (ahora - inicio) / CONTADOR_MS))
      frame = requestAnimationFrame(pintar)
    })
    return () => cancelAnimationFrame(frame)
  }, [fase, favsRetadora, reducido])

  // ↑ más, ↓ menos (sin robarle las flechas a ningún campo).
  useEffect(() => {
    if (fase !== 'eligiendo') return undefined
    function alPulsar(evento) {
      const opcion = TECLAS[evento.key]
      if (!opcion || evento.altKey || evento.ctrlKey || evento.metaKey) return
      const campo = evento.target?.tagName
      if (campo === 'INPUT' || campo === 'TEXTAREA' || campo === 'SELECT') return
      evento.preventDefault()
      elegirRef.current?.(opcion)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [fase])

  const pesando = fase === 'pesando' || fase === 'fin'
  const grados = pesando ? inclinacion(ronda) : 0
  const { pesas, ocultas } = pesasDeRacha(racha)
  const rachaVisible = fallo ? 0 : racha
  const cifraRetadora = !revelada ? '¿?' : fase === 'contando' && !reducido ? formatearFavs(0) : formatearFavs(favsRetadora)
  const masOMenos = veredicto?.correcta === 'mas' ? 'más' : 'menos'
  const tono = pesando ? (veredicto.acierto ? 'acierto' : 'fallo') : undefined

  const estadoDe = (opcion) => {
    if (!veredicto) return opcion === eleccion ? 'elegida' : undefined
    if (opcion === veredicto.correcta) return 'acierto'
    return opcion === eleccion ? 'fallo' : undefined
  }

  const anuncio = !revelada
    ? `Duelo ${ronda.duelo} de ${DUELOS_POR_RONDA}. ${referencia.nombre} tiene ${formatearFavs(popularidad(referencia))} favoritos. ¿${retadora.nombre} tiene más o menos?`
    : pesando
      ? `${veredicto.acierto ? 'Correcto' : 'Incorrecto'}: ${retadora.nombre} tiene ${formatearFavs(favsRetadora)} favoritos, ${masOMenos} que ${referencia.nombre}. Racha de ${rachaVisible}.`
      : ''

  return (
    <MarcoJuego
      juego={juego}
      reglas={
        <ol>
          <li>La carta de la izquierda enseña sus favoritos en AniList.</li>
          <li>Decide si la de la derecha tiene más o menos. Se revela su cifra y la balanza se inclina hacia quien pesa más.</li>
          <li>Si aciertas, la retadora pasa a ser la referencia. Cinco aciertos seguidos ganan la ronda y un sobre; un fallo la termina.</li>
          <li>La racha de aciertos sigue de ronda en ronda: cada acierto apila una pesa de oro.</li>
        </ol>
      }
      estadisticas={[
        { etiqueta: 'Racha', valor: rachaVisible },
        { etiqueta: 'Récord', valor: mejorRacha },
        { etiqueta: 'Rondas ganadas', valor: progreso.ganadas },
      ]}
      cabecera={
        <ol className="popularidad-pasos" aria-label={`Duelo ${ronda.duelo} de ${DUELOS_POR_RONDA}`}>
          {Array.from({ length: DUELOS_POR_RONDA }, (_, i) => {
            const n = i + 1
            const hecho = n < ronda.duelo || (n === ronda.duelo && veredicto?.acierto)
            return (
              <li
                key={n}
                className="popularidad-paso"
                data-estado={hecho ? 'hecho' : n === ronda.duelo ? 'actual' : undefined}
                aria-current={n === ronda.duelo ? 'step' : undefined}
              >
                <span className="solo-lectores">Duelo {n}</span>
              </li>
            )
          })}
        </ol>
      }
    >
      <div className="popularidad-mesa">
        <section
          className="popularidad-balanza"
          data-fase={fase}
          data-eleccion={eleccion ?? undefined}
          data-veredicto={tono}
          style={{ '--inclinacion': `${grados.toFixed(2)}deg` }}
          aria-label="Balanza"
        >
          {/* El brazo y el fiel giran juntos sobre el pivote al revelar. */}
          <svg className="popularidad-armazon" viewBox="0 0 680 90" aria-hidden="true">
            <g className="popularidad-brazo">
              <path className="popularidad-viga" d="M170 46 Q340 30 510 46 Q340 62 170 46 Z" />
              <path className="popularidad-fiel" d="M340 8 L348 42 L340 52 L332 42 Z" />
              <circle className="popularidad-gancho" cx="170" cy="46" r="4" />
              <circle className="popularidad-gancho" cx="510" cy="46" r="4" />
            </g>
            <circle className="popularidad-pivote" cx="340" cy="46" r="7" />
          </svg>
          <span className="popularidad-columna" aria-hidden="true" />

          <div className="popularidad-platillos">
            <Platillo lado="referencia" carta={referencia} rotulo="Referencia" kanji="基">
              <p className="popularidad-favs">
                <span className="cifra">{formatearFavs(popularidad(referencia))}</span>
                <span className="popularidad-favs-unidad">favoritos</span>
              </p>
            </Platillo>
            <Platillo lado="retadora" carta={retadora} rotulo="Retadora" kanji="挑">
              {pesando && (
                <Hanko
                  kanji={veredicto.acierto ? '当' : '否'}
                  forma="redondo"
                  className="popularidad-sello"
                  etiqueta={veredicto.acierto ? 'Acierto' : 'Fallo'}
                />
              )}
              <p className="popularidad-favs" data-oculta={!revelada || undefined}>
                <span className="cifra" ref={contador}>
                  {cifraRetadora}
                </span>
                <span className="popularidad-favs-unidad">favoritos</span>
              </p>
            </Platillo>
          </div>
          <span className="popularidad-base" aria-hidden="true" />
        </section>

        <div className="popularidad-mando">
          <p className="popularidad-pregunta">
            ¿<strong>{retadora.nombre}</strong> tiene más o menos favoritos que <strong>{referencia.nombre}</strong>?
          </p>
          <div className="popularidad-opciones" role="group" aria-label="Tu respuesta">
            <button
              ref={botonMas}
              type="button"
              className="popularidad-opcion"
              data-estado={estadoDe('mas')}
              aria-pressed={eleccion === 'mas'}
              aria-disabled={revelada || undefined}
              onClick={() => elegir('mas')}
            >
              <span lang="ja" className="popularidad-opcion-kanji" aria-hidden="true">
                上
              </span>
              <span className="popularidad-opcion-texto">Tiene más</span>
              <kbd className="popularidad-tecla" aria-hidden="true">
                ↑
              </kbd>
            </button>
            <button
              type="button"
              className="popularidad-opcion"
              data-estado={estadoDe('menos')}
              aria-pressed={eleccion === 'menos'}
              aria-disabled={revelada || undefined}
              onClick={() => elegir('menos')}
            >
              <span lang="ja" className="popularidad-opcion-kanji" aria-hidden="true">
                下
              </span>
              <span className="popularidad-opcion-texto">Tiene menos</span>
              <kbd className="popularidad-tecla" aria-hidden="true">
                ↓
              </kbd>
            </button>
          </div>
          <p className="solo-lectores" aria-live="polite">
            {anuncio}
          </p>
          <p className="juego-aviso" data-tono={tono} aria-hidden="true">
            {!pesando
              ? `Duelo ${ronda.duelo} de ${DUELOS_POR_RONDA}`
              : veredicto.acierto
                ? `Correcto: ${retadora.nombre} tiene ${masOMenos}.`
                : `No: ${retadora.nombre} tiene ${masOMenos}.`}
          </p>
        </div>

        <section className="popularidad-racha" aria-labelledby="popularidad-racha-titulo">
          <h2 id="popularidad-racha-titulo" className="popularidad-racha-titulo">
            <span lang="ja" aria-hidden="true">
              続
            </span>
            Aciertos seguidos
          </h2>
          <ol className="popularidad-pesas" data-caida={fallo || undefined} aria-label={`${racha} pesas apiladas`}>
            {ocultas > 0 && (
              <li className="popularidad-pesa popularidad-pesa--resto">
                <span className="cifra">+{ocultas}</span>
              </li>
            )}
            {pesas.map((n, i) => (
              <li key={n} className="popularidad-pesa" data-hito={n % DUELOS_POR_RONDA === 0 || undefined} style={{ '--orden': i }}>
                <span className="cifra">{n}</span>
              </li>
            ))}
          </ol>
          {racha === 0 && <p className="popularidad-pesas-vacio">Sin pesas aún: cada acierto apila una.</p>}
        </section>
      </div>

      {fase === 'fin' && (
        <ResultadoRonda
          resultado={fin.ganada ? 'victoria' : 'derrota'}
          puntos={ronda.aciertos + (veredicto.acierto ? 1 : 0)}
          texto={
            fin.ganada
              ? `Cinco de cinco. Llevas ${racha} aciertos seguidos.`
              : `${retadora.nombre} tiene ${formatearFavs(favsRetadora)} favoritos, ${masOMenos} que ${referencia.nombre} (${formatearFavs(popularidad(referencia))}). Te quedaste en el duelo ${ronda.duelo}.`
          }
          sobreGanado={fin.sobreGanado}
          onOtraRonda={otraRonda}
        />
      )}
    </MarcoJuego>
  )
}

/** Un platillo colgado del brazo: cadenas, la carta sobre el plato y, debajo, la cifra y el nombre. */
function Platillo({ lado, carta, rotulo, kanji, children }) {
  return (
    <div className={`popularidad-platillo popularidad-platillo--${lado}`}>
      <div className="popularidad-colgante">
        <svg className="popularidad-cadenas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M50 0 L6 100 M50 0 L94 100" vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="popularidad-rotulo">
          <span lang="ja" aria-hidden="true">
            {kanji}
          </span>
          {rotulo}
        </p>
        <Carta carta={carta} tamano="sobre" enlace={false} cartela={false} prioridad className="popularidad-carta" />
        <span className="popularidad-plato" aria-hidden="true" />
      </div>
      {children}
      <p className="popularidad-nombre">
        <strong>{carta.nombre}</strong>
        <span>{carta.anime}</span>
      </p>
    </div>
  )
}
