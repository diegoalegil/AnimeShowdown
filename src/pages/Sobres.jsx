import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { Carta } from '../components/Carta.jsx'
import { Enlace } from '../components/Enlace.jsx'
import { EtiquetaVertical } from '../components/EtiquetaVertical.jsx'
import { Naipe } from '../components/Naipe.jsx'
import { SobreCerrado, SobreRasgado } from '../components/Sobre.jsx'
import { TituloSeccion } from '../components/TituloSeccion.jsx'
import { SOBRES_POR_DIA } from '../config.js'
import { catalogo, esEspecial } from '../lib/catalog.js'
import {
  ceremonia,
  estadoInicial,
  formatoEspera,
  resumenSobre,
  textoAviso,
  textoResumen,
  todasReveladas,
  ultimoRetardo,
} from '../lib/ceremonia.js'
import { alTerminar, animarApertura, animarGuardado } from '../lib/coreografia.js'
import { recuento, textoRecuento } from '../lib/album.js'
import { msHastaMedianoche, sobresRestantes } from '../lib/collection.js'
import { pieza } from '../lib/marca.js'
import { movimientoReducido } from '../lib/motion.js'
import { cuentaRetenida } from '../lib/cuentaRetenida.js'
import { coleccion, useColeccion } from '../lib/useCollection.js'
import { useInclinacion, usePausaFuera } from '../lib/useMotion.js'
import { useMinuto } from '../lib/useReloj.js'
import { useTitulo } from '../lib/useTitulo.js'

const esEspecialId = (id) => esEspecial(catalogo.carta(id))
const ARENA = pieza('sobres-arena')

export default function Sobres() {
  useTitulo('Sobres')
  const estado = useColeccion()
  const hoy = coleccion.hoy()
  const quedan = sobresRestantes(estado, hoy)
  const [cer, despachar] = useReducer(ceremonia, undefined, estadoInicial)
  const [posicion, setPosicion] = useState({ sobre: 0, i: 0 })
  const mesa = useInclinacion()
  const escenario = usePausaFuera()
  // Qué enfocar tras el próximo cambio de la ceremonia (lo hace el efecto de abajo).
  const foco = useRef(null)
  // Temporizador que acerca la siguiente carta en el móvil.
  const acercar = useRef(0)

  const todas = todasReveladas(cer)
  const copias = (id) => estado.tengo[id] ?? 0
  const aviso = textoAviso(cer, { carta: catalogo.carta, copias, esEspecial: esEspecialId })

  // Apertura: el sobre se rasga y las cartas vuelan a la mesa. Si la fase
  // cambia antes («Saltar»), la limpieza cancela lo que quede.
  useLayoutEffect(() => {
    if (cer.fase !== 'abriendo') return undefined
    let viva = true
    const animaciones = animarApertura(mesa.current)
    alTerminar(animaciones).then(() => {
      if (viva) despachar({ tipo: 'abierto' })
    })
    return () => {
      viva = false
      for (const a of animaciones) a.cancel()
    }
  }, [cer.fase, mesa])

  // Guardado: las cartas vuelan al contador de la colección de la cabecera.
  useLayoutEffect(() => {
    if (cer.fase !== 'guardando') return undefined
    const raiz = mesa.current
    // La fila deslizable del móvil deja de recortar para que las cartas
    // puedan salir de ella; se compensa el desplazamiento para que no salten.
    const fila = raiz.querySelector('.abanico')
    if (fila) {
      fila.style.setProperty('--desplazado', `${-fila.scrollLeft}px`)
      fila.dataset.soltando = ''
    }
    const destino = document.querySelector('[data-destino="coleccion"]')
    const cuenta = destino?.querySelector('.nav-cuenta') ?? destino
    let viva = true
    const animaciones = animarGuardado(raiz, cuenta)
    alTerminar(animaciones).then(() => {
      if (!viva) return
      // Las cartas llegan: el contador se pone al día (y da su salto).
      cuentaRetenida.soltar()
      despachar({ tipo: 'guardado' })
    })
    return () => {
      viva = false
      for (const a of animaciones) a.cancel()
    }
  }, [cer.fase, mesa])

  // Si se sale de la página a mitad de la ceremonia, la cabecera muestra ya
  // la cuenta real.
  useEffect(
    () => () => {
      cuentaRetenida.soltar()
      clearTimeout(acercar.current)
    },
    [],
  )

  // Foco pendiente: tras abrir, en la primera carta; al acabar de revelar,
  // en «Guardar»; tras guardar, en el siguiente sobre.
  useLayoutEffect(() => {
    if (!foco.current) return
    // Si aún no existe (el siguiente sobre llega al terminar el guardado),
    // queda pendiente para el próximo cambio.
    const elemento = mesa.current?.parentElement?.querySelector(foco.current)
    if (!elemento) return
    foco.current = null
    elemento.focus({ preventScroll: true })
    // Si queda fuera de la pantalla (p. ej. el sobre nuevo tras guardar en
    // el móvil), se acerca con suavidad.
    const { top, bottom } = elemento.getBoundingClientRect()
    if (top < 0 || bottom > window.innerHeight) {
      elemento.scrollIntoView({ block: 'center', inline: 'nearest', behavior: movimientoReducido() ? 'auto' : 'smooth' })
    }
  }, [cer, mesa])

  function abrir() {
    let resultado
    cuentaRetenida.retener(recuento(estado.tengo).personajes.tengo)
    try {
      resultado = coleccion.abrirSobre()
    } catch {
      cuentaRetenida.soltar()
      return // Ya no quedan sobres hoy: la página se actualiza sola.
    }
    foco.current = '.naipe-boton'
    despachar({ tipo: 'abrir', ids: resultado.ids, nuevas: resultado.nuevas })
  }

  function revelar(indice, evento) {
    clearTimeout(acercar.current)
    despachar({ tipo: 'revelar', indice })
    const pendientes = cer.reveladas.map((vista, i) => !vista && i !== indice)
    const despues = pendientes.indexOf(true, indice + 1)
    const siguiente = despues >= 0 ? despues : pendientes.indexOf(true)
    if (siguiente < 0) {
      foco.current = '.mesa-guardar'
      return
    }
    // Con teclado, el foco pasa a la siguiente carta boca abajo.
    if (evento.detail === 0) foco.current = `.naipe[data-indice="${siguiente}"] .naipe-boton`
    // En la fila deslizable del móvil, la siguiente se acerca sola cuando
    // esta termina de girar (la especial, tras su destello).
    const fila = mesa.current?.querySelector('.abanico')
    if (fila && fila.scrollWidth > fila.clientWidth + 1) {
      const destino = fila.querySelector(`.naipe[data-indice="${siguiente}"]`)
      const especial = esEspecialId(cer.cartas[indice].id)
      acercar.current = setTimeout(
        () => destino?.scrollIntoView({ behavior: movimientoReducido() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' }),
        especial ? 1700 : 900,
      )
    }
  }

  function revelarTodas() {
    clearTimeout(acercar.current)
    foco.current = '.mesa-guardar'
    despachar({ tipo: 'revelarTodas' })
  }

  function saltar() {
    clearTimeout(acercar.current)
    foco.current = '.mesa-guardar'
    despachar({ tipo: 'saltar' })
  }

  function guardar() {
    foco.current = quedan > 0 ? '.sobre' : '.sin-sobres-enlace'
    despachar({ tipo: 'guardar' })
  }

  const enMesa = cer.cartas.length > 0
  // Cada sobre nuevo empieza en su primera carta.
  const posicionActual = posicion.sobre === cer.abiertosEnVisita ? posicion.i : 0

  // Fila deslizable del móvil: qué carta está centrada (solo cambia el
  // estado al pasar a otra carta, no en cada frame del scroll).
  function seguirPosicion(evento) {
    const fila = evento.currentTarget
    const recorrido = fila.scrollWidth - fila.clientWidth
    if (recorrido <= 0) return
    const i = Math.round((fila.scrollLeft / recorrido) * (cer.cartas.length - 1))
    if (i !== posicionActual) setPosicion({ sobre: cer.abiertosEnVisita, i })
  }
  const numero = SOBRES_POR_DIA - quedan + 1

  return (
    <div ref={escenario} className="sobres">
      <Arena />
      <div className="wrap sobres-cabecera">
        <TituloSeccion ja="開封" sub="Cinco sobres al día, con cinco cartas cada uno.">
          Sobres
        </TituloSeccion>
        <SobresDeHoy quedan={quedan} />
      </div>

      <div className="wrap sobres-mesa" style={{ '--espera': `${ultimoRetardo(cer)}ms` }}>
        <div ref={mesa} className="mesa" data-fase={cer.fase} data-instantaneo={cer.instantaneo || undefined}>
          {cer.fase === 'cerrado' &&
            (quedan > 0 ? (
              <SobreCerrado key={cer.abiertosEnVisita} numero={numero} otro={cer.abiertosEnVisita > 0} onAbrir={abrir} />
            ) : (
              <SinSobres />
            ))}

          {cer.fase === 'abriendo' && <SobreRasgado numero={numero - 1} />}

          {enMesa && (
            <ol className="abanico" aria-label="Cartas del sobre" onScroll={seguirPosicion}>
              {cer.cartas.map((c, i) => (
                <Naipe
                  key={i}
                  carta={catalogo.carta(c.id)}
                  indice={i}
                  total={cer.cartas.length}
                  nueva={c.nueva}
                  revelada={cer.reveladas[i]}
                  retardo={cer.retardos[i]}
                  copias={copias(c.id)}
                  onRevelar={revelar}
                />
              ))}
            </ol>
          )}
        </div>

        <div
          className="mesa-pie"
          data-guardando={cer.fase === 'guardando' || undefined}
          data-acciones={(enMesa && !todas) || undefined}
        >
          {enMesa && cer.fase !== 'guardando' && <Posicion actual={posicionActual} total={cer.cartas.length} />}
          {enMesa && !todas && (
            <div className="mesa-acciones">
              <button type="button" className="boton mesa-revelar" onClick={revelarTodas}>
                Revelar todas
              </button>
              <button type="button" className="boton-texto" onClick={saltar}>
                Saltar
              </button>
            </div>
          )}

          {enMesa && todas && (
            <div className="mesa-resumen">
              <div className="mesa-resumen-datos">
                <p className="mesa-resumen-texto">
                  <span className="mesa-resumen-etiqueta">Este sobre</span>
                  {textoResumen(resumenSobre(cer.cartas, esEspecialId))}
                </p>
                <p className="mesa-resumen-total cifra">En tu colección: {textoRecuento(recuento(estado.tengo))}</p>
              </div>
              <button
                type="button"
                className="boton boton--principal mesa-guardar"
                onClick={guardar}
                disabled={cer.fase === 'guardando'}
              >
                Guardar en la colección
                <span className="boton-flecha" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          )}

          {cer.fase === 'cerrado' && cer.aviso?.tipo === 'guardado' && (
            <p className="mesa-guardado">
              {cer.aviso.n} cartas guardadas en tu colección.{' '}
              <Enlace to="/coleccion" className="enlace-oro">
                Ver colección
              </Enlace>
            </p>
          )}
        </div>

        <p className="solo-lectores" aria-live="polite" aria-atomic="true">
          {aviso}
        </p>

        {cer.abiertosEnVisita === 0 && cer.fase === 'cerrado' && estado.ultimo.length > 0 && (
          <UltimoSobre ids={estado.ultimo} estado={estado} hoy={hoy} />
        )}
      </div>
    </div>
  )
}

/** «2 / 5» y cinco marcas bajo la fila deslizable del móvil (el CSS la oculta en pantallas anchas). */
function Posicion({ actual, total }) {
  return (
    <p className="mesa-posicion cifra" aria-hidden="true">
      <span className="mesa-posicion-marcas">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="mesa-posicion-marca" data-actual={i === actual || undefined} />
        ))}
      </span>
      {actual + 1} / {total}
    </p>
  )
}

/** Escenario: la arena de fondo, los focos que se mecen y las brasas que suben. */
function Arena() {
  return (
    <div className="arena" aria-hidden="true">
      <img
        className="arena-escena"
        src={ARENA.src}
        srcSet={ARENA.srcSet}
        sizes="100vw"
        width="1070"
        height="841"
        alt=""
        fetchPriority="high"
        decoding="async"
      />
      <span className="arena-focos" />
      <span className="arena-brasas">
        <span className="brasas" />
      </span>
    </div>
  )
}

/** Cinco pequeños sobres: en oro los que quedan hoy, vacíos los abiertos. */
function SobresDeHoy({ quedan }) {
  const abiertos = SOBRES_POR_DIA - quedan
  return (
    <div className="hoy">
      <ol className="hoy-sobres" aria-hidden="true">
        {Array.from({ length: SOBRES_POR_DIA }, (_, i) => (
          <li key={i} className="hoy-sobre" data-abierto={i < abiertos || undefined} />
        ))}
      </ol>
      <p className="hoy-texto">
        {quedan > 0 ? (
          <>
            Te quedan <strong className="cifra">{quedan}</strong> de {SOBRES_POR_DIA} sobres hoy.
          </>
        ) : (
          <>Has abierto los {SOBRES_POR_DIA} sobres de hoy.</>
        )}
      </p>
    </div>
  )
}

/** Sin sobres: el hueco del sobre, la cuenta atrás hasta medianoche y la colección. */
function SinSobres() {
  const minuto = useMinuto(true)
  const espera = formatoEspera(msHastaMedianoche(new Date(minuto)))
  return (
    <div className="sin-sobres">
      <div className="sin-sobres-hueco" aria-hidden="true">
        <EtiquetaVertical ja="明日" className="sin-sobres-ja" />
      </div>
      <p className="sin-sobres-titulo">Mañana, cinco sobres más.</p>
      <p className="sin-sobres-texto">
        Vuelven a medianoche. Faltan <span className="sin-sobres-espera cifra">{espera}</span>
      </p>
      <Enlace to="/coleccion" className="enlace-tinta sin-sobres-enlace">
        Ver tu colección
        <span aria-hidden="true">→</span>
      </Enlace>
    </div>
  )
}

/** El último sobre abierto (p. ej. si se recargó a mitad de la apertura). */
function UltimoSobre({ ids, estado, hoy }) {
  const vistas = new Set()
  return (
    <section className="ultimo" aria-labelledby="ultimo-titulo">
      <h2 id="ultimo-titulo" className="ultimo-titulo">
        Tu último sobre
      </h2>
      <ul className="ultimo-cartas">
        {ids.map((id, i) => {
          // Como en la mesa: solo la primera aparición de una carta conseguida hoy lleva 新.
          const nueva = estado.desde[id] === hoy && !vistas.has(id)
          vistas.add(id)
          return (
            <li key={i}>
              <Carta carta={catalogo.carta(id)} tamano="album" copias={estado.tengo[id] ?? 0} nueva={nueva} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
